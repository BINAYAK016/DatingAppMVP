export function invitationTime(date: string, time: string, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    return { error: "Enter a date as YYYY-MM-DD." };
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    return { error: "Enter a time as HH:MM, using the 24-hour clock." };
  const scheduled = new Date(`${date}T${time}:00`);
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if (
    !Number.isFinite(scheduled.getTime()) ||
    scheduled.getFullYear() !== year ||
    scheduled.getMonth() !== month - 1 ||
    scheduled.getDate() !== day
  )
    return { error: "Choose a valid calendar date." };
  if (scheduled.getHours() !== hour || scheduled.getMinutes() !== minute)
    return {
      error:
        "That local time does not exist when the clocks change. Choose another time.",
    };
  if (scheduled <= now) return { error: "Choose a future date and time." };
  return { scheduled, error: "" };
}
