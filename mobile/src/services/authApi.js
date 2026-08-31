import { api, setTokens, clearTokens } from './apiClient';

const PREFIX = '/api/v1/auth';

export const authApi = {
  login: async (username, password) => {
    const data = await api.post(`${PREFIX}/login/`, { username, password });
    if (data?.data?.access) {
      await setTokens(data.data.access, data.data.refresh);
    }
    return data;
  },

  logout: async (refreshToken) => {
    try {
      await api.post(`${PREFIX}/logout/`, { refresh: refreshToken });
    } catch {
      // Logout is best-effort
    }
    await clearTokens();
  },

  register: async (userData) => {
    const data = await api.post(`${PREFIX}/register/`, userData);
    if (data?.data?.access) {
      await setTokens(data.data.access, data.data.refresh);
    }
    return data;
  },

  getProfile: () => api.get(`${PREFIX}/me/`),

  changePassword: (oldPassword, newPassword) =>
    api.post(`${PREFIX}/password/change/`, {
      old_password: oldPassword,
      new_password: newPassword,
    }),

  qrLogin: async (token) => {
    const data = await api.post(`${PREFIX}/qr-login/`, { token });
    if (data?.data?.access) {
      await setTokens(data.data.access, data.data.refresh);
    }
    return data;
  },
};
