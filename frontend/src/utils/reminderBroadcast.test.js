import { describe, it, expect, vi } from "vitest";
import { createReminderChannel } from "./reminderBroadcast";

describe("createReminderChannel", () => {
  it("delivers a claimed contestId from one channel instance to another (cross-tab simulation)", async () => {
    const tabA = createReminderChannel();
    const tabB = createReminderChannel();

    const received = await new Promise((resolve) => {
      tabB.onClaim((contestId) => resolve(contestId));
      tabA.postClaim(42);
    });

    expect(received).toBe(42);
  });

  it("does not invoke the handler for unrelated message shapes", async () => {
    const tabA = createReminderChannel();
    const tabB = createReminderChannel();
    const handler = vi.fn();

    tabB.onClaim(handler);

    // A message on the same channel name but not our { type: "claimed" }
    // shape should be ignored, not crash or trigger the handler.
    const raw = new BroadcastChannel("codelens-contest-reminders");
    raw.postMessage({ type: "something-else", contestId: 7 });
    raw.close();

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(handler).not.toHaveBeenCalled();

    // Sanity check the same tabB instance still works for a real claim.
    const received = await new Promise((resolve) => {
      tabB.onClaim((contestId) => resolve(contestId));
      tabA.postClaim(99);
    });
    expect(received).toBe(99);
  });

  it("onClaim's returned unsubscribe function stops further delivery", async () => {
    const tabA = createReminderChannel();
    const tabB = createReminderChannel();
    const handler = vi.fn();

    const unsubscribe = tabB.onClaim(handler);
    unsubscribe();

    tabA.postClaim(5);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(handler).not.toHaveBeenCalled();
  });

  it("falls back to safe no-ops when BroadcastChannel is unavailable", () => {
    const original = globalThis.BroadcastChannel;
     
    globalThis.BroadcastChannel = undefined;

    try {
      const channel = createReminderChannel();
      // Should not throw when called, and postClaim/onClaim should behave
      // as inert no-ops.
      expect(() => channel.postClaim(1)).not.toThrow();
      const unsubscribe = channel.onClaim(() => {});
      expect(() => unsubscribe()).not.toThrow();
    } finally {
      globalThis.BroadcastChannel = original;
    }
  });
});
