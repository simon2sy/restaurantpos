import { api } from './apiClient';

const PREFIX = '/api/v1/orders';

export const orderApi = {
  list: (params = {}) => api.get(`${PREFIX}/`, params),
  getDetail: (id) => api.get(`${PREFIX}/${id}/`),
  create: (data) => api.post(`${PREFIX}/`, data),
  addItems: (orderId, items) => api.post(`${PREFIX}/${orderId}/add-items/`, { items }),
  updateStatus: (id, status) => api.patch(`${PREFIX}/${id}/status/`, { status }),
  payment: (orderId, paymentMethod) =>
    api.post(`${PREFIX}/${orderId}/payment/`, { payment_method: paymentMethod }),
  getSeating: () => api.get(`${PREFIX}/seating/`),
  cancel: (id) => api.delete(`${PREFIX}/${id}/`),
  // Tables
  listTables: () => api.get(`${PREFIX}/tables/`),
  createTable: (data) => api.post(`${PREFIX}/tables/`, data),
  updateTable: (id, data) => api.put(`${PREFIX}/tables/${id}/`, data),
  deleteTable: (id) => api.delete(`${PREFIX}/tables/${id}/`),
  // Cabins
  listCabins: () => api.get(`${PREFIX}/cabins/`),
  createCabin: (data) => api.post(`${PREFIX}/cabins/`, data),
  updateCabin: (id, data) => api.put(`${PREFIX}/cabins/${id}/`, data),
  deleteCabin: (id) => api.delete(`${PREFIX}/cabins/${id}/`),
};
