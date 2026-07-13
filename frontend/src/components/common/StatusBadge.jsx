const VARIANT_MAP = {
  // sukses / selesai
  done: 'success',
  ready: 'success',
  paid: 'success',
  pass: 'success',
  completed: 'success',
  active: 'success',
  // proses / netral
  draft: 'info',
  approved: 'info',
  pos: 'info',
  material: 'info',
  queue: 'info',
  production: 'info',
  in_progress: 'info',
  partial: 'info',
  pending: 'info',
  idle: 'info',
  // perhatian
  qc: 'warning',
  hold: 'warning',
  rework: 'warning',
  busy: 'warning',
  unpaid: 'warning',
  // masalah
  complaint: 'danger',
  fail: 'danger',
  void: 'danger',
  cancelled: 'danger',
  inactive: 'danger',
};

export default function StatusBadge({ status }) {
  if (!status) return null;
  const variant = VARIANT_MAP[status] || 'default';
  const className = variant === 'default' ? 'badge' : `badge badge-${variant}`;
  return <span className={className}>{status.replace(/_/g, ' ')}</span>;
}
