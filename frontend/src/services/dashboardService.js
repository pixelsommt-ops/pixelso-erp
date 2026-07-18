import apiClient from './apiClient';

const BASE = '/dashboard';

export const list = (params) => apiClient.get(BASE, { params }).then((res) => res.data);
export const getById = (id) => apiClient.get(`${BASE}/${id}`).then((res) => res.data);
export const create = (payload) => apiClient.post(BASE, payload).then((res) => res.data);
export const update = (id, payload) => apiClient.put(`${BASE}/${id}`, payload).then((res) => res.data);

export const getSummary = (params) => apiClient.get(`${BASE}/summary`, { params }).then((res) => res.data);
export const getMarketingSummary = () => apiClient.get(`${BASE}/marketing-summary`).then((res) => res.data);
