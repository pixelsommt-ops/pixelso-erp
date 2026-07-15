import apiClient from './apiClient';

const BASE = '/pricing';

export const getAll = () => apiClient.get(BASE).then((res) => res.data);
export const updateSettings = (payload) => apiClient.put(`${BASE}/settings`, payload).then((res) => res.data);
export const createProduct = (payload) => apiClient.post(`${BASE}/products`, payload).then((res) => res.data);
export const updateProduct = (key, payload) => apiClient.put(`${BASE}/products/${key}`, payload).then((res) => res.data);
export const deleteProduct = (key) => apiClient.delete(`${BASE}/products/${key}`).then((res) => res.data);
export const uploadPhoto = (dataUrl, filename) =>
  apiClient.post(`${BASE}/uploads`, { dataUrl, filename }).then((res) => res.data);
