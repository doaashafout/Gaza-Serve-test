const WORK_START_HOUR = 8;
const WORK_END_HOUR = 24;

function calculateWorkingHoursElapsed(startTime) {
  const start = new Date(startTime);
  const now = new Date();

  if (now <= start) return 0;

  let totalHours = 0;
  const cursor = new Date(start);

  while (cursor < now) {
    const h = cursor.getHours();
    if (h >= WORK_START_HOUR && h < WORK_END_HOUR) totalHours++;
    cursor.setTime(cursor.getTime() + 60 * 60 * 1000);
  }

  return totalHours;
}

function isWithinWorkingHours(date) {
  const h = new Date(date).getHours();
  return h >= WORK_START_HOUR && h < WORK_END_HOUR;
}

module.exports = { calculateWorkingHoursElapsed, isWithinWorkingHours, WORK_START_HOUR, WORK_END_HOUR };
