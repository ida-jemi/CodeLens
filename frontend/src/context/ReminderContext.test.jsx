import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ReminderProvider, useReminders } from "./ReminderContext";

// waitFor from Testing Library polls using real timers internally, which
// deadlocks against vi.useFakeTimers(). Flush pending microtasks (the
// resolved mock promises) manually instead.
const flush = () => act(async () => {
  await Promise.resolve();
  await Promise.resolve();
});

const mockUseAuth = vi.fn();
vi.mock("./AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockGetMyActiveReminders = vi.fn();
vi.mock("../services/contestService", () => ({
  getMyActiveReminders: (...args) => mockGetMyActiveReminders(...args),
}));

/**
 * Renders raw values from useReminders(), plus a counter of how many times
 * the underlying API was actually called — the counter is read directly
 * from the mock rather than duplicated in component state, so it reflects
 * ground truth regardless of render timing.
 */
function ReminderConsumer() {
  const { reminders } = useReminders();
  return (
    <div>
      <span data-testid="count">{reminders.length}</span>
      <ul>
        {reminders.map((r) => (
          <li key={r.contestId}>{r.name}</li>
        ))}
      </ul>
    </div>
  );
}

describe("ReminderContext", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockGetMyActiveReminders.mockReset();
    mockUseAuth.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("throws a clear error when useReminders is used outside a ReminderProvider", () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true });
    // Suppress the expected React error-boundary console noise for this case.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<ReminderConsumer />)).toThrow(
      "useReminders must be used within a ReminderProvider"
    );
    spy.mockRestore();
  });

  it("does not poll at all when the user is not authenticated", async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false });
    render(
      <ReminderProvider>
        <ReminderConsumer />
      </ReminderProvider>
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(mockGetMyActiveReminders).not.toHaveBeenCalled();
    expect(screen.getByTestId("count").textContent).toBe("0");
  });

  it("polls immediately on mount, then exactly once per 30s interval — a single shared loop, not two", async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true });
    mockGetMyActiveReminders.mockResolvedValue({ data: { data: [{ contestId: 1, name: "Round 1" }] } });

    render(
      <ReminderProvider>
        <ReminderConsumer />
      </ReminderProvider>
    );

    await flush();
    expect(mockGetMyActiveReminders).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("count").textContent).toBe("1");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(mockGetMyActiveReminders).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(mockGetMyActiveReminders).toHaveBeenCalledTimes(3);
  });

  it("multiple consumers reading useReminders() at the same time do not each trigger their own poll", async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true });
    mockGetMyActiveReminders.mockResolvedValue({ data: { data: [] } });

    render(
      <ReminderProvider>
        <ReminderConsumer />
        <ReminderConsumer />
      </ReminderProvider>
    );

    await flush();
    expect(mockGetMyActiveReminders).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    // Still just ONE call per interval tick, even with two consumers mounted
    // — this is the actual assertion behind "bell and notifier share one
    // poll instead of each running their own."
    expect(mockGetMyActiveReminders).toHaveBeenCalledTimes(2);
  });

  it("silently keeps the previous reminder list on a failed poll, rather than throwing or clearing state", async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true });
    mockGetMyActiveReminders
      .mockResolvedValueOnce({ data: { data: [{ contestId: 1, name: "Round 1" }] } })
      .mockRejectedValueOnce(new Error("network error"));

    render(
      <ReminderProvider>
        <ReminderConsumer />
      </ReminderProvider>
    );

    await flush();
    expect(screen.getByTestId("count").textContent).toBe("1");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    // The failed poll should not wipe out the previously loaded reminders.
    expect(screen.getByTestId("count").textContent).toBe("1");
  });

  it("resets reminders to empty when auth flips from true to false", async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true });
    mockGetMyActiveReminders.mockResolvedValue({ data: { data: [{ contestId: 1, name: "Round 1" }] } });

    const { rerender } = render(
      <ReminderProvider>
        <ReminderConsumer />
      </ReminderProvider>
    );

    await flush();
    expect(screen.getByTestId("count").textContent).toBe("1");

    mockUseAuth.mockReturnValue({ isAuthenticated: false });
    rerender(
      <ReminderProvider>
        <ReminderConsumer />
      </ReminderProvider>
    );

    await flush();
    expect(screen.getByTestId("count").textContent).toBe("0");
  });
});
