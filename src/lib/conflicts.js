// Detects when the same developer is assigned to 2+ topics in the same sprint.
// Returns Map<devId, Map<absSprint, topicId[]>>, only including entries where
// topicIds.length >= 2. Half-sprints participate the same as full sprints —
// any double-assignment of (dev, sprint) is a conflict.

export function computeConflicts(state) {
  const conflicts = new Map();

  for (const topic of state.topics) {
    const allocations = topic.allocations || {};
    for (const devId of Object.keys(allocations)) {
      const sprints = allocations[devId] || [];
      for (const sprint of sprints) {
        if (!conflicts.has(devId)) conflicts.set(devId, new Map());
        const devSprints = conflicts.get(devId);
        if (!devSprints.has(sprint)) devSprints.set(sprint, []);
        devSprints.get(sprint).push(topic.id);
      }
    }
  }

  for (const [devId, sprintMap] of conflicts) {
    for (const [sprint, topicIds] of sprintMap) {
      if (topicIds.length < 2) sprintMap.delete(sprint);
    }
    if (sprintMap.size === 0) conflicts.delete(devId);
  }

  return conflicts;
}

// Flattens the conflicts map to a list of entries that involve `topicId`.
export function getTopicConflicts(conflicts, topicId) {
  const result = [];
  for (const [devId, sprintMap] of conflicts) {
    for (const [sprint, topicIds] of sprintMap) {
      if (!topicIds.includes(topicId)) continue;
      const otherTopicIds = topicIds.filter((id) => id !== topicId);
      result.push({ devId, sprint, otherTopicIds });
    }
  }
  return result;
}
