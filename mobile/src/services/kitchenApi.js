import { api } from './apiClient';

const PREFIX = '/api/v1/kitchen';

export const kitchenApi = {
  getDashboard: () => api.get(`${PREFIX}/`),
  startBatch: (batchId) => api.post(`${PREFIX}/batch/${batchId}/start/`),
  markReady: (batchId) => api.post(`${PREFIX}/batch/${batchId}/ready/`),
  completeBatch: (batchId) => api.post(`${PREFIX}/batch/${batchId}/complete/`),
};
