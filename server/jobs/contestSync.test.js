import { test, describe, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";
import SyncLock from "../models/SyncLock.js";
import { acquireLock, releaseLock, renewLock, createRunSync } from "./contestSync.js";

describe("acquireLock / releaseLock / renewLock", () => {
  beforeEach(() => mock.restoreAll());

  test("acquires the lock when no unexpired lease exists", async () => {
    mock.method(SyncLock, "findOneAndUpdate", async (filter, update) => ({
      jobName: update.jobName,
      ownerId: update.ownerId,
      lockedUntil: update.lockedUntil,
    }));

    const acquired = await acquireLock("contestSync", 60000, "instanceA:run1");
    assert.equal(acquired, true);
  });

  test("only one of two concurrent acquirers wins (duplicate key race)", async () => {
    let firstCallWon = false;
    mock.method(SyncLock, "findOneAndUpdate", async (filter, update) => {
      if (!firstCallWon) {
        firstCallWon = true;
        return { jobName: update.jobName, ownerId: update.ownerId, lockedUntil: update.lockedUntil };
      }
      const err = new Error("E11000 duplicate key error");
      err.code = 11000;
      throw err;
    });

    const [a, b] = await Promise.all([
      acquireLock("contestSync", 60000, "instanceA:run1"),
      acquireLock("contestSync", 60000, "instanceB:run1"),
    ]);

    assert.equal([a, b].filter(Boolean).length, 1);
  });

  test("returns false and does not throw when the DB is unreachable", async () => {
    mock.method(SyncLock, "findOneAndUpdate", async () => {
      throw new Error("connection timed out");
    });

    const acquired = await acquireLock("contestSync", 60000, "instanceA:run1");
    assert.equal(acquired, false);
  });

  test("acquireLock's query filter actually enforces lease expiry (lockedUntil $lt now)", async () => {
    let capturedFilter;
    mock.method(SyncLock, "findOneAndUpdate", async (filter, update) => {
      capturedFilter = filter;
      return { jobName: update.jobName, ownerId: update.ownerId, lockedUntil: update.lockedUntil };
    });

    await acquireLock("contestSync", 60000, "instanceB:run2");

    assert.equal(capturedFilter.jobName, "contestSync");
    assert.ok(capturedFilter.lockedUntil, "expected a lockedUntil predicate in the query filter");
    assert.ok(
      capturedFilter.lockedUntil.$lt instanceof Date,
      "expected lockedUntil.$lt to be a Date so only expired/absent leases match"
    );
  });

  test("releaseLock deletes scoped to jobName + ownerId only", async () => {
    let deleteFilter;
    mock.method(SyncLock, "deleteOne", async (filter) => {
      deleteFilter = filter;
      return { deletedCount: 1 };
    });

    await releaseLock("contestSync", "instanceA:run1");
    assert.deepEqual(deleteFilter, { jobName: "contestSync", ownerId: "instanceA:run1" });
  });

  test("releaseLock does not throw when deleteOne fails", async () => {
    mock.method(SyncLock, "deleteOne", async () => {
      throw new Error("connection lost");
    });

    await assert.doesNotReject(releaseLock("contestSync", "instanceA:run1"));
  });

  test("renewLock updates scoped to jobName + ownerId only, and does not throw on failure", async () => {
    let updateFilter;
    mock.method(SyncLock, "updateOne", async (filter) => {
      updateFilter = filter;
      return { matchedCount: 1 };
    });

    await renewLock("contestSync", 60000, "instanceA:run1");
    assert.deepEqual(updateFilter, { jobName: "contestSync", ownerId: "instanceA:run1" });

    mock.method(SyncLock, "updateOne", async () => {
      throw new Error("connection lost");
    });
    await assert.doesNotReject(renewLock("contestSync", 60000, "instanceA:run1"));
  });
});

describe("createRunSync — scheduler execution paths", () => {
  test("synced: acquires, runs syncFn, releases on success", async () => {
    const calls = [];
    const acquire = async () => { calls.push("acquire"); return true; };
    const release = async () => { calls.push("release"); };
    const renew = async () => { calls.push("renew"); };
    const syncFn = async () => ({ synced: 5 });

    const { runSync, getIsRunning } = createRunSync({
      jobName: "contestSync",
      ttlMs: 60000,
      renewalIntervalMs: 30000,
      instanceId: "test-instance",
      syncFn,
      acquire,
      release,
      renew,
    });

    const result = await runSync();

    assert.equal(result.outcome, "synced");
    assert.equal(result.synced, 5);
    assert.deepEqual(calls, ["acquire", "release"]);
    assert.equal(getIsRunning(), false);
  });

  test("failed: syncFn throws, lock is still released (finally block)", async () => {
    const calls = [];
    const acquire = async () => true;
    const release = async () => { calls.push("release"); };
    const renew = async () => {};
    const syncFn = async () => { throw new Error("Codeforces API unreachable"); };

    const { runSync, getIsRunning } = createRunSync({
      jobName: "contestSync",
      ttlMs: 60000,
      renewalIntervalMs: 30000,
      instanceId: "test-instance",
      syncFn,
      acquire,
      release,
      renew,
    });

    const result = await runSync();

    assert.equal(result.outcome, "failed");
    assert.match(result.error, /Codeforces API unreachable/);
    assert.deepEqual(calls, ["release"]);
    assert.equal(getIsRunning(), false);
  });

  test("skipped-locked: another instance holds the lease, syncFn never runs", async () => {
    let syncFnCalled = false;
    const acquire = async () => false;
    const release = async () => { throw new Error("release should never be called here"); };
    const renew = async () => {};
    const syncFn = async () => { syncFnCalled = true; return { synced: 0 }; };

    const { runSync } = createRunSync({
      jobName: "contestSync",
      ttlMs: 60000,
      renewalIntervalMs: 30000,
      instanceId: "test-instance",
      syncFn,
      acquire,
      release,
      renew,
    });

    const result = await runSync();

    assert.equal(result.outcome, "skipped-locked");
    assert.equal(syncFnCalled, false);
  });

  test("skipped-running: a second call while the first is still in-flight on the same instance is skipped", async () => {
    let resolveFirstSync;
    const firstSyncGate = new Promise((resolve) => { resolveFirstSync = resolve; });
    let syncFnCallCount = 0;

    const acquire = async () => true;
    const release = async () => {};
    const renew = async () => {};
    const syncFn = async () => {
      syncFnCallCount += 1;
      await firstSyncGate;
      return { synced: 1 };
    };

    const { runSync, getIsRunning } = createRunSync({
      jobName: "contestSync",
      ttlMs: 60000,
      renewalIntervalMs: 30000,
      instanceId: "test-instance",
      syncFn,
      acquire,
      release,
      renew,
    });

    const firstRunPromise = runSync();
    // Give the first call a tick to set isRunning = true before firing the second.
    await new Promise((r) => setImmediate(r));
    assert.equal(getIsRunning(), true);

    const secondResult = await runSync();
    assert.equal(secondResult.outcome, "skipped-running");
    assert.equal(syncFnCallCount, 1, "syncFn should only have been invoked once");

    resolveFirstSync();
    const firstResult = await firstRunPromise;
    assert.equal(firstResult.outcome, "synced");
  });

  test("renew is called periodically while a long-running sync is in flight", async () => {
    let renewCount = 0;
    const acquire = async () => true;
    const release = async () => {};
    const renew = async () => { renewCount += 1; };
    let resolveSync;
    const syncFn = async () => {
      await new Promise((resolve) => { resolveSync = resolve; });
      return { synced: 1 };
    };

    const { runSync } = createRunSync({
      jobName: "contestSync",
      ttlMs: 100,
      renewalIntervalMs: 20, // short interval so the test doesn't need to wait long
      instanceId: "test-instance",
      syncFn,
      acquire,
      release,
      renew,
    });

    const runPromise = runSync();
    await new Promise((r) => setTimeout(r, 70)); // long enough for a few renewals to fire
    resolveSync();
    await runPromise;

    assert.ok(renewCount >= 2, `expected at least 2 renewals, got ${renewCount}`);
  });
});
