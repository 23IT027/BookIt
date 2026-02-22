/**
 * Date and time utility functions
 */

/**
 * Parse time string (HH:MM) to minutes since midnight
 */
const timeToMinutes = (timeString) => {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * Convert minutes since midnight to time string (HH:MM)
 */
const minutesToTime = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

/**
 * Get day of week (0-6) from date
 */
const getDayOfWeek = (date) => {
  return new Date(date).getDay();
};

/**
 * Format date to YYYY-MM-DD
 */
const formatDate = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Combine date and time strings to create Date object
 */
const combineDateAndTime = (dateString, timeString) => {
  const [hours, minutes] = timeString.split(':').map(Number);
  const date = new Date(dateString);
  date.setHours(hours, minutes, 0, 0);
  return date;
};

/**
 * Check if two time ranges overlap
 */
const timeRangesOverlap = (start1, end1, start2, end2) => {
  return start1 < end2 && start2 < end1;
};

/**
 * Add minutes to a date
 */
const addMinutes = (date, minutes) => {
  return new Date(date.getTime() + minutes * 60000);
};

/**
 * Get start and end of day
 */
const getStartOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getEndOfDay = (date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

/**
 * Check if date is in the past
 */
const isPast = (date) => {
  return new Date(date) < new Date();
};

/**
 * Check if date is in the future
 */
const isFuture = (date) => {
  return new Date(date) > new Date();
};

/**
 * Get difference in minutes between two dates
 */
const getDifferenceInMinutes = (date1, date2) => {
  return Math.floor((date2 - date1) / (1000 * 60));
};

/**
 * Generate time slots between start and end time
 */
const generateTimeSlots = (startTime, endTime, durationMinutes, bufferMinutes = 0) => {
  const slots = [];
  const totalMinutes = durationMinutes + bufferMinutes;
  let current = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);

  while (current + durationMinutes <= end) {
    slots.push({
      startTime: minutesToTime(current),
      endTime: minutesToTime(current + durationMinutes)
    });
    current += totalMinutes;
  }

  return slots;
};

/**
 * Check if a date is today
 */
const isToday = (date) => {
  const today = new Date();
  const d = new Date(date);
  return d.getDate() === today.getDate() &&
         d.getMonth() === today.getMonth() &&
         d.getFullYear() === today.getFullYear();
};

/**
 * Get hours difference between two dates
 */
const getHoursDifference = (date1, date2) => {
  return Math.abs(date2 - date1) / (1000 * 60 * 60);
};

module.exports = {
  timeToMinutes,
  minutesToTime,
  getDayOfWeek,
  formatDate,
  combineDateAndTime,
  timeRangesOverlap,
  addMinutes,
  getStartOfDay,
  getEndOfDay,
  isPast,
  isFuture,
  getDifferenceInMinutes,
  generateTimeSlots,
  isToday,
  getHoursDifference
};
