// Pure auto-allocation logic.
// Sequencing:
//   - Design first, starting at topic.startAbs
//   - Middle and Backend run in parallel right after design ends
//   - Frontend starts +1 sprint after the later of (middle phase START,
//     backend phase START) when either has work, otherwise right after design
//
// Per-role overrides: topic.roleStartOverrides[role] (when not null) replaces
// the auto-computed natural start for that role. Subsequent assignments
// within the role still follow their parallel/sequential flags.
//
// Each role has an ordered list of assignments. Within a role, an assignment's
// start is determined by the previous assignment's parallel/sequential flag:
//   - sequential: starts where the previous one ended (or at the role's
//     natural start if it's the first)
//   - parallel: starts at the same sprint as the previous one
// A half (.5) on `sprints` means the last sprint of that assignment is marked
// half in `halfSprints`.

const STATUS_ORDER = { 'in-progress': 0, backlog: 1, done: 2 };

const ROLES = ['designer', 'frontend', 'middle', 'backend'];

export function autoAllocate(topic, developers, _quarters) {
  const busyUntil = {};
  for (const d of developers) busyUntil[d.id] = 0;
  return computeSchedule(topic, developers, busyUntil);
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
  const allocations = {};
  const halfSprints = {};
  const validDevIds = new Set(developers.map((d) => d.id));

  const assignments = topic.assignments || {
    designer: [],
    frontend: [],
    middle: [],
    backend: []
  };
  const overrides = topic.roleStartOverrides || {};

  const designAssignments = filterValid(assignments.designer, validDevIds);
  const middleAssignments = filterValid(assignments.middle, validDevIds);
  const backendAssignments = filterValid(assignments.backend, validDevIds);
  const frontendAssignments = filterValid(assignments.frontend, validDevIds);

  const designStart = resolveStart(overrides, 'designer', topic.startAbs);
  const { end: designEnd } = placeAssignments(
    allocations,
    halfSprints,
    designAssignments,
    designStart,
    busyUntil
  );

  const middleStartNatural = resolveStart(overrides, 'middle', designEnd);
  const { start: middleStart } = placeAssignments(
    allocations,
    halfSprints,
    middleAssignments,
    middleStartNatural,
    busyUntil
  );

  const backendStartNatural = resolveStart(overrides, 'backend', designEnd);
  const { start: backendStart } = placeAssignments(
    allocations,
    halfSprints,
    backendAssignments,
    backendStartNatural,
    busyUntil
  );

  const middleHas = middleAssignments.length > 0;
  const backendHas = backendAssignments.length > 0;
  let frontendAuto;
  if (!middleHas && !backendHas) {
    frontendAuto = designEnd;
  } else {
    let later = designEnd;
    if (middleHas) later = Math.max(later, middleStart);
    if (backendHas) later = Math.max(later, backendStart);
    frontendAuto = later + 1;
  }

  const frontendStart = resolveStart(overrides, 'frontend', frontendAuto);
  placeAssignments(
    allocations,
    halfSprints,
    frontendAssignments,
    frontendStart,
    busyUntil
  );

  return { allocations, halfSprints };
}

function resolveStart(overrides, role, autoStart) {
  const v = overrides?.[role];
  return v != null ? v : autoStart;
}

function placeAssignments(allocations, halfSprints, assignments, naturalStart, busyUntil) {
  let cursor = naturalStart;
  let prevStart = naturalStart;
  let phaseEnd = naturalStart;
  let phaseStart = naturalStart;
  let foundFirst = false;

  for (let i = 0; i < assignments.length; i++) {
    const a = assignments[i];
    if (!a.devId || !(a.sprints > 0)) continue;
    const span = Math.ceil(a.sprints);
    const isParallel = i > 0 && a.parallel;

    const computedStart = isParallel ? prevStart : cursor;
    const busy = busyUntil[a.devId] || 0;
    const actualStart = Math.max(computedStart, busy);
    const end = actualStart + span;

    if (!foundFirst) {
      phaseStart = actualStart;
      foundFirst = true;
    }

    for (let s = 0; s < span; s++) {
      pushSprint(allocations, a.devId, actualStart + s);
    }
    if (a.sprints % 1 === 0.5) {
      pushSprint(halfSprints, a.devId, actualStart + span - 1);
    }

    busyUntil[a.devId] = end;
    cursor = Math.max(cursor, end);
    prevStart = actualStart;
    if (end > phaseEnd) phaseEnd = end;
  }

  return { start: phaseStart, end: phaseEnd };
}

function filterValid(list, validDevIds) {
  if (!Array.isArray(list)) return [];
  return list.filter((a) => a && a.devId && validDevIds.has(a.devId));
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

function pushSprint(map, devId, sprint) {
  if (!map[devId]) map[devId] = [];
  map[devId].push(sprint);
}

// Sync a single dev's assignment in `topic.assignments` to match the dev's
// current allocation count. Used by manual paint / drag operations so the
// drawer stays in sync with the timeline.
//
// - If the dev now has 0 sprints allocated, drop their assignment from the
//   role's list (and reset the first remaining assignment's parallel flag).
// - If the dev has an existing assignment, update its sprint count.
// - Otherwise, append a new sequential assignment for the dev.
export function syncAssignmentForDev(topic, devId, devsById) {
  const dev = devsById?.[devId];
  if (!dev) return topic;
  const role = dev.role;
  if (!role) return topic;

  const allocations = topic.allocations || {};
  const halfSprints = topic.halfSprints || {};
  const sprints = allocations[devId] || [];
  const halfSet = new Set(halfSprints[devId] || []);

  let total = 0;
  for (const s of sprints) total += halfSet.has(s) ? 0.5 : 1;

  const baseAssignments = topic.assignments || {
    designer: [],
    frontend: [],
    middle: [],
    backend: []
  };
  const list = baseAssignments[role] || [];
  const idx = list.findIndex((a) => a.devId === devId);

  let newList;
  if (total <= 0) {
    if (idx === -1) return topic;
    newList = list.filter((_, i) => i !== idx);
    if (newList.length > 0 && newList[0].parallel) {
      newList = [{ ...newList[0], parallel: false }, ...newList.slice(1)];
    }
  } else if (idx === -1) {
    newList = [
      ...list,
      { devId, sprints: total, parallel: false }
    ];
  } else {
    newList = list.map((a, i) =>
      i === idx ? { ...a, sprints: total } : a
    );
  }

  return {
    ...topic,
    assignments: {
      ...baseAssignments,
      [role]: newList
    }
  };
}

// Convenience: sync multiple devs at once. Used by the eraser and other
// multi-dev paint operations.
export function syncAssignmentsForDevs(topic, devIds, devsById) {
  let updated = topic;
  for (const id of devIds) {
    updated = syncAssignmentForDev(updated, id, devsById);
  }
  return updated;
}

export { ROLES };
