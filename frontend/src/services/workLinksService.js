import apiClient from './apiClient';

const BASE = '/work-links';

export const list = (params) => apiClient.get(BASE, { params }).then((res) => res.data);
export const create = (payload) => apiClient.post(BASE, payload).then((res) => res.data);
export const deleteLink = (id) => apiClient.delete(`${BASE}/${id}`).then((res) => res.data);
export const recordClick = (id) => apiClient.post(`${BASE}/${id}/click`).then((res) => res.data);
export const listClicks = (id) => apiClient.get(`${BASE}/${id}/clicks`).then((res) => res.data);
