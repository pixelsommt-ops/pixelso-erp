import apiClient from './apiClient';

const BASE = '/promos';

export const getAll = () => apiClient.get(BASE).then((res) => res.data);
export const createPromo = (payload) => apiClient.post(BASE, payload).then((res) => res.data);
export const updatePromo = (id, payload) => apiClient.put(`${BASE}/${id}`, payload).then((res) => res.data);
export const deletePromo = (id) => apiClient.delete(`${BASE}/${id}`).then((res) => res.data);
export const uploadPhoto = (dataUrl, filename) =>
  apiClient.post(`${BASE}/uploads`, { dataUrl, filename }).then((res) => res.data);
