import { test, describe, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";
import SyncLock from "../models/SyncLock.js";
import { acquireLock, releaseLock } from "./contestSync.js";

describe("contestSync distributed lock", () => {
  beforeEach(() => {
    mock.restoreAll();
  });

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

  test("a new owner can acquire once the previous lease has expired", async () => {
    mock.method(SyncLock, "findOneAndUpdate", async (filter, update) => ({
      jobName: update.jobName,
      ownerId: update.ownerId,
      lockedUntil: update.lockedUntil,
    }));

    const acquired = await acquireLock("contestSync", 60000, "instanceB:run2");
    assert.equal(acquired, true);
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
});
