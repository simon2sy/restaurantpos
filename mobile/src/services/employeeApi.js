import { api, getAccessToken, ApiError } from './apiClient';
import { API_BASE_URL } from '../constants/config';

const PREFIX = '/api/v1/accounts';

export const employeeApi = {
  list: (params = {}) => api.get(`${PREFIX}/employees/`, params),
  get: (id) => api.get(`${PREFIX}/employees/${id}/`),
  create: (data) => api.post(`${PREFIX}/employees/`, data),
  update: (id, data) => api.put(`${PREFIX}/employees/${id}/`, data),
  toggle: (id) => api.post(`${PREFIX}/employees/${id}/toggle/`),
  delete: (id) => api.delete(`${PREFIX}/employees/${id}/`),
  getQR: (id) => api.get(`${PREFIX}/employees/${id}/qr/`),
  generateQR: (id, action = 'generate') =>
    api.post(`${PREFIX}/employees/${id}/qr/`, { action }),
  getActivities: (id) => api.get(`${PREFIX}/employees/${id}/activities/`),
  // Fetches the QR PNG with the auth header (fetch sends headers reliably,
  // unlike <Image>) and returns { uri: 'data:image/png;base64,...' } for <Image>.
  qrImageSource: async (id, cacheBuster) => {
    const token = await getAccessToken();
    const response = await fetch(
      `${API_BASE_URL}${PREFIX}/employees/${id}/qr/image/?t=${cacheBuster || Date.now()}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} }
    );
    if (!response.ok) {
      throw new ApiError(`Could not load QR image (${response.status}).`, response.status);
    }
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ uri: reader.result });
      reader.onerror = () => reject(new ApiError('Could not read QR image.', 0));
      reader.readAsDataURL(blob);
    });
  },
};
