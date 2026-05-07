import { totalSprintsInYear } from './schedule.js';

const ROLES = ['designer', 'frontend', 'middle', 'backend'];

export function computeCapacity(state) {
  const activeTeam = state.teams.find((t) => t.id === state.activeTeamId);
  const totalSprints = totalSprintsInYear(state.quarters);

  const empty = makeEmpty(state, totalSprints);
  if (!activeTeam) return empty;

  const teamDevs = state.developers.filter((d) => d.teamId === activeTeam.id);
  const teamTopics = state.topics.filter((t) => t.teamId === activeTeam.id);

  const devsByRole = { designer: [], frontend: [], middle: [], backend: [] };
  for (const d of teamDevs) {
    if (devsByRole[d.role]) devsByRole[d.role].push(d);
  }

  const byRole = {};
  let totalCapacity = 0;
  for (const role of ROLES) {
    const headcount = devsByRole[role].length;
    const productivity = activeTeam.roleProductivity?.[role] ?? 100;
    const capacity = headcount * totalSprints * (productivity / 100);
    byRole[role] = {
      capacity,
      planned: 0,
      percent: 0,
      headcount,
      productivity
    };
    totalCapacity += capacity;
  }

  const devToRole = {};
  for (const d of teamDevs) devToRole[d.id] = d.role;

  const plannedPerTopic = new Map();
  for (const topic of teamTopics) {
    let topicPlanned = 0;
    const allocations = topic.allocations || {};
    const halfSprints = topic.halfSprints || {};
    for (const devId of Object.keys(allocations)) {
      const role = devToRole[devId];
      if (!role || !byRole[role]) continue;
      const sprints = allocations[devId] || [];
      const halfSet = new Set(halfSprints[devId] || []);
      for (const sprint of sprints) {
        const value = halfSet.has(sprint) ? 0.5 : 1;
        byRole[role].planned += value;
        topicPlanned += value;
      }
    }
    plannedPerTopic.set(topic.id, topicPlanned);
  }

  let totalPlanned = 0;
  for (const role of ROLES) {
    totalPlanned += byRole[role].planned;
    byRole[role].percent =
      byRole[role].capacity > 0
        ? (byRole[role].planned / byRole[role].capacity) * 100
        : 0;
  }

  const freeDevSprints = Math.max(0, totalCapacity - totalPlanned);
  const utilizationPercent =
    totalCapacity > 0 ? (totalPlanned / totalCapacity) * 100 : 0;

  const byCategory = state.categories.map((c) => {
    const targetDevSprints = totalCapacity * (c.targetPercent / 100);
    let plannedDevSprints = 0;
    let topicCount = 0;
    for (const topic of teamTopics) {
      if (topic.categoryId !== c.id) continue;
      plannedDevSprints += plannedPerTopic.get(topic.id) || 0;
      topicCount++;
    }
    const plannedPercent =
      totalCapacity > 0 ? (plannedDevSprints / totalCapacity) * 100 : 0;
    const ratio = targetDevSprints > 0 ? plannedDevSprints / targetDevSprints : 0;
    let status;
    if (Math.abs(ratio - 1) < 0.1) status = 'on-track';
    else if (ratio < 1) status = 'under';
    else status = 'over';

    return {
      id: c.id,
      name: c.name,
      color: c.color,
      targetPercent: c.targetPercent,
      targetDevSprints,
      plannedDevSprints,
      plannedPercent,
      ratio,
      status,
      topicCount
    };
  });

  return {
    totalDevSprints: totalCapacity,
    plannedDevSprints: totalPlanned,
    freeDevSprints,
    utilizationPercent,
    byRole,
    byCategory
  };
}

function makeEmpty(state, totalSprints) {
  const byRole = {};
  for (const role of ROLES) {
    byRole[role] = {
      capacity: 0,
      planned: 0,
      percent: 0,
      headcount: 0,
      productivity: 0
    };
  }
  const byCategory = (state.categories || []).map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
    targetPercent: c.targetPercent,
    targetDevSprints: 0,
    plannedDevSprints: 0,
    plannedPercent: 0,
    ratio: 0,
    status: 'under',
    topicCount: 0
  }));
  return {
    totalDevSprints: 0,
    plannedDevSprints: 0,
    freeDevSprints: 0,
    utilizationPercent: 0,
    byRole,
    byCategory
  };
}
