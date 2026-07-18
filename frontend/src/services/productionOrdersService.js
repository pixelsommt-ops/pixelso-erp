import apiClient from './apiClient';

const BASE = '/production-orders';

export const list = (params) => apiClient.get(BASE, { params }).then((res) => res.data);
export const getById = (id) => apiClient.get(`${BASE}/${id}`).then((res) => res.data);
export const create = (payload) => apiClient.post(BASE, payload).then((res) => res.data);
export const update = (id, payload) => apiClient.put(`${BASE}/${id}`, payload).then((res) => res.data);
export const setDetailMaterial = (poId, detailId, payload) =>
  apiClient.put(`${BASE}/${poId}/details/${detailId}/material`, payload).then((res) => res.data);
export const uploadReferenceImage = (dataUrl, filename) =>
  apiClient.post(`${BASE}/uploads`, { dataUrl, filename }).then((res) => res.data);
