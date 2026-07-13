// PO status lifecycle - PRD section 3.5
const PO_STATUS = {
  DRAFT: 'draft',
  APPROVED: 'approved',
  POS: 'pos',
  MATERIAL: 'material',
  HOLD: 'hold',
  QUEUE: 'queue',
  PRODUCTION: 'production',
  QC: 'qc',
  READY: 'ready',
  REWORK: 'rework',
  COMPLAINT: 'complaint',
  DONE: 'done',
};

// Roles - PRD section 3.1 Persona Pengguna dan Hak Akses
const ROLES = {
  DESIGNER: 'designer',
  CASHIER: 'cashier',
  PRODUCTION: 'production',
  INVENTORY: 'inventory',
  FINANCE: 'finance',
  MARKETING: 'marketing',
  HRD: 'hrd',
  MANAGER: 'manager',
};

module.exports = { PO_STATUS, ROLES };
