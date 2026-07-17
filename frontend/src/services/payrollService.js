import apiClient from './apiClient';

const BASE = '/payroll';

export const listRuns = () => apiClient.get(`${BASE}/runs`).then((res) => res.data);
export const getRunById = (id) => apiClient.get(`${BASE}/runs/${id}`).then((res) => res.data);
export const createRun = (period) => apiClient.post(`${BASE}/runs`, { period }).then((res) => res.data);
export const finalizeRun = (id) => apiClient.post(`${BASE}/runs/${id}/finalize`).then((res) => res.data);
export const updateItem = (id, payload) => apiClient.put(`${BASE}/items/${id}`, payload).then((res) => res.data);
