import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Eraser, StickyNote } from 'lucide-react';
import { computeConflicts, getTopicConflicts } from '../lib/conflicts.js';
import { genId } from '../lib/defaults.js';
import { absToQS, formatSprintRange, sprintDates } from '../lib/schedule.js';
import TopicDetail from './TopicDetail.jsx';

const ROLE_TRACKS = [
  { key: 'design', devRole: 'designer' },
  { key: 'frontend', devRole: 'frontend' },
  { key: 'middle', devRole: 'middle' },
  { key: 'backend', devRole: 'backend' }
];

const QUARTER_DATE_FMT = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric'
});

function formatQuarterDates(startAbs, sprintCount, calendar) {
  const start = sprintDates(startAbs, calendar).start;
  const end = sprintDates(startAbs + sprintCount - 1, calendar).end;
  return `${QUARTER_DATE_FMT.format(start)} — ${QUARTER_DATE_FMT.format(end)}`;
}

function makeNewTopic(state) {
  return {
    id: genId('topic'),
    name: 'New topic',
    status: 'backlog',
    teamId: state.activeTeamId,
    categoryId: state.categories[0]?.id ?? null,
    estimates: { design: 0, frontend: 0, middle: 0, backend: 0 },
    designDevCount: 1,
    feDevCount: 1,
    meDevCount: 1,
    beDevCount: 1,
    startAbs: 1,
    allocations: {},
    halfSprints: {},
    notes: '',
    priority: 0,
    locked: false,
    targetQuarter: null
  };
}

export default function RoadmapView({ state, setState }) {
  const { quarters } = state;
  const teamTopics = state.topics.filter((t) => t.teamId === state.activeTeamId);
  const [selectedTopicId, setSelectedTopicId] = useState(null);
  const [activeTool, setActiveTool] = useState(null);
  const selectedTopic =
    state.topics.find((t) => t.id === selectedTopicId) ?? null;

  const teamDevs = useMemo(
    () => state.developers.filter((d) => d.teamId === state.activeTeamId),
    [state.developers, state.activeTeamId]
  );

  const teamDevsByRole = useMemo(() => {
    const map = { designer: [], frontend: [], middle: [], backend: [] };
    for (const d of teamDevs) {
      if (map[d.role]) map[d.role].push(d);
    }
    return map;
  }, [teamDevs]);

  const quarterOffsets = useMemo(() => {
    const map = {};
    let cursor = 1;
    for (const q of quarters) {
      map[q.id] = cursor;
      cursor += q.sprintCount;
    }
    return map;
  }, [quarters]);

  const conflicts = useMemo(() => computeConflicts(state), [state.topics]);

  const devsById = useMemo(() => {
    const map = {};
    for (const d of state.developers) map[d.id] = d;
    return map;
  }, [state.developers]);

  const topicsById = useMemo(() => {
    const map = {};
    for (const t of state.topics) map[t.id] = t;
    return map;
  }, [state.topics]);

  const addTopic = () => {
    setState({
      ...state,
      topics: [...state.topics, makeNewTopic(state)]
    });
  };

  const updateTopic = (id, updates) => {
    setState({
      ...state,
      topics: state.topics.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      )
    });
  };

  const removeTopic = (id) => {
    setState({
      ...state,
      topics: state.topics.filter((t) => t.id !== id)
    });
    setSelectedTopicId(null);
  };

  const toggleTool = (tool) => {
    setActiveTool((curr) => (curr === tool ? null : tool));
  };

  const dragRef = useRef(null);
  const paintRef = useRef(null);
  const moveRef = useRef(null);

  useEffect(() => {
    return () => {
      if (dragRef.current?.cleanup) dragRef.current.cleanup();
      dragRef.current = null;
      if (paintRef.current?.cleanup) paintRef.current.cleanup();
      paintRef.current = null;
      if (moveRef.current?.cleanup) moveRef.current.cleanup();
      moveRef.current = null;
    };
  }, []);

  const paintAtSprint = (topicId, tool, absSprint, mode) => {
    setState((prev) => ({
      ...prev,
      topics: prev.topics.map((t) => {
        if (t.id !== topicId) return t;
        if (tool === 'eraser') return eraseAt(t, absSprint);
        if (mode === 'add') return addDevAt(t, tool, absSprint);
        if (mode === 'remove') return removeDevAt(t, tool, absSprint);
        return t;
      })
    }));
  };

  const handleCellMouseDown = (e, topic, absSprint) => {
    if (!activeTool) return;
    e.preventDefault();

    const tool = activeTool;
    const isDev = tool !== 'eraser';
    const primaryHadDev = isDev
      ? (topic.allocations?.[tool] || []).includes(absSprint)
      : false;

    const paint = {
      topicId: topic.id,
      tool,
      primaryAbsSprint: absSprint,
      primaryHadDev,
      hasMoved: false,
      visited: new Set([absSprint])
    };

    paintAtSprint(topic.id, tool, absSprint, 'add');

    const onMove = (mvE) => {
      const target = document.elementFromPoint(mvE.clientX, mvE.clientY);
      const cellEl = target?.closest('[data-abs-sprint]');
      if (!cellEl) return;
      const topicRow = cellEl.closest('.topic-row');
      if (!topicRow || topicRow.dataset.topicId !== paint.topicId) return;
      const sprint = parseInt(cellEl.dataset.absSprint, 10);
      if (Number.isNaN(sprint)) return;
      if (paint.visited.has(sprint)) return;

      paint.hasMoved = true;
      paint.visited.add(sprint);
      paintAtSprint(paint.topicId, paint.tool, sprint, 'add');
    };

    const onEnd = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.body.style.userSelect = '';

      if (!paint.hasMoved && isDev && paint.primaryHadDev) {
        paintAtSprint(paint.topicId, paint.tool, paint.primaryAbsSprint, 'remove');
      }
      paintRef.current = null;
    };

    paint.cleanup = onEnd;
    paintRef.current = paint;

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.body.style.userSelect = 'none';
  };

  const startDrag = (topic, devId, endSprint) => {
    const devSprints = (topic.allocations?.[devId] || [])
      .slice()
      .sort((a, b) => a - b);
    let runStart = endSprint;
    const idx = devSprints.indexOf(endSprint);
    for (let i = idx - 1; i >= 0; i--) {
      if (devSprints[i] === devSprints[i + 1] - 1) {
        runStart = devSprints[i];
      } else {
        break;
      }
    }

    const drag = {
      topicId: topic.id,
      devId,
      runStart,
      originalEnd: endSprint,
      lastEnd: endSprint,
      originalDevSprints: devSprints.slice()
    };

    const onMove = (e) => {
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const cell = target?.closest('[data-abs-sprint]');
      if (!cell) return;
      const sprint = parseInt(cell.dataset.absSprint, 10);
      if (Number.isNaN(sprint)) return;

      const newEnd = Math.max(drag.runStart, sprint);
      if (newEnd === drag.lastEnd) return;
      drag.lastEnd = newEnd;

      setState((prev) => ({
        ...prev,
        topics: prev.topics.map((t) => {
          if (t.id !== drag.topicId) return t;
          return resizeRun(
            t,
            drag.devId,
            drag.originalDevSprints,
            drag.runStart,
            drag.originalEnd,
            newEnd
          );
        })
      }));
    };

    const onEnd = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      dragRef.current = null;
    };

    drag.cleanup = onEnd;
    dragRef.current = drag;

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';
  };

  const startMove = (e, topic, devId, clickedSprint) => {
    if (activeTool) return;
    e.preventDefault();

    const devSprints = (topic.allocations?.[devId] || [])
      .slice()
      .sort((a, b) => a - b);
    const idx = devSprints.indexOf(clickedSprint);
    if (idx === -1) return;

    let lo = idx;
    while (lo > 0 && devSprints[lo - 1] === devSprints[lo] - 1) lo--;
    let hi = idx;
    while (
      hi < devSprints.length - 1 &&
      devSprints[hi + 1] === devSprints[hi] + 1
    ) {
      hi++;
    }

    const move = {
      topicId: topic.id,
      devId,
      originalDevSprints: devSprints,
      originalHalfDev: (topic.halfSprints?.[devId] || []).slice(),
      runStart: devSprints[lo],
      runEnd: devSprints[hi],
      pivotSprint: clickedSprint,
      lastOffset: 0
    };

    const onMove = (mvE) => {
      const target = document.elementFromPoint(mvE.clientX, mvE.clientY);
      const cellEl = target?.closest('[data-abs-sprint]');
      if (!cellEl) return;
      const sprint = parseInt(cellEl.dataset.absSprint, 10);
      if (Number.isNaN(sprint)) return;

      let offset = sprint - move.pivotSprint;
      if (move.runStart + offset < 1) offset = 1 - move.runStart;
      if (offset === move.lastOffset) return;
      move.lastOffset = offset;

      setState((prev) => ({
        ...prev,
        topics: prev.topics.map((t) => {
          if (t.id !== move.topicId) return t;
          return moveRunOf(t, move, offset);
        })
      }));
    };

    const onEnd = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.body.classList.remove('body-grabbing');
      document.body.style.userSelect = '';
      moveRef.current = null;
    };

    move.cleanup = onEnd;
    moveRef.current = move;

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.body.classList.add('body-grabbing');
    document.body.style.userSelect = 'none';
  };

  return (
    <div className="roadmap">
      <div className="paint-toolbar">
        <div className="paint-toolbar-inner">
          <span className="paint-toolbar-label">Paint:</span>
          <div className="paint-chips">
            {teamDevs.map((d) => (
              <button
                key={d.id}
                type="button"
                className={`paint-chip${activeTool === d.id ? ' paint-chip-active' : ''}`}
                style={{ backgroundColor: `#${d.color}` }}
                onClick={() => toggleTool(d.id)}
                title={d.name}
              >
                {d.name}
              </button>
            ))}
            <button
              type="button"
              className={`paint-chip paint-chip-eraser${activeTool === 'eraser' ? ' paint-chip-active' : ''}`}
              onClick={() => toggleTool('eraser')}
              aria-label="Erase"
              title="Erase"
            >
              <Eraser size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="quarter-row">
        <div className="row-corner" />
        {quarters.map((q) => (
          <div
            key={q.id}
            className="quarter-block"
            style={{
              width: `calc(${q.sprintCount} * var(--sprint-width))`,
              backgroundColor: `#${q.color}`
            }}
          >
            <div className="quarter-block-title">
              <span className="quarter-block-label">{q.name}</span>
              <span className="quarter-block-meta">— {q.sprintCount} sprints</span>
            </div>
            <div className="quarter-block-dates">
              {formatQuarterDates(
                quarterOffsets[q.id],
                q.sprintCount,
                state.sprintCalendar
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="sprint-row">
        <div className="row-corner" />
        {quarters.map((q) => (
          <div key={q.id} className="sprint-row-group">
            {Array.from({ length: q.sprintCount }, (_, i) => {
              const absSprint = quarterOffsets[q.id] + i;
              return (
                <SprintHeaderCell
                  key={i}
                  quarterName={q.name}
                  sprintInQuarter={i + 1}
                  dateRange={formatSprintRange(absSprint, state.sprintCalendar)}
                />
              );
            })}
          </div>
        ))}
      </div>

      {teamTopics.map((t) => {
        const topicConflicts = getTopicConflicts(conflicts, t.id);
        const hasConflicts = topicConflicts.length > 0;
        const hasNotes = (t.notes ?? '').trim().length > 0;
        return (
          <div className="topic-row" key={t.id} data-topic-id={t.id}>
            <button
              type="button"
              className={`topic-name${hasConflicts ? ' topic-name-conflict' : ''}`}
              onClick={() => setSelectedTopicId(t.id)}
            >
              {hasNotes && <NoteBadge notes={t.notes} />}
              {hasConflicts && (
                <ConflictBadge
                  topicConflicts={topicConflicts}
                  devsById={devsById}
                  topicsById={topicsById}
                  quarters={quarters}
                />
              )}
              <span className="topic-name-text">{t.name}</span>
            </button>
            <div className="topic-tracks">
              {ROLE_TRACKS.map(({ key, devRole }) => (
                <div key={key} className="track">
                  {quarters.map((q) => (
                    <div key={q.id} className="track-cells-group">
                      {Array.from({ length: q.sprintCount }, (_, i) => {
                        const absSprint = quarterOffsets[q.id] + i;
                        const cellDevs = devsInTrack(
                          t,
                          absSprint,
                          devRole,
                          teamDevsByRole
                        ).map((d) => ({
                          ...d,
                          isRightEdge: !(t.allocations?.[d.dev.id] || []).includes(absSprint + 1)
                        }));
                        const isConflict = cellDevs.some(({ dev }) =>
                          (conflicts.get(dev.id)?.get(absSprint)?.length ?? 0) >= 2
                        );
                        return (
                          <TrackCell
                            key={i}
                            absSprint={absSprint}
                            devs={cellDevs}
                            paintActive={activeTool != null}
                            isConflict={isConflict}
                            onPaint={(e) => handleCellMouseDown(e, t, absSprint)}
                            onDragStart={(devId) => startDrag(t, devId, absSprint)}
                            onMoveStart={(e, devId) =>
                              startMove(e, t, devId, absSprint)
                            }
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {teamTopics.length === 0 ? (
        <div className="roadmap-empty">
          <p className="roadmap-empty-text">No topics yet</p>
          <button type="button" className="add-button" onClick={addTopic}>
            + Add topic
          </button>
        </div>
      ) : (
        <div className="roadmap-add-topic">
          <button type="button" className="add-button" onClick={addTopic}>
            + Add topic
          </button>
        </div>
      )}

      {selectedTopic && (
        <TopicDetail
          topic={selectedTopic}
          state={state}
          onUpdate={(updates) => updateTopic(selectedTopic.id, updates)}
          onDelete={() => removeTopic(selectedTopic.id)}
          onClose={() => setSelectedTopicId(null)}
        />
      )}
    </div>
  );
}

function SprintHeaderCell({ quarterName, sprintInQuarter, dateRange }) {
  return (
    <div className="sprint-cell">
      S{sprintInQuarter}
      <div className="sprint-tooltip" role="tooltip">
        <div className="sprint-tooltip-label">
          {quarterName} S{sprintInQuarter}
        </div>
        <div className="sprint-tooltip-date">{dateRange}</div>
      </div>
    </div>
  );
}

function NoteBadge({ notes }) {
  const display = notes.length > 300 ? `${notes.slice(0, 280)}…` : notes;
  return (
    <span
      className="topic-note-icon-wrap"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <StickyNote size={14} className="topic-note-icon" />
      <span className="topic-note-tooltip" role="tooltip">{display}</span>
    </span>
  );
}

function ConflictBadge({ topicConflicts, devsById, topicsById, quarters }) {
  const sorted = [...topicConflicts].sort((a, b) => {
    if (a.sprint !== b.sprint) return a.sprint - b.sprint;
    const aName = devsById[a.devId]?.name ?? '';
    const bName = devsById[b.devId]?.name ?? '';
    return aName.localeCompare(bName);
  });
  const visible = sorted.slice(0, 5);
  const extra = Math.max(0, sorted.length - 5);

  const formatLine = (c) => {
    const devName = devsById[c.devId]?.name ?? 'Unknown';
    const others = c.otherTopicIds
      .map((id) => topicsById[id]?.name ?? '?')
      .join(', ');
    const qs = absToQS(c.sprint, quarters);
    const sprintLabel = qs ? `${qs.quarter.name} S${qs.sprint}` : `S${c.sprint}`;
    return `${devName} also assigned to ${others} at ${sprintLabel}`;
  };

  return (
    <span
      className="topic-conflict-icon-wrap"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <AlertTriangle size={14} className="topic-conflict-icon" />
      <span className="topic-conflict-tooltip" role="tooltip">
        <span className="topic-conflict-tooltip-title">Resource conflicts:</span>
        <span className="topic-conflict-tooltip-list">
          {visible.map((c, i) => (
            <span key={i} className="topic-conflict-tooltip-item">
              · {formatLine(c)}
            </span>
          ))}
          {extra > 0 && (
            <span className="topic-conflict-tooltip-more">+ {extra} more</span>
          )}
        </span>
      </span>
    </span>
  );
}

function devsInTrack(topic, absSprint, devRole, teamDevsByRole) {
  const devs = teamDevsByRole[devRole] || [];
  const allocations = topic.allocations || {};
  const halfSprints = topic.halfSprints || {};
  const result = [];
  for (const dev of devs) {
    const sprints = allocations[dev.id];
    if (!sprints || !sprints.includes(absSprint)) continue;
    const isHalf = (halfSprints[dev.id] || []).includes(absSprint);
    result.push({ dev, isHalf });
  }
  return result;
}

function TrackCell({
  absSprint,
  devs,
  paintActive,
  isConflict,
  onPaint,
  onDragStart,
  onMoveStart
}) {
  const classes = ['track-cell'];
  if (paintActive) classes.push('track-cell-paintable');
  if (isConflict) classes.push('track-cell-conflict');
  return (
    <div
      className={classes.join(' ')}
      data-abs-sprint={absSprint}
      onMouseDown={paintActive ? onPaint : undefined}
    >
      {devs.length > 0 && (
        <div className="track-cell-fills">
          {devs.map(({ dev, isHalf, isRightEdge }) => (
            <div
              key={dev.id}
              className={`track-cell-fill${isHalf ? ' track-cell-fill-half' : ''}`}
              style={{ backgroundColor: `#${dev.color}` }}
              title={`${dev.name}${isHalf ? ' (half sprint)' : ''}`}
              onMouseDown={
                paintActive ? undefined : (e) => onMoveStart(e, dev.id)
              }
            >
              {isRightEdge && (
                <div
                  className="track-cell-fill-handle"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onDragStart(dev.id);
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function moveRunOf(topic, move, offset) {
  const { devId, originalDevSprints, originalHalfDev, runStart, runEnd } = move;

  const otherDevSprints = originalDevSprints.filter(
    (s) => s < runStart || s > runEnd
  );
  const newRunSprints = [];
  for (let s = runStart; s <= runEnd; s++) newRunSprints.push(s + offset);
  const allDevSprints = Array.from(
    new Set([...otherDevSprints, ...newRunSprints])
  ).sort((a, b) => a - b);

  const otherHalfDev = originalHalfDev.filter(
    (s) => s < runStart || s > runEnd
  );
  const movedHalfDev = originalHalfDev
    .filter((s) => s >= runStart && s <= runEnd)
    .map((s) => s + offset);
  const allDevSprintsSet = new Set(allDevSprints);
  const allHalfDev = Array.from(
    new Set([...otherHalfDev, ...movedHalfDev])
  )
    .filter((s) => allDevSprintsSet.has(s))
    .sort((a, b) => a - b);

  const allocations = { ...(topic.allocations || {}) };
  const halfSprints = { ...(topic.halfSprints || {}) };

  if (allDevSprints.length > 0) allocations[devId] = allDevSprints;
  else delete allocations[devId];

  if (allHalfDev.length > 0) halfSprints[devId] = allHalfDev;
  else delete halfSprints[devId];

  return { ...topic, allocations, halfSprints };
}

function resizeRun(topic, devId, originalDevSprints, runStart, originalEnd, newEnd) {
  const allocations = { ...(topic.allocations || {}) };
  const halfSprints = { ...(topic.halfSprints || {}) };

  const otherSprints = originalDevSprints.filter(
    (s) => s < runStart || s > originalEnd
  );
  const newRun = [];
  for (let s = runStart; s <= newEnd; s++) newRun.push(s);
  const merged = Array.from(new Set([...otherSprints, ...newRun])).sort(
    (a, b) => a - b
  );

  if (merged.length > 0) allocations[devId] = merged;
  else delete allocations[devId];

  const halfDevSprints = (halfSprints[devId] || []).filter((s) =>
    merged.includes(s)
  );
  if (halfDevSprints.length > 0) halfSprints[devId] = halfDevSprints;
  else delete halfSprints[devId];

  return { ...topic, allocations, halfSprints };
}

function addDevAt(topic, devId, absSprint) {
  const existing = topic.allocations?.[devId] || [];
  if (existing.includes(absSprint)) return topic;
  return {
    ...topic,
    allocations: {
      ...(topic.allocations || {}),
      [devId]: [...existing, absSprint]
    }
  };
}

function removeDevAt(topic, devId, absSprint) {
  const existing = topic.allocations?.[devId] || [];
  if (!existing.includes(absSprint)) return topic;

  const allocations = { ...(topic.allocations || {}) };
  const halfSprints = { ...(topic.halfSprints || {}) };

  const filtered = existing.filter((s) => s !== absSprint);
  if (filtered.length > 0) allocations[devId] = filtered;
  else delete allocations[devId];

  if (halfSprints[devId]?.includes(absSprint)) {
    const filteredHalf = halfSprints[devId].filter((s) => s !== absSprint);
    if (filteredHalf.length > 0) halfSprints[devId] = filteredHalf;
    else delete halfSprints[devId];
  }

  return { ...topic, allocations, halfSprints };
}

function eraseAt(topic, absSprint) {
  const allocations = { ...(topic.allocations || {}) };
  const halfSprints = { ...(topic.halfSprints || {}) };

  for (const devId of Object.keys(allocations)) {
    const sprints = allocations[devId];
    if (!sprints.includes(absSprint)) continue;
    const filtered = sprints.filter((s) => s !== absSprint);
    if (filtered.length > 0) allocations[devId] = filtered;
    else delete allocations[devId];
  }

  for (const devId of Object.keys(halfSprints)) {
    const sprints = halfSprints[devId];
    if (!sprints.includes(absSprint)) continue;
    const filtered = sprints.filter((s) => s !== absSprint);
    if (filtered.length > 0) halfSprints[devId] = filtered;
    else delete halfSprints[devId];
  }

  return { ...topic, allocations, halfSprints };
}
