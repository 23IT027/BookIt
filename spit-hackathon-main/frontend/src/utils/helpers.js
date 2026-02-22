import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns';

export const formatDate = (date, formatStr = 'MMM d, yyyy') => {
  if (!date) return '';
  const d = typeof date === 'string' ? parseISO(date) : date;
  return isValid(d) ? format(d, formatStr) : '';
};

export const formatTime = (time) => {
  if (!time) return '';
  // Handle HH:mm format
  if (time.includes(':') && !time.includes('T')) {
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  }
  // Handle ISO date string
  const d = typeof time === 'string' ? parseISO(time) : time;
  return isValid(d) ? format(d, 'h:mm a') : '';
};

export const formatDateTime = (date) => {
  if (!date) return '';
  const d = typeof date === 'string' ? parseISO(date) : date;
  return isValid(d) ? format(d, 'MMM d, yyyy h:mm a') : '';
};

export const formatRelative = (date) => {
  if (!date) return '';
  const d = typeof date === 'string' ? parseISO(date) : date;
  return isValid(d) ? formatDistanceToNow(d, { addSuffix: true }) : '';
};

export const formatCurrency = (amount, currency = 'INR') => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
  }).format(amount);
};

export const formatDuration = (minutes) => {
  if (!minutes) return '';
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins ? `${hours}h ${mins}min` : `${hours}h`;
};

export const getDateRange = (startDate, days) => {
  const dates = [];
  const start = new Date(startDate);
  for (let i = 0; i < days; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    dates.push(date);
  }
  return dates;
};

export const getDayOfWeek = (date) => {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return d.getDay();
};

export const getDayName = (dayOfWeek) => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayOfWeek];
};

export const getShortDayName = (dayOfWeek) => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[dayOfWeek];
};

export const classNames = (...classes) => {
  return classes.filter(Boolean).join(' ');
};

export const getStatusColor = (status) => {
  const colors = {
    PENDING: 'badge-warning',
    CONFIRMED: 'badge-success',
    COMPLETED: 'badge-info',
    CANCELLED: 'badge-error',
    NO_SHOW: 'badge-error',
    PAID: 'badge-success',
    REFUNDED: 'badge-info',
    FAILED: 'badge-error',
  };
  return colors[status] || 'badge-info';
};

export const getPaymentStatusColor = (status) => {
  const colors = {
    PENDING: 'text-amber-400 bg-amber-500/10',
    COMPLETED: 'text-emerald-400 bg-emerald-500/10',
    FAILED: 'text-red-400 bg-red-500/10',
    REFUNDED: 'text-cyan-400 bg-cyan-500/10',
  };
  return colors[status] || 'text-gray-400 bg-gray-500/10';
};

export const truncate = (str, length = 50) => {
  if (!str) return '';
  return str.length > length ? `${str.substring(0, length)}...` : str;
};

export const generateId = () => {
  return Math.random().toString(36).substring(2, 15);
};

export const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
