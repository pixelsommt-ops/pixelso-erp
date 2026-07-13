import apiClient from './apiClient';

const BASE = '/users';

export const list = (params) => apiClient.get(BASE, { params }).then((res) => res.data);
export const getById = (id) => apiClient.get(`${BASE}/${id}`).then((res) => res.data);
export const create = (payload) => apiClient.post(BASE, payload).then((res) => res.data);
export const update = (id, payload) => apiClient.put(`${BASE}/${id}`, payload).then((res) => res.data);

export const listRoles = () => apiClient.get(`${BASE}/roles`).then((res) => res.data);

export const listTeams = () => apiClient.get(`${BASE}/teams`).then((res) => res.data);
export const createTeam = (payload) => apiClient.post(`${BASE}/teams`, payload).then((res) => res.data);
