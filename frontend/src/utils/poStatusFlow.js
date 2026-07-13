// Cermin dari STATUS_TRANSITIONS di backend/src/modules/production-orders/production-orders.service.js
// Dipakai untuk menampilkan tombol transisi status yang valid saja di UI.
// Validasi sesungguhnya tetap dilakukan di backend.
export const PO_STATUS_TRANSITIONS = {
  draft: ['approved'],
  approved: ['pos', 'hold'],
  pos: ['material', 'hold'],
  material: ['queue', 'hold'],
  hold: ['material', 'queue', 'approved'],
  queue: ['production'],
  production: ['qc', 'hold'],
  qc: ['ready', 'rework'],
  rework: ['production'],
  ready: ['done', 'complaint'],
  complaint: ['rework', 'done'],
  done: [],
};

export const PO_STATUS_OPTIONS = Object.keys(PO_STATUS_TRANSITIONS);
