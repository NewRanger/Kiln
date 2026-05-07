import { getDefaultState } from './defaults.js';

const CURRENT_VERSION = 1;

export function migrate(state) {
  if (state == null) return getDefaultState();

  const defaults = getDefaultState();
  const result = { ...state };

  if (typeof result.version !== 'number') {
    result.version = CURRENT_VERSION;
  }

  for (const key of Object.keys(defaults)) {
    if (!(key in result) || result[key] == null) {
      result[key] = defaults[key];
    }
  }

  result.sprintCalendar = { ...defaults.sprintCalendar, ...result.sprintCalendar };
  result.now = { ...defaults.now, ...result.now };

  return result;
}
