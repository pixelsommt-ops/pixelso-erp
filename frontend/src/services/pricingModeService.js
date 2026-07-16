import apiClient from './apiClient';

const BASE = '/pricing-modes';

export const list = () => apiClient.get(BASE).then((res) => res.data);
export const create = (payload) => apiClient.post(BASE, payload).then((res) => res.data);
export const update = (key, payload) => apiClient.put(`${BASE}/${key}`, payload).then((res) => res.data);
export const deleteMode = (key) => apiClient.delete(`${BASE}/${key}`).then((res) => res.data);
