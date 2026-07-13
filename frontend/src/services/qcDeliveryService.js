import apiClient from './apiClient';

const BASE = '/qc-delivery';

export const list = (params) => apiClient.get(BASE, { params }).then((res) => res.data);
export const getById = (id) => apiClient.get(`${BASE}/${id}`).then((res) => res.data);
export const create = (payload) => apiClient.post(BASE, payload).then((res) => res.data);
export const update = (id, payload) => apiClient.put(`${BASE}/${id}`, payload).then((res) => res.data);

export const listDeliveries = (params) => apiClient.get(`${BASE}/deliveries`, { params }).then((res) => res.data);
export const createDelivery = (payload) => apiClient.post(`${BASE}/deliveries`, payload).then((res) => res.data);
export const updateDelivery = (id, payload) =>
  apiClient.put(`${BASE}/deliveries/${id}`, payload).then((res) => res.data);
