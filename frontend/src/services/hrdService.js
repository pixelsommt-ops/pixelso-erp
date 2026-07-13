import apiClient from './apiClient';

const BASE = '/hrd';

export const list = (params) => apiClient.get(BASE, { params }).then((res) => res.data);
export const getById = (id) => apiClient.get(`${BASE}/${id}`).then((res) => res.data);
export const create = (payload) => apiClient.post(BASE, payload).then((res) => res.data);
export const update = (id, payload) => apiClient.put(`${BASE}/${id}`, payload).then((res) => res.data);

export const getProductivityReport = (params) =>
  apiClient.get(`${BASE}/reports/productivity`, { params }).then((res) => res.data);
export const getRanking = (params) => apiClient.get(`${BASE}/reports/ranking`, { params }).then((res) => res.data);
