import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { authApi } from '../services/authApi';
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from '../constants/config';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Check for existing token on mount
  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
      if (token) {
        const response = await authApi.getProfile();
        if (response?.data) {
          setUser(response.data);
          setIsLoggedIn(true);
        } else {
          await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
          await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
        }
      }
    } catch (error) {
      // Token expired or invalid
      await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    } finally {
      setLoading(false);
    }
  };

  const login = useCallback(async (username, password) => {
    const response = await authApi.login(username, password);
    if (response?.data?.user) {
      setUser(response.data.user);
      setIsLoggedIn(true);
      return response.data.user;
    }
    throw new Error(response?.message || 'Login failed');
  }, []);

  const register = useCallback(async (userData) => {
    const response = await authApi.register(userData);
    if (response?.data?.user) {
      setUser(response.data.user);
      setIsLoggedIn(true);
      return response.data.user;
    }
    throw new Error(response?.message || 'Registration failed');
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    await authApi.logout(refreshToken);
    setUser(null);
    setIsLoggedIn(false);
  }, []);

  const qrLogin = useCallback(async (token) => {
    const response = await authApi.qrLogin(token);
    if (response?.data?.user) {
      setUser(response.data.user);
      setIsLoggedIn(true);
      return response.data.user;
    }
    throw new Error(response?.message || 'QR login failed');
  }, []);

  const hasRole = useCallback(
    (...roles) => {
      if (!user) return false;
      if (user.is_superuser) return true;
      return roles.includes(user.role);
    },
    [user]
  );

  const isManager = hasRole('MANAGER');
  const isKitchen = hasRole('KITCHEN', 'MANAGER');
  const isCashier = hasRole('WAITER', 'CASHIER', 'MANAGER');
  const isDelivery = hasRole('DELIVERY', 'MANAGER');
  const isCustomer = user && !user.is_employee && !user.is_superuser;

  const value = {
    user,
    loading,
    isLoggedIn,
    login,
    register,
    logout,
    qrLogin,
    hasRole,
    isManager,
    isKitchen,
    isCashier,
    isDelivery,
    isCustomer,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
