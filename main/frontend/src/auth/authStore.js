import { create } from 'zustand';
import { authAPI } from '../api';

export const useAuthStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  token: localStorage.getItem('authToken') || null,
  isAuthenticated: !!localStorage.getItem('authToken'),
  isLoading: false,
  error: null,

  // Login
  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await authAPI.login({ email, password });
      const { user, token } = data.data;
      
      localStorage.setItem('authToken', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      set({ 
        user, 
        token, 
        isAuthenticated: true, 
        isLoading: false,
        error: null 
      });
      
      return { success: true, user };
    } catch (error) {
      console.error('Login error:', error);
      // Try multiple paths to get the error message
      const message = 
        error.response?.data?.message || 
        error.response?.data?.error || 
        error.message || 
        'Invalid email or password';
      set({ error: message, isLoading: false });
      return { success: false, error: message };
    }
  },

  // Signup
  signup: async (userData) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await authAPI.signup(userData);
      const { user, token } = data.data;
      
      localStorage.setItem('authToken', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      set({ 
        user, 
        token, 
        isAuthenticated: true, 
        isLoading: false,
        error: null 
      });
      
      return { success: true, user };
    } catch (error) {
      const message = error.response?.data?.message || 'Signup failed';
      set({ error: message, isLoading: false });
      return { success: false, error: message };
    }
  },

  // Logout
  logout: () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    set({ 
      user: null, 
      token: null, 
      isAuthenticated: false,
      error: null 
    });
  },

  // Fetch current user
  fetchUser: async () => {
    const token = get().token;
    if (!token) return;

    set({ isLoading: true });
    try {
      const { data } = await authAPI.me();
      const user = data.data.user;
      
      localStorage.setItem('user', JSON.stringify(user));
      set({ user, isLoading: false });
      
      return user;
    } catch (error) {
      get().logout();
      set({ isLoading: false });
    }
  },

  // Update user in store
  updateUser: (userData) => {
    const currentUser = get().user;
    const updatedUser = { ...currentUser, ...userData };
    localStorage.setItem('user', JSON.stringify(updatedUser));
    set({ user: updatedUser });
  },

  // Set user directly (for OTP verification)
  setUser: (user) => {
    localStorage.setItem('user', JSON.stringify(user));
    set({ user, isAuthenticated: true });
  },

  // Set token directly (for OTP verification)
  setToken: (token) => {
    localStorage.setItem('authToken', token);
    set({ token, isAuthenticated: true });
  },

  // Clear error
  clearError: () => set({ error: null }),

  // Check authentication status on app load
  checkAuth: async () => {
    const token = get().token;
    if (!token) {
      set({ isLoading: false });
      return;
    }

    set({ isLoading: true });
    try {
      const { data } = await authAPI.me();
      const user = data.data.user;
      
      localStorage.setItem('user', JSON.stringify(user));
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      // Token is invalid, clear auth state
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      set({ 
        user: null, 
        token: null, 
        isAuthenticated: false, 
        isLoading: false 
      });
    }
  },

  // Check if user has role
  hasRole: (role) => {
    const user = get().user;
    if (!user) return false;
    if (Array.isArray(role)) {
      return role.includes(user.role);
    }
    return user.role === role;
  },

  // Get role
  getRole: () => get().user?.role || null,
}));
