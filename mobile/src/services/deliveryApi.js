import { api } from './apiClient';

const PREFIX = '/api/v1/delivery';

export const deliveryApi = {
  list: (params = {}) => api.get(`${PREFIX}/`, params),
  getDetail: (id) => api.get(`${PREFIX}/${id}/`),
  create: (data) => api.post(`${PREFIX}/`, data),
  getDue: () => api.get(`${PREFIX}/due/`),
  assign: (id, personId) => api.post(`${PREFIX}/${id}/assign/`, { delivery_person_id: personId }),
  updateStatus: (id, status) => api.patch(`${PREFIX}/${id}/status/`, { status }),

  // Delivery persons
  listPersons: () => api.get(`${PREFIX}/persons/`),
  getPerson: (id) => api.get(`${PREFIX}/persons/${id}/`),
  createPerson: (data) => api.post(`${PREFIX}/persons/`, data),
  updatePerson: (id, data) => api.put(`${PREFIX}/persons/${id}/`, data),
  deletePerson: (id) => api.delete(`${PREFIX}/persons/${id}/`),
};
