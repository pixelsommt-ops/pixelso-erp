import apiClient from './apiClient';

const BASE = '/notifications';

export const list = (params) => apiClient.get(BASE, { params }).then((res) => res.data);
export const getById = (id) => apiClient.get(`${BASE}/${id}`).then((res) => res.data);
export const create = (payload) => apiClient.post(BASE, payload).then((res) => res.data);
export const update = (id, payload) => apiClient.put(`${BASE}/${id}`, payload).then((res) => res.data);

export const markRead = (id) => update(id, { isRead: true });
export const markAllRead = () => apiClient.put(`${BASE}/mark-all-read`).then((res) => res.data);
