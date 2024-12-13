export function isFirstDateBeforeSecond(timestamp1: number, timestamp2: number) {
  // Normalize timestamps by creating new Date objects and setting them to midnight
  const date1 = new Date(timestamp1);
  const date2 = new Date(timestamp2);

  // Set the time to midnight (00:00:00) to compare only the date
  date1.setHours(0, 0, 0, 0);
  date2.setHours(0, 0, 0, 0);

  // Compare the normalized dates
  return date1 < date2; // Returns true if the first date is before the second date
}

/**
 * Capitalizes the first letter of each word in a given string.
 * @param input - The string to capitalize.
 * @returns The input string with each word's first letter capitalized.
 */
export function capitalizeWords(input: string): string {
  if (!input) return '';

  return input
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Calculates the age based on the birth year.
 * @param birthYear - The birth year as a number.
 * @returns The age as a formatted string (e.g., "X Months" or "X Years").
 */
export function calculatedAge(birthYear: number): string {
  if (!birthYear || birthYear > new Date().getFullYear()) {
    console.log('Invalid birth year provided.');
  }

  const currentDate = new Date();
  const birthDate = new Date(birthYear, 0); // Assuming January 1st of the birth year

  const ageInMonths =
    (currentDate.getFullYear() - birthDate.getFullYear()) * 12 + (currentDate.getMonth() - birthDate.getMonth());

  if (ageInMonths < 12) {
    return `${ageInMonths} ${ageInMonths === 1 ? 'Month' : 'Months'}`;
  }

  const years = Math.floor(ageInMonths / 12);
  return `${years} ${years === 1 ? 'Year' : 'Years'}`;
}
