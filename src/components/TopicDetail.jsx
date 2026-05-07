import { useEffect, useMemo } from 'react';
import { Trash2, X } from 'lucide-react';
import { applyRoleEstimate, autoAllocate } from '../lib/scheduler.js';
import SprintPicker from './SprintPicker.jsx';

const DEV_ROLE_TO_ESTIMATE = {
  designer: 'design',
  frontend: 'frontend',
  middle: 'middle',
  backend: 'backend'
};

const ROLE_TO_DEV_COUNT_KEY = {
  design: 'designDevCount',
  frontend: 'feDevCount',
  middle: 'meDevCount',
  backend: 'beDevCount'
};

const DEV_COUNT_KEY_TO_ROLE = {
  designDevCount: 'design',
  feDevCount: 'frontend',
  meDevCount: 'middle',
  beDevCount: 'backend'
};

const STATUSES = [
  { value: 'done', label: 'Done' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'backlog', label: 'Backlog' }
];

const ESTIMATE_FIELDS = [
  { key: 'design', label: 'Design' },
  { key: 'frontend', label: 'Frontend' },
  { key: 'middle', label: 'Middle' },
  { key: 'backend', label: 'Backend' }
];

const DEV_COUNT_FIELDS = [
  { key: 'designDevCount', label: 'Design' },
  { key: 'feDevCount', label: 'Frontend' },
  { key: 'meDevCount', label: 'Middle' },
  { key: 'beDevCount', label: 'Backend' }
];

function clampNum(value, min, max, step) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  if (step === 0.5) {
    return Math.max(min, Math.min(max, Math.round(n * 2) / 2));
  }
  return Math.max(min, Math.min(max, Math.round(n)));
}

function fmtCount(n) {
  return Math.round((n ?? 0) * 10) / 10;
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

  const allocatedByRole = useMemo(() => {
    const result = { design: 0, frontend: 0, middle: 0, backend: 0 };
    const devRole = new Map(state.developers.map((d) => [d.id, d.role]));
    const allocations = topic.allocations || {};
    const halfSprints = topic.halfSprints || {};
    for (const devId of Object.keys(allocations)) {
      const role = devRole.get(devId);
      const key = DEV_ROLE_TO_ESTIMATE[role];
      if (!key) continue;
      const halfSet = new Set(halfSprints[devId] || []);
      for (const sprint of allocations[devId] || []) {
        result[key] += halfSet.has(sprint) ? 0.5 : 1;
      }
    }
    return result;
  }, [topic.allocations, topic.halfSprints, state.developers]);

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
  };

  const handleEstimateChange = (role, value) => {
    const newCount = Math.max(0, clampNum(value, 0, 999, 0.5));
    const devCountKey = ROLE_TO_DEV_COUNT_KEY[role];
    const devCount = topic[devCountKey] ?? 1;
    const result = applyRoleEstimate(
      topic,
      state.developers,
      role,
      newCount,
      devCount
    );
    onUpdate({
      allocations: result.allocations,
      halfSprints: result.halfSprints,
      estimates: { ...topic.estimates, [role]: newCount }
    });
  };

  const handleDevCountChange = (devCountKey, value) => {
    const newDevCount = clampNum(value, 0, 2, 1);
    const role = DEV_COUNT_KEY_TO_ROLE[devCountKey];
    const currentCount = allocatedByRole[role] || 0;
    const result = applyRoleEstimate(
      topic,
      state.developers,
      role,
      currentCount,
      newDevCount
    );
    onUpdate({
      [devCountKey]: newDevCount,
      allocations: result.allocations,
      halfSprints: result.halfSprints
    });
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

          <section className="card">
            <h3 className="card-title">Estimates (sprints)</h3>
            <div className="estimates-grid">
              {ESTIMATE_FIELDS.map(({ key, label }) => (
                <div className="field" key={key}>
                  <label className="field-label" htmlFor={`est-${key}`}>{label}</label>
                  <input
                    id={`est-${key}`}
                    type="number"
                    min={0}
                    step={0.5}
                    value={fmtCount(allocatedByRole[key])}
                    onChange={(e) => handleEstimateChange(key, e.target.value)}
                    className="field-input"
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <h3 className="card-title">Dev counts</h3>
            <div className="estimates-grid">
              {DEV_COUNT_FIELDS.map(({ key, label }) => (
                <div className="field" key={key}>
                  <label className="field-label" htmlFor={`dc-${key}`}>{label}</label>
                  <input
                    id={`dc-${key}`}
                    type="number"
                    min={0}
                    max={2}
                    step={1}
                    value={topic[key] ?? 0}
                    onChange={(e) => handleDevCountChange(key, e.target.value)}
                    className="field-input"
                  />
                </div>
              ))}
            </div>
          </section>

          <button
            type="button"
            className="action-button"
            style={topicTeam ? { backgroundColor: `#${topicTeam.color}` } : undefined}
            onClick={handleAutoAllocate}
          >
            Auto-allocate
          </button>

          <div className="field">
            <span className="field-label">Start sprint</span>
            <SprintPicker
              value={topic.startAbs}
              onChange={(abs) => onUpdate({ startAbs: abs })}
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
