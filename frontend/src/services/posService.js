import apiClient from './apiClient';

const BASE = '/pos';

export const list = (params) => apiClient.get(BASE, { params }).then((res) => res.data);
export const getById = (id) => apiClient.get(`${BASE}/${id}`).then((res) => res.data);
export const getQuote = (poId) => apiClient.get(`${BASE}/quote/${poId}`).then((res) => res.data);
export const create = (payload) => apiClient.post(BASE, payload).then((res) => res.data);
export const update = (id, payload) => apiClient.put(`${BASE}/${id}`, payload).then((res) => res.data);

export const addPayment = (id, payment) => update(id, { payment });
export const voidSale = (id) => update(id, { void: true });

export const confirmPayment = (saleId, paymentId, action) =>
  apiClient.put(`${BASE}/${saleId}/payments/${paymentId}`, { action }).then((res) => res.data);
