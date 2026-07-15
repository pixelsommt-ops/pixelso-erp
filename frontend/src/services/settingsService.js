import apiClient from './apiClient';

const BASE = '/settings';

export const getSettings = () => apiClient.get(BASE).then((res) => res.data);
export const updateSettings = (payload) => apiClient.put(BASE, payload).then((res) => res.data);
export const uploadPhoto = (dataUrl, filename) =>
  apiClient.post(`${BASE}/uploads`, { dataUrl, filename }).then((res) => res.data);
