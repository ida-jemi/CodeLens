const CHANNEL_NAME = "codelens-contest-reminders";

/**
 * Thin wrapper around BroadcastChannel for cross-tab reminder coordination.
 * Falls back to a no-op if the browser doesn't support it (Safari < 15.4,
 * some older browsers) — cross-tab dedupe is a nice-to-have, not required
 * for correctness, since the server's `notifiedAt` remains the durable
 * source of truth either way.
 */
export function createReminderChannel() {
  if (typeof BroadcastChannel === "undefined") {
    return {
      postClaim: () => {},
      onClaim: () => () => {},
    };
  }

  const channel = new BroadcastChannel(CHANNEL_NAME);

  return {
    postClaim: (contestId) => channel.postMessage({ type: "claimed", contestId }),
    onClaim: (handler) => {
      const listener = (event) => {
        if (event.data?.type === "claimed") handler(event.data.contestId);
      };
      channel.addEventListener("message", listener);
      return () => channel.removeEventListener("message", listener);
    },
  };
}
