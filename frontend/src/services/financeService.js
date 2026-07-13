import apiClient from './apiClient';

const BASE = '/finance';

export const list = (params) => apiClient.get(BASE, { params }).then((res) => res.data);
export const getById = (id) => apiClient.get(`${BASE}/${id}`).then((res) => res.data);
export const create = (payload) => apiClient.post(BASE, payload).then((res) => res.data);
export const update = (id, payload) => apiClient.put(`${BASE}/${id}`, payload).then((res) => res.data);

export const getRevenueReport = (params) =>
  apiClient.get(`${BASE}/reports/revenue`, { params }).then((res) => res.data);

export const autoCalculateBonus = (period) =>
  apiClient.post(`${BASE}/bonus/auto-calculate`, { period }).then((res) => res.data);
