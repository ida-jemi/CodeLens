import { test, describe, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";
import ContestRepository from "./repository.js";
import ContestService from "./service.js";

describe("ContestService.syncCodeforcesContests phase reconciliation", () => {
  beforeEach(() => mock.restoreAll());

  test("a locally-tracked non-finished contest is reconciled to FINISHED even outside the 20-item window", async () => {
    const fetchContests = async () => [
      { id: 999, name: "Old Contest", phase: "FINISHED", startTimeSeconds: 1000, durationSeconds: 7200 },
      ...Array.from({ length: 20 }, (_, index) => ({
        id: index + 1,
        name: `New Contest ${index + 1}`,
        phase: "FINISHED",
        startTimeSeconds: 2000 + index,
        durationSeconds: 7200,
      })),
    ];
    mock.method(ContestRepository, "getNonFinishedContestIds", async () => new Set([999]));
    let upsertedDocs;
    mock.method(ContestRepository, "bulkUpsertContests", async (docs) => { upsertedDocs = docs; });
    mock.method(ContestRepository, "pruneStaleReminders", async () => {});

    await ContestService.syncCodeforcesContests({ fetchContests });

    const reconciled = upsertedDocs.find((d) => d.contestId === 999);
    assert.equal(reconciled?.phase, "FINISHED");
  });

  test("PENDING_SYSTEM_TEST and SYSTEM_TEST phases are both persisted, not dropped", async () => {
    const fetchContests = async () => [
      { id: 1, name: "Pending Test", phase: "PENDING_SYSTEM_TEST", startTimeSeconds: 1000, durationSeconds: 7200 },
      { id: 2, name: "System Test", phase: "SYSTEM_TEST", startTimeSeconds: 1000, durationSeconds: 7200 },
    ];
    mock.method(ContestRepository, "getNonFinishedContestIds", async () => new Set());
    let upsertedDocs;
    mock.method(ContestRepository, "bulkUpsertContests", async (docs) => { upsertedDocs = docs; });
    mock.method(ContestRepository, "pruneStaleReminders", async () => {});

    await ContestService.syncCodeforcesContests({ fetchContests });

    assert.deepEqual(
      upsertedDocs.map((doc) => doc.phase).sort(),
      ["PENDING_SYSTEM_TEST", "SYSTEM_TEST"]
    );
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
