import apiClient from './apiClient';

const BASE = '/marketing';

export const list = (params) => apiClient.get(BASE, { params }).then((res) => res.data);
export const getById = (id) => apiClient.get(`${BASE}/${id}`).then((res) => res.data);
export const create = (payload) => apiClient.post(BASE, payload).then((res) => res.data);
export const update = (id, payload) => apiClient.put(`${BASE}/${id}`, payload).then((res) => res.data);

export const getTopProducts = (params) => apiClient.get(`${BASE}/top-products`, { params }).then((res) => res.data);
export const getChannels = (params) => apiClient.get(`${BASE}/channels`, { params }).then((res) => res.data);
export const getRepeatCustomers = (params) =>
  apiClient.get(`${BASE}/repeat-customers`, { params }).then((res) => res.data);
export const getCohort = (params) => apiClient.get(`${BASE}/cohort`, { params }).then((res) => res.data);
