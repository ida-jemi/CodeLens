# Contest collection index rationale

This documents why each index on the `contests` collection exists, so future
changes can evaluate additions/removals against actual query patterns
instead of adding indexes defensively.

## Current indexes

| Index | Backs |
|---|---|
| `{ platform: 1, contestId: 1 }` (unique) | `findByContestId` (repository.js), `bulkUpsertContests`'s upsert filter — both always filter on `platform` + `contestId` together. Also enforces the one-document-per-(platform, contestId) invariant. Its leftmost prefix (`platform`) also serves any query that filters on `platform` alone. |
| `{ phase: 1 }` | `getUpcomingContests`, `getNonFinishedContestIds`, `pruneStaleReminders`, `getActiveReminderContests` all filter on `phase` (combined with `platform`, which the compound index above already indexes as a prefix — see note below). |
| `{ startTimeSeconds: 1 }` | `getUpcomingContests`'s sort, and range queries if added later (e.g. "contests starting in the next N hours"). |

## What was removed and why

A standalone `{ contestId: 1 }` index previously existed alongside the
compound unique `{ platform: 1, contestId: 1 }` index. No query in the
codebase ever filters on `contestId` without also filtering on `platform`
in the same query — the compound index's leftmost-prefix property means
MongoDB can already use it for any query that only touches `platform`, and
of course for any query touching both fields. The standalone index added
write overhead (one more index entry to maintain on every insert/upsert)
without ever being the index MongoDB would choose over the compound one.

## Applying this in an already-deployed environment

Changing the Mongoose schema does **not** drop the index from an existing
database — indexes are a database-level construct, and Mongoose's
`autoIndex` (used in dev) only ever *adds* missing indexes, it never drops
ones no longer declared in the schema. To remove the standalone index from
a real deployment, run the migration script once against that environment:

```bash
node server/scripts/dropRedundantContestIndex.js
```

It's idempotent — safe to run again if the index is already gone.

## Future consideration (not applied in this change)

`getUpcomingContests` filters on `{ platform, phase }` and sorts on
`startTimeSeconds` — a compound index `{ platform: 1, phase: 1,
startTimeSeconds: 1 }` would let MongoDB satisfy that entire query
(filter + sort) from a single index scan, rather than filtering on `phase`
and then sorting separately. This wasn't rolled into this change since it
requires validating against real query volume/`explain()` output in a
representative environment rather than reasoning about it in the abstract —
flagged here for whoever picks up index tuning next.
