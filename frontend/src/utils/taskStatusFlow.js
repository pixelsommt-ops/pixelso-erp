// Cermin dari TASK_TRANSITIONS di backend/src/modules/production/production.service.js
export const TASK_STATUS_TRANSITIONS = {
  queue: ['in_progress'],
  in_progress: ['done', 'rework'],
  rework: ['in_progress'],
  done: ['rework'],
};

export const TASK_STATUS_OPTIONS = Object.keys(TASK_STATUS_TRANSITIONS);
