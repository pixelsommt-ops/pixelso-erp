import apiClient from './apiClient';

const BASE = '/themes';

export const list = () => apiClient.get(BASE).then((res) => res.data);
export const getById = (id) => apiClient.get(`${BASE}/${id}`).then((res) => res.data);
export const create = (payload) => apiClient.post(BASE, payload).then((res) => res.data);
export const update = (id, payload) => apiClient.put(`${BASE}/${id}`, payload).then((res) => res.data);
export const deleteTheme = (id) => apiClient.delete(`${BASE}/${id}`).then((res) => res.data);
export const activate = (id) => apiClient.put(`${BASE}/${id}/activate`).then((res) => res.data);
export const deactivate = (id) => apiClient.put(`${BASE}/${id}/deactivate`).then((res) => res.data);
