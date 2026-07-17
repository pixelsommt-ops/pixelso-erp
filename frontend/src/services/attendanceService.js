import apiClient from './apiClient';

const BASE = '/attendance';

export const list = (params) => apiClient.get(BASE, { params }).then((res) => res.data);
export const checkIn = (payload) => apiClient.post(`${BASE}/check-in`, payload).then((res) => res.data);
export const checkOut = (payload) => apiClient.post(`${BASE}/check-out`, payload).then((res) => res.data);
