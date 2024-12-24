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

export function calculateTimeDifference(timestamp: number): string {
  const now = new Date();
  const futureDate = new Date(timestamp);

  // Calculate the difference in milliseconds
  const diff = futureDate.getTime() - now.getTime();

  if (diff <= 0) {
    return '2 h 33 m';
  }

  // Convert the difference to days, hours, and minutes
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  // Build the result string
  const resultParts: string[] = [];
  if (days > 0) resultParts.push(`${days} d`);
  if (hours > 0) resultParts.push(`${hours} h`);
  if (minutes > 0) resultParts.push(`${minutes} m`);

  return resultParts.join(' ');
}

export function calculateOfferExpiration(timestamp: number): string {
  const now = new Date();
  const futureDate = new Date(timestamp);

  // Calculate the difference in milliseconds
  const diff = futureDate.getTime() - now.getTime();

  if (diff <= 0) {
    return '5 hours';
  }

  // Convert the difference to days, hours, and minutes
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  // Return the first available unit of time
  if (days > 0) {
    return `${days} days`;
  } else if (hours > 0) {
    return `${hours} hours`;
  } else {
    return `${minutes} minutes`;
  }
}

export function shortenedWalletAddress(address: string) {
  // Ensure the address is not too short
  if (address?.length <= 13) {
    return address;
  }

  return `${address.slice(0, 7)}...${address.slice(-6)}`;
}
