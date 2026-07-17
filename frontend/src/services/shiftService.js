import apiClient from './apiClient';

const SHIFTS = '/shifts';
const ASSIGNMENTS = '/shift-assignments';

export const listShifts = () => apiClient.get(SHIFTS).then((res) => res.data);
export const createShift = (payload) => apiClient.post(SHIFTS, payload).then((res) => res.data);
export const updateShift = (id, payload) => apiClient.put(`${SHIFTS}/${id}`, payload).then((res) => res.data);
export const deleteShift = (id) => apiClient.delete(`${SHIFTS}/${id}`).then((res) => res.data);

export const listAssignments = (params) => apiClient.get(ASSIGNMENTS, { params }).then((res) => res.data);
export const createAssignment = (payload) => apiClient.post(ASSIGNMENTS, payload).then((res) => res.data);
export const deleteAssignment = (id) => apiClient.delete(`${ASSIGNMENTS}/${id}`).then((res) => res.data);
