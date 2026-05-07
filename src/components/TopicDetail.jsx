import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, MoveHorizontal, Plus, Trash2, X } from 'lucide-react';
import { autoAllocate } from '../lib/scheduler.js';
import SprintPicker from './SprintPicker.jsx';

const STATUSES = [
  { value: 'done', label: 'Done' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'backlog', label: 'Backlog' }
];

const ROLE_CARDS = [
  { role: 'designer', label: 'Designer' },
  { role: 'frontend', label: 'Frontend' },
  { role: 'middle', label: 'Middle' },
  { role: 'backend', label: 'Backend' }
];

function clampSprints(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n * 2) / 2);
}

function fmtTotal(n) {
  return Math.round((n ?? 0) * 10) / 10;
}

function emptyAssignments() {
  return { designer: [], frontend: [], middle: [], backend: [] };
}

export default function TopicDetail({ topic, state, onUpdate, onDelete, onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const topicTeam = state.teams.find((t) => t.id === topic.teamId);

  const teamDevsByRole = useMemo(() => {
    const map = { designer: [], frontend: [], middle: [], backend: [] };
    for (const d of state.developers) {
      if (d.teamId !== topic.teamId) continue;
      if (map[d.role]) map[d.role].push(d);
    }
    return map;
  }, [state.developers, topic.teamId]);

  const assignments = topic.assignments || emptyAssignments();
  const overrides = topic.roleStartOverrides || {
    designer: null,
    frontend: null,
    middle: null,
    backend: null
  };

  const [pendingChanges, setPendingChanges] = useState(false);

  const handleDelete = () => {
    if (!window.confirm(`Delete topic "${topic.name}"?`)) return;
    onDelete();
  };

  const handleAutoAllocate = () => {
    if (!window.confirm('Replace existing allocations?')) return;
    const teamDevs = state.developers.filter(
      (d) => d.teamId === topic.teamId
    );
    const result = autoAllocate(topic, teamDevs, state.quarters);
    onUpdate({
      allocations: result.allocations,
      halfSprints: result.halfSprints
    });
    setPendingChanges(false);
  };

  const normalizeFirst = (list) =>
    list.map((a, i) => (i === 0 ? { ...a, parallel: false } : a));

  const updateRoleList = (role, newList, extraUpdates = {}) => {
    onUpdate({
      assignments: { ...assignments, [role]: normalizeFirst(newList) },
      ...extraUpdates
    });
  };

  const handleAddAssignment = (role) => {
    const roleDevs = teamDevsByRole[role] || [];
    if (roleDevs.length === 0) return;
    const list = assignments[role] || [];
    const firstFree = roleDevs.find(
      (d) => !list.some((a) => a.devId === d.id)
    );
    const devId = (firstFree || roleDevs[0]).id;
    updateRoleList(role, [
      ...list,
      { devId, sprints: 1, parallel: false }
    ]);
    setPendingChanges(true);
  };

  const handleChangeDev = (role, idx, newDevId) => {
    const list = assignments[role] || [];
    const oldDevId = list[idx]?.devId;
    const newList = list.map((a, i) =>
      i === idx ? { ...a, devId: newDevId } : a
    );

    if (!oldDevId || !newDevId || oldDevId === newDevId) {
      updateRoleList(role, newList);
      return;
    }

    const allocations = { ...(topic.allocations || {}) };
    const halfSprints = { ...(topic.halfSprints || {}) };

    const oldSprints = allocations[oldDevId] || [];
    if (oldSprints.length > 0) {
      const merged = Array.from(
        new Set([...(allocations[newDevId] || []), ...oldSprints])
      ).sort((x, y) => x - y);
      allocations[newDevId] = merged;
      delete allocations[oldDevId];
    }

    const oldHalves = halfSprints[oldDevId] || [];
    if (oldHalves.length > 0) {
      const mergedHalf = Array.from(
        new Set([...(halfSprints[newDevId] || []), ...oldHalves])
      ).sort((x, y) => x - y);
      halfSprints[newDevId] = mergedHalf;
      delete halfSprints[oldDevId];
    }

    updateRoleList(role, newList, { allocations, halfSprints });
  };

  const handleChangeSprints = (role, idx, value) => {
    const newSprintsValue = clampSprints(value);
    const list = assignments[role] || [];
    const a = list[idx];
    if (!a) return;

    const devId = a.devId;
    const newList = list.map((x, i) =>
      i === idx ? { ...x, sprints: newSprintsValue } : x
    );

    if (!devId) {
      updateRoleList(role, newList);
      return;
    }

    const allocations = { ...(topic.allocations || {}) };
    const halfSprints = { ...(topic.halfSprints || {}) };
    const current = (allocations[devId] || []).slice().sort((x, y) => x - y);

    if (current.length === 0) {
      // No current allocation to extend/trim — Auto-allocate will place it.
      updateRoleList(role, newList);
      return;
    }

    const span = Math.ceil(newSprintsValue);
    const needsHalf = newSprintsValue % 1 === 0.5;

    let newSprints;
    if (span <= 0) {
      newSprints = [];
    } else if (span <= current.length) {
      newSprints = current.slice(0, span);
    } else {
      newSprints = current.slice();
      let next = current[current.length - 1] + 1;
      while (newSprints.length < span) {
        newSprints.push(next++);
      }
    }

    if (newSprints.length > 0) {
      allocations[devId] = newSprints;
    } else {
      delete allocations[devId];
    }

    delete halfSprints[devId];
    if (needsHalf && newSprints.length > 0) {
      halfSprints[devId] = [newSprints[newSprints.length - 1]];
    }

    updateRoleList(role, newList, { allocations, halfSprints });
  };

  const handleToggleParallel = (role, idx) => {
    const list = assignments[role] || [];
    updateRoleList(
      role,
      list.map((a, i) =>
        i === idx ? { ...a, parallel: !a.parallel } : a
      )
    );
    setPendingChanges(true);
  };

  const handleRemoveAssignment = (role, idx) => {
    const list = assignments[role] || [];
    const removed = list[idx];
    const newList = list.filter((_, i) => i !== idx);

    const allocations = { ...(topic.allocations || {}) };
    const halfSprints = { ...(topic.halfSprints || {}) };
    if (removed?.devId) {
      delete allocations[removed.devId];
      delete halfSprints[removed.devId];
    }

    updateRoleList(role, newList, { allocations, halfSprints });
  };

  const handleSetOverride = (role, value) => {
    onUpdate({
      roleStartOverrides: { ...overrides, [role]: value }
    });
    setPendingChanges(true);
  };

  const handleStartAbsChange = (abs) => {
    onUpdate({ startAbs: abs });
    setPendingChanges(true);
  };

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside
        className="drawer"
        role="dialog"
        aria-label="Topic details"
        aria-modal="true"
      >
        <div className="drawer-header">
          <button
            type="button"
            className="drawer-close icon-button"
            onClick={onClose}
            aria-label="Close"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="drawer-content">
          <input
            type="text"
            className="field-input drawer-name"
            value={topic.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder="Topic name"
            aria-label="Topic name"
          />

          <div className="field">
            <label className="field-label" htmlFor="topic-status">Status</label>
            <select
              id="topic-status"
              className="field-input"
              value={topic.status}
              onChange={(e) => onUpdate({ status: e.target.value })}
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="topic-category">Category</label>
            <select
              id="topic-category"
              className="field-input"
              value={topic.categoryId ?? ''}
              onChange={(e) =>
                onUpdate({ categoryId: e.target.value || null })
              }
            >
              {state.categories.length === 0 && (
                <option value="">— no categories —</option>
              )}
              {state.categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {ROLE_CARDS.map(({ role, label }) => (
            <RoleAssignmentCard
              key={role}
              role={role}
              label={label}
              list={assignments[role] || []}
              roleDevs={teamDevsByRole[role] || []}
              startOverride={overrides[role] ?? null}
              quarters={state.quarters}
              calendar={state.sprintCalendar}
              onChangeDev={(idx, devId) => handleChangeDev(role, idx, devId)}
              onChangeSprints={(idx, value) =>
                handleChangeSprints(role, idx, value)
              }
              onToggleParallel={(idx) => handleToggleParallel(role, idx)}
              onRemove={(idx) => handleRemoveAssignment(role, idx)}
              onAdd={() => handleAddAssignment(role)}
              onSetOverride={(value) => handleSetOverride(role, value)}
            />
          ))}

          <button
            type="button"
            className="action-button auto-allocate-button"
            style={topicTeam ? { backgroundColor: `#${topicTeam.color}` } : undefined}
            onClick={handleAutoAllocate}
            title={
              pendingChanges
                ? 'Some changes affect ordering. Click to re-schedule.'
                : undefined
            }
          >
            Auto-allocate
            {pendingChanges && (
              <span
                className="auto-allocate-pending-dot"
                aria-label="Pending changes"
              />
            )}
          </button>

          <div className="field">
            <span className="field-label">Start sprint</span>
            <SprintPicker
              value={topic.startAbs}
              onChange={handleStartAbsChange}
              quarters={state.quarters}
              calendar={state.sprintCalendar}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="topic-notes">Notes</label>
            <textarea
              id="topic-notes"
              className="field-input drawer-notes"
              rows={4}
              value={topic.notes}
              onChange={(e) => onUpdate({ notes: e.target.value })}
            />
          </div>

          <button
            type="button"
            className="delete-topic-button"
            onClick={handleDelete}
          >
            <Trash2 size={16} />
            Delete topic
          </button>
        </div>
      </aside>
    </>
  );
}

function RoleAssignmentCard({
  role,
  label,
  list,
  roleDevs,
  startOverride,
  quarters,
  calendar,
  onChangeDev,
  onChangeSprints,
  onToggleParallel,
  onRemove,
  onAdd,
  onSetOverride
}) {
  const total = list.reduce((s, a) => s + (Number(a.sprints) || 0), 0);

  return (
    <section className="card role-assign-card">
      <header className="role-assign-header">
        <h3 className="card-title role-assign-title">{label}</h3>
        <span className="role-assign-total">
          total: {fmtTotal(total)} sprint{total === 1 ? '' : 's'}
        </span>
      </header>

      <div className="role-assign-starts">
        <span className="role-assign-starts-label">Starts:</span>
        <div className="role-assign-starts-picker">
          <SprintPicker
            value={startOverride}
            onChange={(abs) => onSetOverride(abs)}
            quarters={quarters}
            calendar={calendar}
            placeholder="Auto"
          />
        </div>
        {startOverride != null && (
          <button
            type="button"
            className="role-assign-reset"
            onClick={() => onSetOverride(null)}
          >
            Reset to auto
          </button>
        )}
      </div>

      {roleDevs.length === 0 ? (
        <p className="role-assign-empty">
          No {label.toLowerCase()} developers in this team. Add one in Settings.
        </p>
      ) : (
        <>
          {list.length === 0 && (
            <p className="role-assign-empty">No assignments yet.</p>
          )}
          {list.map((a, idx) => (
            <AssignmentRow
              key={idx}
              assignment={a}
              isFirst={idx === 0}
              roleDevs={roleDevs}
              onChangeDev={(devId) => onChangeDev(idx, devId)}
              onChangeSprints={(value) => onChangeSprints(idx, value)}
              onToggleParallel={() => onToggleParallel(idx)}
              onRemove={() => onRemove(idx)}
            />
          ))}
          <button
            type="button"
            className="role-assign-add"
            onClick={onAdd}
          >
            <Plus size={14} />
            Add {label.toLowerCase()} dev
          </button>
        </>
      )}
    </section>
  );
}

function AssignmentRow({
  assignment,
  isFirst,
  roleDevs,
  onChangeDev,
  onChangeSprints,
  onToggleParallel,
  onRemove
}) {
  const isParallel = !isFirst && !!assignment.parallel;
  return (
    <div className="assignment-row">
      <select
        className="field-input assignment-row-dev"
        value={assignment.devId || ''}
        onChange={(e) => onChangeDev(e.target.value)}
        aria-label="Developer"
      >
        {!roleDevs.some((d) => d.id === assignment.devId) && (
          <option value={assignment.devId || ''}>
            {assignment.devId ? '(unknown dev)' : '— select —'}
          </option>
        )}
        {roleDevs.map((d) => (
          <option key={d.id} value={d.id}>{d.name}</option>
        ))}
      </select>

      <input
        type="number"
        className="field-input field-input--small assignment-row-sprints"
        min={0}
        step={0.5}
        value={assignment.sprints ?? 0}
        onChange={(e) => onChangeSprints(e.target.value)}
        aria-label="Sprints"
      />
      <span className="assignment-row-unit">sprints</span>

      {!isFirst ? (
        <button
          type="button"
          className={`assignment-row-toggle${isParallel ? ' assignment-row-toggle-parallel' : ''}`}
          onClick={onToggleParallel}
          title={isParallel ? 'Parallel — runs at the same time as the previous assignment' : 'Sequential — runs after the previous assignment'}
          aria-label={isParallel ? 'Parallel' : 'Sequential'}
        >
          {isParallel ? <MoveHorizontal size={14} /> : <ArrowDown size={14} />}
          <span className="assignment-row-toggle-label">
            {isParallel ? 'Parallel' : 'Sequential'}
          </span>
        </button>
      ) : (
        <span className="assignment-row-toggle-spacer" />
      )}

      <button
        type="button"
        className="icon-button assignment-row-remove"
        onClick={onRemove}
        aria-label="Remove assignment"
        title="Remove"
      >
        <X size={14} />
      </button>
    </div>
  );
}
