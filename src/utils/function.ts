export function isFirstDateBeforeSecond(
  timestamp1: number,
  timestamp2: number
) {
  // Normalize timestamps by creating new Date objects and setting them to midnight
  const date1 = new Date(timestamp1);
  const date2 = new Date(timestamp2);

  // Set the time to midnight (00:00:00) to compare only the date
  date1.setHours(0, 0, 0, 0);
  date2.setHours(0, 0, 0, 0);

  // Compare the normalized dates
  return date1 < date2; // Returns true if the first date is before the second date
}
