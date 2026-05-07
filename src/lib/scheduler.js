// Pure auto-allocation logic.
// Sequencing:
//   - Design first, starting at topic.startAbs
//   - Middle and Backend run in parallel right after design ends
//   - Frontend starts +1 sprint after the later of (middle start, backend start)
//     when either has work, otherwise right after design
// Splits when devCount === 2:
//   - Integer estimates: ceil(N/2) to first dev, floor(N/2) to second
//   - Half estimates (e.g. 1.5): first dev gets the whole part, second dev
//     gets 1 sprint marked as half (in halfSprints) so the .5 reads as a
//     half-toned cell

const STATUS_ORDER = { 'in-progress': 0, backlog: 1, done: 2 };

const ROLE_TO_DEV_ROLE = {
  design: 'designer',
  frontend: 'frontend',
  middle: 'middle',
  backend: 'backend'
};

export function autoAllocate(topic, developers, _quarters) {
  return computeSchedule(topic, developers, {});
}

// Re-allocate a single role's sprints in this topic. Clears existing entries
// for every dev of the role on the topic's team, then redistributes `count`
// sprint-units across the first `devCount` devs starting at topic.startAbs.
// Half-step counts (e.g. 1.5) follow the same split rules as the auto-allocator.
export function applyRoleEstimate(topic, developers, role, count, devCount) {
  const devRole = ROLE_TO_DEV_ROLE[role];
  const allocations = { ...(topic.allocations || {}) };
  const halfSprints = { ...(topic.halfSprints || {}) };

  if (!devRole) return { allocations, halfSprints };

  const teamDevs = developers.filter((d) => d.teamId === topic.teamId);
  const allDevsOfRole = teamDevs.filter((d) => d.role === devRole);

  for (const dev of allDevsOfRole) {
    delete allocations[dev.id];
    delete halfSprints[dev.id];
  }

  if (count <= 0 || devCount <= 0 || allDevsOfRole.length === 0) {
    return { allocations, halfSprints };
  }

  const devsToUse = allDevsOfRole.slice(0, devCount);
  allocateRole(allocations, halfSprints, devsToUse, topic.startAbs, count, devCount);
  return { allocations, halfSprints };
}

// Re-schedule every unlocked topic, advancing a per-dev `busyUntil` cursor so
// no two topics claim the same dev in the same sprint. Locked topics keep
// their existing allocations and act as obstacles by baking their sprints
// into `busyUntil` upfront. Topics are processed in priority order (lower
// number first), then by status (in-progress before backlog before done),
// then by their original array order.
export function distribute(state) {
  const busyUntil = {};
  for (const dev of state.developers) {
    busyUntil[dev.id] = 1;
  }

  for (const topic of state.topics) {
    if (!topic.locked) continue;
    advanceBusyUntil(busyUntil, topic.allocations || {});
  }

  const ordered = state.topics
    .map((topic, index) => ({ topic, index }))
    .filter(({ topic }) => !topic.locked)
    .sort((a, b) => {
      const pa = a.topic.priority ?? 0;
      const pb = b.topic.priority ?? 0;
      if (pa !== pb) return pa - pb;
      const sa = STATUS_ORDER[a.topic.status] ?? 99;
      const sb = STATUS_ORDER[b.topic.status] ?? 99;
      if (sa !== sb) return sa - sb;
      return a.index - b.index;
    });

  const updates = new Map();
  for (const { topic } of ordered) {
    const teamDevs = state.developers.filter((d) => d.teamId === topic.teamId);
    const result = computeSchedule(topic, teamDevs, busyUntil);
    updates.set(topic.id, result);
    advanceBusyUntil(busyUntil, result.allocations);
  }

  const newTopics = state.topics.map((t) => {
    if (t.locked) return t;
    const result = updates.get(t.id);
    if (!result) return t;
    return {
      ...t,
      allocations: result.allocations,
      halfSprints: result.halfSprints
    };
  });

  return { ...state, topics: newTopics };
}

function computeSchedule(topic, developers, busyUntil) {
  const designDevs = developers
    .filter((d) => d.role === 'designer')
    .slice(0, topic.designDevCount);
  const middleDevs = developers
    .filter((d) => d.role === 'middle')
    .slice(0, topic.meDevCount);
  const backendDevs = developers
    .filter((d) => d.role === 'backend')
    .slice(0, topic.beDevCount);
  const frontendDevs = developers
    .filter((d) => d.role === 'frontend')
    .slice(0, topic.feDevCount);

  const maxBusy = (devList) => {
    let max = 0;
    for (const d of devList) {
      const b = busyUntil[d.id] || 0;
      if (b > max) max = b;
    }
    return max;
  };

  const designStart = Math.max(topic.startAbs, maxBusy(designDevs));
  const designSpan =
    topic.estimates.design > 0 ? Math.ceil(topic.estimates.design) : 0;
  const designEnd = designStart + designSpan;

  const middleStart = Math.max(designEnd, maxBusy(middleDevs));
  const backendStart = Math.max(designEnd, maxBusy(backendDevs));

  const hasMOrB =
    topic.estimates.middle > 0 || topic.estimates.backend > 0;
  let frontendStart = hasMOrB
    ? Math.max(designEnd, middleStart, backendStart) + 1
    : designEnd;
  frontendStart = Math.max(frontendStart, maxBusy(frontendDevs));

  const allocations = {};
  const halfSprints = {};

  allocateRole(allocations, halfSprints, designDevs, designStart, topic.estimates.design, topic.designDevCount);
  allocateRole(allocations, halfSprints, middleDevs, middleStart, topic.estimates.middle, topic.meDevCount);
  allocateRole(allocations, halfSprints, backendDevs, backendStart, topic.estimates.backend, topic.beDevCount);
  allocateRole(allocations, halfSprints, frontendDevs, frontendStart, topic.estimates.frontend, topic.feDevCount);

  return { allocations, halfSprints };
}

function allocateRole(allocations, halfSprints, devs, startSprint, estimate, devCount) {
  if (estimate <= 0 || devs.length === 0 || devCount <= 0) return;

  const actualDevCount = Math.min(devCount, devs.length);

  if (actualDevCount === 1) {
    const dev = devs[0];
    const span = Math.ceil(estimate);
    const sprints = rangeFrom(startSprint, span);
    pushSprints(allocations, dev.id, sprints);

    if (estimate % 1 === 0.5) {
      pushSprints(halfSprints, dev.id, [startSprint + span - 1]);
    }
    return;
  }

  const whole = Math.floor(estimate);
  const halfPart = estimate - whole;

  let firstCount;
  let secondCount;
  let secondIsHalf = false;

  if (halfPart === 0.5) {
    firstCount = whole;
    secondCount = 1;
    secondIsHalf = true;
  } else {
    firstCount = Math.ceil(estimate / 2);
    secondCount = Math.floor(estimate / 2);
  }

  if (firstCount > 0) {
    const sprints = rangeFrom(startSprint, firstCount);
    pushSprints(allocations, devs[0].id, sprints);
  }

  if (secondCount > 0) {
    const sprints = rangeFrom(startSprint, secondCount);
    pushSprints(allocations, devs[1].id, sprints);
    if (secondIsHalf) {
      pushSprints(halfSprints, devs[1].id, sprints);
    }
  }
}

function advanceBusyUntil(busyUntil, allocations) {
  for (const devId of Object.keys(allocations)) {
    const sprints = allocations[devId];
    if (!sprints || sprints.length === 0) continue;
    let last = sprints[0];
    for (const s of sprints) if (s > last) last = s;
    const candidate = last + 1;
    if (!busyUntil[devId] || busyUntil[devId] < candidate) {
      busyUntil[devId] = candidate;
    }
  }
}

function rangeFrom(start, count) {
  const result = [];
  for (let i = 0; i < count; i++) result.push(start + i);
  return result;
}

function pushSprints(map, devId, sprints) {
  if (!map[devId]) map[devId] = [];
  map[devId].push(...sprints);
}
