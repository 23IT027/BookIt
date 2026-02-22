/**
 * Format a Date object to YYYY-MM-DD string using local date components.
 * This avoids timezone issues where toISOString() might return a different date
 * (e.g., Dec 21 midnight IST becomes Dec 20 in UTC/ISO format).
 * 
 * @param {Date} date - The date to format
 * @returns {string} Date string in YYYY-MM-DD format
 */
export const formatLocalDate = (date) => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return '';
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Get today's date as YYYY-MM-DD string in local timezone.
 * @returns {string} Today's date string
 */
export const getTodayString = () => {
  return formatLocalDate(new Date());
};

/**
 * Add days to a date and return YYYY-MM-DD string.
 * @param {Date} date - Base date
 * @param {number} days - Number of days to add
 * @returns {string} Date string in YYYY-MM-DD format
 */
export const addDaysFormatted = (date, days) => {
  const newDate = new Date(date);
  newDate.setDate(newDate.getDate() + days);
  return formatLocalDate(newDate);
};

/**
 * Parse a YYYY-MM-DD string to a Date object at midnight local time.
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {Date} Date object
 */
export const parseLocalDate = (dateString) => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};
