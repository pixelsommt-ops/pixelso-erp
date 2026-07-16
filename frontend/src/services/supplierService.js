import apiClient from './apiClient';

const BASE = '/suppliers';

export const list = (params) => apiClient.get(BASE, { params }).then((res) => res.data);
export const create = (payload) => apiClient.post(BASE, payload).then((res) => res.data);
export const update = (id, payload) => apiClient.put(`${BASE}/${id}`, payload).then((res) => res.data);
export const deleteSupplier = (id) => apiClient.delete(`${BASE}/${id}`).then((res) => res.data);
