import { Trash2 } from 'lucide-react';
import { genId, randomColor } from '../lib/defaults.js';

const ROLES = [
  { key: 'designer', label: 'Designer' },
  { key: 'frontend', label: 'Frontend' },
  { key: 'middle', label: 'Middle' },
  { key: 'backend', label: 'Backend' }
];

function clampInt(value, min, max) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export default function SettingsView({ state, setState }) {
  const activeTeam = state.teams.find((t) => t.id === state.activeTeamId);

  if (!activeTeam) {
    return <p className="settings-empty">No active team selected.</p>;
  }

  const updateActiveTeam = (updates) => {
    setState({
      ...state,
      teams: state.teams.map((t) =>
        t.id === activeTeam.id ? { ...t, ...updates } : t
      )
    });
  };

  const updateRoleProductivity = (role, value) => {
    updateActiveTeam({
      roleProductivity: {
        ...activeTeam.roleProductivity,
        [role]: clampInt(value, 0, 100)
      }
    });
  };

  const updateQuarter = (quarterId, updates) => {
    setState({
      ...state,
      quarters: state.quarters.map((q) =>
        q.id === quarterId ? { ...q, ...updates } : q
      )
    });
  };

  const updateSprintCalendar = (updates) => {
    setState({
      ...state,
      sprintCalendar: { ...state.sprintCalendar, ...updates }
    });
  };

  const addCategory = () => {
    setState({
      ...state,
      categories: [
        ...state.categories,
        {
          id: genId('cat'),
          name: 'New category',
          color: randomColor(),
          targetPercent: 0
        }
      ]
    });
  };

  const updateCategory = (id, updates) => {
    setState({
      ...state,
      categories: state.categories.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      )
    });
  };

  const removeCategory = (id) => {
    setState({
      ...state,
      categories: state.categories.filter((c) => c.id !== id)
    });
  };

  const addDeveloper = () => {
    setState({
      ...state,
      developers: [
        ...state.developers,
        {
          id: genId('dev'),
          teamId: activeTeam.id,
          name: 'New dev',
          role: 'frontend',
          color: randomColor()
        }
      ]
    });
  };

  const updateDeveloper = (id, updates) => {
    setState({
      ...state,
      developers: state.developers.map((d) =>
        d.id === id ? { ...d, ...updates } : d
      )
    });
  };

  const removeDeveloper = (id) => {
    const dev = state.developers.find((d) => d.id === id);
    if (!dev) return;
    if (!window.confirm(`Delete developer "${dev.name}"?`)) return;
    setState({
      ...state,
      developers: state.developers.filter((d) => d.id !== id)
    });
  };

  const teamDevelopers = state.developers.filter(
    (d) => d.teamId === activeTeam.id
  );

  return (
    <div className="settings-columns">
      <div className="settings-column">
        <SprintCalendarCard
          sprintCalendar={state.sprintCalendar}
          onChange={updateSprintCalendar}
        />
        <TeamCard
          team={activeTeam}
          onNameChange={(name) => updateActiveTeam({ name })}
          onProductivityChange={updateRoleProductivity}
        />
      </div>
      <div className="settings-column">
        <QuartersCard
          quarters={state.quarters}
          onQuarterChange={updateQuarter}
        />
        <CategoriesCard
          categories={state.categories}
          onAdd={addCategory}
          onUpdate={updateCategory}
          onRemove={removeCategory}
        />
      </div>
      <div className="settings-column">
        <DevelopersCard
          developers={teamDevelopers}
          onAdd={addDeveloper}
          onUpdate={updateDeveloper}
          onRemove={removeDeveloper}
        />
      </div>
    </div>
  );
}

function TeamCard({ team, onNameChange, onProductivityChange }) {
  return (
    <section className="card">
      <h2 className="card-title">Team</h2>

      <div className="field">
        <label className="field-label" htmlFor="team-name">Name</label>
        <input
          id="team-name"
          type="text"
          className="field-input field-input--narrow"
          value={team.name}
          onChange={(e) => onNameChange(e.target.value)}
        />
      </div>

      <div className="field">
        <span className="field-label">Productivity by role (%)</span>
        <div className="role-list">
          {ROLES.map(({ key, label }) => (
            <RoleRow
              key={key}
              label={label}
              value={team.roleProductivity[key] ?? 0}
              onChange={(v) => onProductivityChange(key, v)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function RoleRow({ label, value, onChange }) {
  return (
    <div className="role-row">
      <span className="role-label">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="role-range"
      />
      <input
        type="number"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="field-input field-input--small"
      />
    </div>
  );
}

function QuartersCard({ quarters, onQuarterChange }) {
  return (
    <section className="card">
      <h2 className="card-title">Quarters</h2>
      <div className="quarter-list">
        {quarters.map((q) => (
          <div className="settings-quarter-row" key={q.id}>
            <span className="quarter-label">{q.name}</span>
            <div className="quarter-sprints">
              <input
                type="number"
                min={1}
                max={12}
                step={1}
                value={q.sprintCount}
                onChange={(e) =>
                  onQuarterChange(q.id, {
                    sprintCount: clampInt(e.target.value, 1, 12)
                  })
                }
                className="field-input field-input--small"
                aria-label={`${q.name} sprint count`}
              />
              <span className="quarter-sprints-suffix">sprints</span>
            </div>
            <input
              type="color"
              className="color-input"
              value={`#${q.color}`}
              onChange={(e) =>
                onQuarterChange(q.id, {
                  color: e.target.value.replace(/^#/, '')
                })
              }
              aria-label={`${q.name} color`}
              title={`#${q.color}`}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function SprintCalendarCard({ sprintCalendar, onChange }) {
  return (
    <section className="card">
      <h2 className="card-title">Sprint calendar</h2>

      <div className="field-row">
        <div className="field">
          <label className="field-label" htmlFor="year-start">Year start</label>
          <input
            id="year-start"
            type="date"
            className="field-input"
            value={sprintCalendar.yearStart}
            onChange={(e) => onChange({ yearStart: e.target.value })}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="sprint-length">Sprint length (weeks)</label>
          <input
            id="sprint-length"
            type="number"
            min={1}
            max={4}
            step={1}
            value={sprintCalendar.sprintLengthWeeks}
            onChange={(e) =>
              onChange({ sprintLengthWeeks: clampInt(e.target.value, 1, 4) })
            }
            className="field-input field-input--small"
          />
        </div>
      </div>
    </section>
  );
}

function CategoriesCard({ categories, onAdd, onUpdate, onRemove }) {
  const total = categories.reduce(
    (sum, c) => sum + (Number(c.targetPercent) || 0),
    0
  );
  const totalIsCorrect = total === 100;

  return (
    <section className="card">
      <h2 className="card-title">Categories</h2>

      <div className="row-list">
        {categories.map((c) => (
          <div className="category-row" key={c.id}>
            <input
              type="text"
              className="field-input"
              value={c.name}
              onChange={(e) => onUpdate(c.id, { name: e.target.value })}
              aria-label="Category name"
            />
            <div className="percent-input-wrap">
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={c.targetPercent}
                onChange={(e) =>
                  onUpdate(c.id, {
                    targetPercent: clampInt(e.target.value, 0, 100)
                  })
                }
                className="field-input field-input--small"
                aria-label={`${c.name} target percent`}
              />
              <span className="percent-suffix">%</span>
            </div>
            <input
              type="color"
              className="color-input"
              value={`#${c.color}`}
              onChange={(e) =>
                onUpdate(c.id, { color: e.target.value.replace(/^#/, '') })
              }
              aria-label={`${c.name} color`}
              title={`#${c.color}`}
            />
            <button
              type="button"
              className="icon-button"
              onClick={() => onRemove(c.id)}
              aria-label={`Delete ${c.name}`}
              title="Delete"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      <button type="button" className="add-button" onClick={onAdd}>
        + Add category
      </button>

      <p
        className={`row-total${totalIsCorrect ? '' : ' row-total-warn'}`}
      >
        Total: {total}%{!totalIsCorrect && ' (should equal 100)'}
      </p>
    </section>
  );
}

function DevelopersCard({ developers, onAdd, onUpdate, onRemove }) {
  return (
    <section className="card">
      <h2 className="card-title">Developers</h2>

      <div className="row-list">
        {developers.map((d) => (
          <div className="developer-row" key={d.id}>
            <input
              type="text"
              className="field-input"
              value={d.name}
              onChange={(e) => onUpdate(d.id, { name: e.target.value })}
              aria-label="Developer name"
            />
            <select
              className="field-input"
              value={d.role}
              onChange={(e) => onUpdate(d.id, { role: e.target.value })}
              aria-label={`${d.name} role`}
            >
              {ROLES.map((r) => (
                <option key={r.key} value={r.key}>{r.label}</option>
              ))}
            </select>
            <input
              type="color"
              className="color-input"
              value={`#${d.color}`}
              onChange={(e) =>
                onUpdate(d.id, { color: e.target.value.replace(/^#/, '') })
              }
              aria-label={`${d.name} color`}
              title={`#${d.color}`}
            />
            <button
              type="button"
              className="icon-button"
              onClick={() => onRemove(d.id)}
              aria-label={`Delete ${d.name}`}
              title="Delete"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      <button type="button" className="add-button" onClick={onAdd}>
        + Add developer
      </button>
    </section>
  );
}
