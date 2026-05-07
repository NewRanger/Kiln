import { getDefaultState } from './defaults.js';

const CURRENT_VERSION = 5;

const ROLES = ['designer', 'frontend', 'middle', 'backend'];
const COUNT_KEYS = {
  designer: 'designDevCount',
  frontend: 'feDevCount',
  middle: 'meDevCount',
  backend: 'beDevCount'
};
const ESTIMATE_KEYS = {
  designer: 'design',
  frontend: 'frontend',
  middle: 'middle',
  backend: 'backend'
};

export function migrate(state) {
  if (state == null) return getDefaultState();

  const defaults = getDefaultState();
  const result = { ...state };

  if (typeof result.version !== 'number') {
    result.version = 1;
  }

  for (const key of Object.keys(defaults)) {
    if (!(key in result) || result[key] == null) {
      result[key] = defaults[key];
    }
  }

  result.sprintCalendar = { ...defaults.sprintCalendar, ...result.sprintCalendar };
  result.now = { ...defaults.now, ...result.now };

  if (result.version < 4) {
    const developers = result.developers || [];
    result.topics = (result.topics || []).map((topic) => {
      const devsInTeam = developers.filter((d) => d.teamId === topic.teamId);
      return migrateAssignments(topic, devsInTeam);
    });
    result.version = 4;
  } else {
    result.topics = (result.topics || []).map((topic) => {
      if (topic.assignments) return topic;
      const devsInTeam = (result.developers || []).filter(
        (d) => d.teamId === topic.teamId
      );
      return migrateAssignments(topic, devsInTeam);
    });
  }

  if (result.version < 5) {
    result.topics = (result.topics || []).map((topic) =>
      topic.roleStartOverrides
        ? topic
        : { ...topic, roleStartOverrides: emptyOverrides() }
    );
    result.version = 5;
  } else {
    result.topics = (result.topics || []).map((topic) =>
      topic.roleStartOverrides
        ? topic
        : { ...topic, roleStartOverrides: emptyOverrides() }
    );
  }

  return result;
}

function emptyOverrides() {
  return { designer: null, frontend: null, middle: null, backend: null };
}

function migrateAssignments(topic, devsInTeam) {
  if (topic.assignments) return topic;

  const assignments = { designer: [], frontend: [], middle: [], backend: [] };

  for (const role of ROLES) {
    const total = topic.estimates?.[ESTIMATE_KEYS[role]] || 0;
    const count = topic[COUNT_KEYS[role]] ?? 1;
    if (total === 0 || count === 0) continue;

    const roleDevs = devsInTeam.filter((d) => d.role === role);
    if (roleDevs.length === 0) continue;

    if (count === 1) {
      assignments[role] = [
        { devId: roleDevs[0].id, sprints: total, parallel: false }
      ];
    } else {
      const first = Math.ceil(total / 2);
      const second = total - first;
      assignments[role] = [
        { devId: roleDevs[0].id, sprints: first, parallel: false }
      ];
      if (second > 0) {
        assignments[role].push({
          devId: roleDevs[1]?.id || roleDevs[0].id,
          sprints: second,
          parallel: true
        });
      }
    }
  }

  return { ...topic, assignments };
}
