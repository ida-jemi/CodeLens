import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { addReminderSchema, contestIdParamSchema } from "./validation.js";

// Both schemas currently enforce the identical positive-integer contract,
// so we test them together via a table — this also documents that they're
// expected to accept/reject the exact same set of inputs.
const schemas = {
  addReminderSchema,
  contestIdParamSchema,
};

describe("contest reminder id validation contract", () => {
  for (const [schemaName, schema] of Object.entries(schemas)) {
    describe(schemaName, () => {
      test("accepts a valid positive integer", () => {
        const result = schema.safeParse({ contestId: 2094 });
        assert.equal(result.success, true);
        assert.equal(result.data.contestId, 2094);
      });

      test("accepts a valid positive integer given as a string (route params arrive as strings)", () => {
        const result = schema.safeParse({ contestId: "2094" });
        assert.equal(result.success, true);
        assert.equal(result.data.contestId, 2094);
        assert.equal(typeof result.data.contestId, "number");
      });

      test("rejects zero", () => {
        const result = schema.safeParse({ contestId: 0 });
        assert.equal(result.success, false);
      });

      test("rejects negative numbers", () => {
        const result = schema.safeParse({ contestId: -5 });
        assert.equal(result.success, false);
      });

      test("rejects decimals", () => {
        const result = schema.safeParse({ contestId: 12.5 });
        assert.equal(result.success, false);
      });

      test("rejects non-numeric strings", () => {
        const result = schema.safeParse({ contestId: "abc" });
        assert.equal(result.success, false);
      });

      test("rejects permissive-looking strings like '12abc' (parseInt would have silently accepted this as 12)", () => {
        const result = schema.safeParse({ contestId: "12abc" });
        assert.equal(result.success, false);
      });

      test("rejects a missing contestId", () => {
        const result = schema.safeParse({});
        assert.equal(result.success, false);
      });

      test("rejects an empty string", () => {
        const result = schema.safeParse({ contestId: "" });
        assert.equal(result.success, false);
      });
    });
  }
});
