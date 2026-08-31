import { api } from './apiClient';

const PREFIX = '/api/v1/reports';

export const reportApi = {
  getSales: (params = {}) => api.get(`${PREFIX}/sales/`, params),
  getDashboardStats: () => api.get(`${PREFIX}/dashboard/`),
  getExpenses: (params = {}) => api.get(`${PREFIX}/expenses/`, params),
  createExpense: (data) => api.post(`${PREFIX}/expenses/`, data),
  getExpenseSummary: (params = {}) => api.get(`${PREFIX}/expenses/summary/`, params),
};
