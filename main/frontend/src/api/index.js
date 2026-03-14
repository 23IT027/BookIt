import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request interceptor - Add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - Handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Don't redirect on 401 for auth endpoints (login, signup, etc.)
    const isAuthEndpoint = error.config?.url?.includes('/auth/');
    
    if (error.response?.status === 401 && !isAuthEndpoint) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  signup: (data) => api.post('/auth/signup', data),
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  refresh: () => api.post('/auth/refresh'),
  sendOTP: (email) => api.post('/auth/send-otp', { email }),
  verifyOTP: (email, otp) => api.post('/auth/verify-otp', { email, otp }),
  resendOTP: (email, purpose = 'EMAIL_VERIFICATION') => api.post('/auth/resend-otp', { email, purpose }),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (email, otp, newPassword) => api.post('/auth/reset-password', { email, otp, newPassword }),
};

// User API
export const userAPI = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (data) => api.patch('/users/profile', data),
  changePassword: (data) => api.post('/users/change-password', data),
};

// Provider API
export const providerAPI = {
  getAll: (params) => api.get('/providers', { params }),
  getById: (id) => api.get(`/providers/${id}`),
  create: (data) => api.post('/providers', data),
  update: (id, data) => api.patch(`/providers/${id}`, data),
  delete: (id) => api.delete(`/providers/${id}`),
  getByUser: () => api.get('/providers/user/me/provider'),
  getStats: (id) => api.get(`/providers/${id}/stats`),
};

// Appointment Type API
export const appointmentTypeAPI = {
  getAll: (params) => api.get('/appointment-types', { params }),
  getByProvider: (providerId) => api.get('/appointment-types', { params: { provider: providerId } }),
  getById: (id) => api.get(`/appointment-types/${id}`),
  create: (data) => api.post('/appointment-types', data),
  createWithImages: (formData) => api.post('/appointment-types/with-images', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  update: (id, data) => api.patch(`/appointment-types/${id}`, data),
  delete: (id) => api.delete(`/appointment-types/${id}`),
  uploadImages: (id, formData) => api.post(`/appointment-types/${id}/images`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};

// Availability API
export const availabilityAPI = {
  getByProvider: (providerId) => api.get(`/availability/provider/${providerId}`),
  getById: (id) => api.get(`/availability/${id}`),
  create: (data) => api.post('/availability', data),
  update: (id, data) => api.patch(`/availability/${id}`, data),
  delete: (id) => api.delete(`/availability/${id}`),
  addException: (id, data) => api.post(`/availability/${id}/exceptions`, data),
  removeException: (id, exceptionId) => api.delete(`/availability/${id}/exceptions/${exceptionId}`),
};

// Slots API
export const slotAPI = {
  getAvailable: (providerId, date, appointmentTypeId) => {
    const params = { date };
    if (appointmentTypeId) params.appointmentTypeId = appointmentTypeId;
    return api.get(`/slots/${providerId}`, { params });
  },
  check: (providerId, params) => api.get(`/slots/${providerId}/check`, { params }),
  getSchedule: (providerId, startDate, endDate) => 
    api.get(`/slots/${providerId}/schedule`, { params: { startDate, endDate } }),
  getAvailabilityRange: (providerId, startDate, endDate, appointmentTypeId) => {
    const params = { startDate, endDate };
    if (appointmentTypeId) params.appointmentTypeId = appointmentTypeId;
    return api.get(`/slots/${providerId}/availability-range`, { params });
  },
};

// Booking API
export const bookingAPI = {
  create: (data) => api.post('/bookings', data),
  getCustomerBookings: (params) => api.get('/bookings/customer', { params }),
  getProviderBookings: (providerId, params) => api.get(`/bookings/provider/${providerId}`, { params }),
  getById: (id) => api.get(`/bookings/${id}`),
  updateStatus: (id, status) => api.patch(`/bookings/${id}/status`, { status }),
  requestCancelOTP: (id) => api.post(`/bookings/${id}/request-cancel-otp`),
  cancel: (id, otp, reason) => api.patch(`/bookings/${id}/cancel`, { otp, reason }),
  reschedule: (id, newStartTime, reason) => api.patch(`/bookings/${id}/reschedule`, { newStartTime, reason }),
};

// Payment API
export const paymentAPI = {
  createCheckout: (bookingId) => api.post('/payment/create-checkout', { bookingId }),
  createGuestCheckout: (bookingId, email) => api.post('/payment/guest-checkout', { bookingId, email }),
  getByBooking: (bookingId) => api.get(`/payment/booking/${bookingId}`),
  getCustomerPayments: () => api.get('/payment/customer'),
  requestRefund: (paymentId, reason) => api.post(`/payment/${paymentId}/refund`, { reason }),
  verifyPayment: (sessionId) => api.get(`/payment/verify/${sessionId}`),
};

// Admin API
export const adminAPI = {
  getAnalytics: (params) => api.get('/admin/analytics', { params }),
  getProviderAnalytics: (providerId) => api.get(`/admin/analytics/provider/${providerId}`),
  getTrends: (days = 30) => api.get('/admin/analytics/trends', { params: { days } }),
  getAllBookings: (params) => api.get('/admin/bookings', { params }),
  getUsers: (params) => api.get('/admin/users', { params }),
  updateUser: (userId, data) => api.patch(`/admin/users/${userId}`, data),
  updateUserStatus: (userId, isActive) => api.patch(`/admin/users/${userId}/status`, { isActive }),
  updateUserRole: (userId, role) => api.patch(`/admin/users/${userId}/role`, { role }),
  getReports: (params) => api.get('/admin/reports', { params }),
  // Service management
  getAllServices: (params) => api.get('/admin/services', { params }),
  toggleServicePublish: (id, published) => api.patch(`/admin/services/${id}/publish`, { published }),
};

// Public Booking API (no auth required)
export const publicBookingAPI = {
  getProvider: (slug) => api.get(`/book/${slug}`),
  getServices: (slug) => api.get(`/book/${slug}/services`),
  getSlots: (slug, date, appointmentTypeId) => api.get(`/book/${slug}/slots`, { 
    params: { date, appointmentTypeId } 
  }),
  getAvailabilityRange: (slug, startDate, endDate, appointmentTypeId) => {
    const params = { startDate, endDate };
    if (appointmentTypeId) params.appointmentTypeId = appointmentTypeId;
    return api.get(`/book/${slug}/availability-range`, { params });
  },
  createBooking: (slug, data) => api.post(`/book/${slug}/book`, data),
  checkSlug: (slug) => api.get(`/book/check-slug/${slug}`),
};

// Private Booking API (no auth required - access via token)
export const privateBookingAPI = {
  getService: (token) => api.get(`/book/private/${token}`),
  getSlots: (token, date) => api.get(`/book/private/${token}/slots`, { 
    params: { date } 
  }),
  getAvailabilityRange: (token, startDate, endDate) => {
    return api.get(`/book/private/${token}/availability-range`, { 
      params: { startDate, endDate } 
    });
  },
  createBooking: (token, data) => api.post(`/book/private/${token}/book`, data),
};

export default api;
