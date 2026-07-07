import api from "./api.js";

export const getUpcomingCodeforcesContests = () =>
  api.get("/contests/codeforces/upcoming");

export const getMyReminderIds = () => api.get("/contests/reminders");

export const getMyActiveReminders = () => api.get("/contests/reminders/active");

export const addContestReminder = (contestId) =>
  api.post("/contests/reminders", { contestId });

export const removeContestReminder = (contestId) =>
  api.delete(`/contests/reminders/${contestId}`);

export const markReminderNotified = (contestId) =>
  api.post(`/contests/reminders/${contestId}/notified`);
