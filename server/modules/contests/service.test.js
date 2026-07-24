import { test, describe, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";
import ContestRepository from "./repository.js";
import ContestService from "./service.js";

describe("ContestService.syncCodeforcesContests phase reconciliation", () => {
  beforeEach(() => mock.restoreAll());

  test("a locally-tracked non-finished contest is reconciled to FINISHED even outside the 20-item window", async () => {
    const fetchContests = async () => [
      { id: 999, name: "Old Contest", phase: "FINISHED", startTimeSeconds: 1000, durationSeconds: 7200 },
      // ...20 newer finished contests would normally push #999 out of the window
    ];
    mock.method(ContestRepository, "getNonFinishedContestIds", async () => new Set([999]));
    let upsertedDocs;
    mock.method(ContestRepository, "bulkUpsertContests", async (docs) => { upsertedDocs = docs; });
    mock.method(ContestRepository, "pruneStaleReminders", async () => {});

    await ContestService.syncCodeforcesContests({ fetchContests });

    const reconciled = upsertedDocs.find((d) => d.contestId === 999);
    assert.equal(reconciled?.phase, "FINISHED");
  });

  test("PENDING_SYSTEM_TEST and SYSTEM_TEST phases are persisted, not dropped", async () => {
    const fetchContests = async () => [
      { id: 1, name: "Testing Contest", phase: "SYSTEM_TEST", startTimeSeconds: 1000, durationSeconds: 7200 },
    ];
    mock.method(ContestRepository, "getNonFinishedContestIds", async () => new Set());
    let upsertedDocs;
    mock.method(ContestRepository, "bulkUpsertContests", async (docs) => { upsertedDocs = docs; });
    mock.method(ContestRepository, "pruneStaleReminders", async () => {});

    await ContestService.syncCodeforcesContests({ fetchContests });

    assert.equal(upsertedDocs.length, 1);
    assert.equal(upsertedDocs[0].phase, "SYSTEM_TEST");
  });

  test("a newly-seen finished contest within the 20-item window is still persisted (retention path unaffected)", async () => {
    const fetchContests = async () => [
      { id: 2, name: "Recent Finished", phase: "FINISHED", startTimeSeconds: 5000, durationSeconds: 7200 },
    ];
    mock.method(ContestRepository, "getNonFinishedContestIds", async () => new Set());
    let upsertedDocs;
    mock.method(ContestRepository, "bulkUpsertContests", async (docs) => { upsertedDocs = docs; });
    mock.method(ContestRepository, "pruneStaleReminders", async () => {});

    await ContestService.syncCodeforcesContests({ fetchContests });

    assert.equal(upsertedDocs.length, 1);
    assert.equal(upsertedDocs[0].contestId, 2);
  });

  test("BEFORE and CODING phases pass through untouched, unaffected by reconciliation logic", async () => {
    const fetchContests = async () => [
      { id: 3, name: "Upcoming Contest", phase: "BEFORE", startTimeSeconds: 9999, durationSeconds: 7200 },
    ];
    mock.method(ContestRepository, "getNonFinishedContestIds", async () => new Set());
    let upsertedDocs;
    mock.method(ContestRepository, "bulkUpsertContests", async (docs) => { upsertedDocs = docs; });
    mock.method(ContestRepository, "pruneStaleReminders", async () => {});

    await ContestService.syncCodeforcesContests({ fetchContests });

    assert.equal(upsertedDocs[0].phase, "BEFORE");
  });
});
