// Pure scheduling helpers (no Firebase or browser code), so they are easy to test.

export function dayStamp(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

// "20:30" -> 1230 (minutes since midnight). Returns NaN for a bad value.
export function timeToMinutes(time) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(time || ""));
  if (!match) return NaN;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return NaN;
  return hours * 60 + minutes;
}

// Is this reminder due right now?
// kind: "daily" or "weekly". lastStamp: the day (dayStamp) it last fired.
export function isReminderDue(kind, reminder, now, lastStamp) {
  if (!reminder || !reminder.enabled) return false;
  if (kind === "weekly" && now.getDay() !== Number(reminder.day)) return false;
  if (lastStamp === dayStamp(now)) return false; // already fired today
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes >= timeToMinutes(reminder.time);
}
