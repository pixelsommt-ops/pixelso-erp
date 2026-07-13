import apiClient from './apiClient';

const BASE = '/production';

export const list = (params) => apiClient.get(BASE, { params }).then((res) => res.data);
export const getById = (id) => apiClient.get(`${BASE}/${id}`).then((res) => res.data);
export const create = (payload) => apiClient.post(BASE, payload).then((res) => res.data);
export const update = (id, payload) => apiClient.put(`${BASE}/${id}`, payload).then((res) => res.data);

export const listMachines = (params) => apiClient.get(`${BASE}/machines`, { params }).then((res) => res.data);
export const createMachine = (payload) => apiClient.post(`${BASE}/machines`, payload).then((res) => res.data);
