import apiClient from './apiClient';

const BASE = '/categories';

export const list = () => apiClient.get(BASE).then((res) => res.data);
export const create = (payload) => apiClient.post(BASE, payload).then((res) => res.data);
export const update = (id, payload) => apiClient.put(`${BASE}/${id}`, payload).then((res) => res.data);
export const deleteCategory = (id) => apiClient.delete(`${BASE}/${id}`).then((res) => res.data);
