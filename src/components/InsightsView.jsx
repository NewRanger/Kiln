import { useMemo } from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import { computeCapacity } from '../lib/capacity.js';
import { computeConflicts } from '../lib/conflicts.js';
import { absToQS } from '../lib/schedule.js';

const ROLES = [
  { key: 'designer', label: 'Designer' },
  { key: 'frontend', label: 'Frontend' },
  { key: 'middle', label: 'Middle' },
  { key: 'backend', label: 'Backend' }
];

const STATUS_LABEL = {
  'on-track': 'On track',
  under: 'Under',
  over: 'Over'
};

function fmt(n) {
  const rounded = Math.round((n ?? 0) * 10) / 10;
  return rounded.toString();
}

function fmtPercent(n) {
  return `${Math.round((n ?? 0) * 10) / 10}%`;
}

export default function InsightsView({ state }) {
  const capacity = useMemo(() => computeCapacity(state), [state]);
  const conflicts = useMemo(() => computeConflicts(state), [state.topics]);
  const activeTeam = state.teams.find((t) => t.id === state.activeTeamId);
  const teamColor = activeTeam ? `#${activeTeam.color}` : '#6e4fab';

  return (
    <div className="insights">
      <CapacityOverview capacity={capacity} teamColor={teamColor} />
      <ConflictsCard state={state} conflicts={conflicts} />
      <RoleCardsRow capacity={capacity} />
      <CategoriesTable capacity={capacity} />
    </div>
  );
}

function ConflictsCard({ state, conflicts }) {
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

  const list = [];
  for (const [devId, sprintMap] of conflicts) {
    for (const [sprint, topicIds] of sprintMap) {
      list.push({ devId, sprint, topicIds });
    }
  }
  list.sort((a, b) => {
    if (a.sprint !== b.sprint) return a.sprint - b.sprint;
    const aName = devsById[a.devId]?.name ?? '';
    const bName = devsById[b.devId]?.name ?? '';
    return aName.localeCompare(bName);
  });

  const count = list.length;

  return (
    <section className="card">
      <h2 className="card-title conflicts-title">
        {count > 0 ? (
          <AlertTriangle size={16} className="conflicts-title-warning" />
        ) : (
          <Check size={16} className="conflicts-title-ok" />
        )}
        <span>Conflicts{count > 0 ? ` (${count})` : ''}</span>
      </h2>

      {count === 0 ? (
        <p className="conflicts-empty">
          <Check size={14} className="conflicts-empty-icon" />
          No resource conflicts detected
        </p>
      ) : (
        <table className="conflicts-table">
          <thead>
            <tr>
              <th>Developer</th>
              <th>Sprint</th>
              <th>Topics</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c, i) => {
              const dev = devsById[c.devId];
              const qs = absToQS(c.sprint, state.quarters);
              const sprintLabel = qs
                ? `${qs.quarter.name} S${qs.sprint}`
                : `S${c.sprint}`;
              const topicNames = c.topicIds
                .map((id) => topicsById[id]?.name ?? '?')
                .join(', ');
              return (
                <tr key={i}>
                  <td>{dev?.name ?? 'Unknown'}</td>
                  <td>{sprintLabel}</td>
                  <td>{topicNames}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

function CapacityOverview({ capacity, teamColor }) {
  const {
    totalDevSprints,
    plannedDevSprints,
    freeDevSprints,
    utilizationPercent
  } = capacity;
  const plannedPercent =
    totalDevSprints > 0 ? (plannedDevSprints / totalDevSprints) * 100 : 0;

  return (
    <section className="card">
      <h2 className="card-title">Capacity</h2>
      <div className="capacity-big">{fmt(totalDevSprints)}</div>
      <div className="capacity-label">dev-sprints</div>
      <p className="capacity-subtitle">
        {fmt(plannedDevSprints)} planned · {fmt(freeDevSprints)} free ·{' '}
        {Math.round(utilizationPercent)}% utilization
      </p>
      <div className="capacity-bar">
        <div
          className="capacity-bar-planned"
          style={{
            width: `${Math.min(100, plannedPercent)}%`,
            backgroundColor: teamColor
          }}
        />
      </div>
    </section>
  );
}

function RoleCardsRow({ capacity }) {
  return (
    <div className="role-cards-row">
      {ROLES.map(({ key, label }) => (
        <RoleCard key={key} label={label} role={capacity.byRole[key]} />
      ))}
    </div>
  );
}

function RoleCard({ label, role }) {
  const utilization = role.capacity > 0 ? (role.planned / role.capacity) * 100 : 0;
  const isOver = utilization > 100;
  return (
    <div className="card role-card">
      <h3 className="role-card-title">{label}</h3>
      <div className="role-card-meta">
        {role.headcount} dev{role.headcount === 1 ? '' : 's'} · {role.productivity}% productivity
      </div>
      <div className="role-card-capacity">{fmt(role.capacity)}</div>
      <div className="role-card-label">capacity</div>
      <div className="role-card-progress">
        <div
          className={`role-card-progress-fill${isOver ? ' role-card-progress-fill-over' : ''}`}
          style={{ width: `${Math.min(100, utilization)}%` }}
        />
      </div>
      <div className="role-card-ratio">
        {fmt(role.planned)} / {fmt(role.capacity)} ({Math.round(utilization)}%)
      </div>
    </div>
  );
}

function CategoriesTable({ capacity }) {
  const totals = capacity.byCategory.reduce(
    (acc, c) => ({
      targetPercent: acc.targetPercent + c.targetPercent,
      targetDevSprints: acc.targetDevSprints + c.targetDevSprints,
      plannedDevSprints: acc.plannedDevSprints + c.plannedDevSprints,
      plannedPercent: acc.plannedPercent + c.plannedPercent
    }),
    { targetPercent: 0, targetDevSprints: 0, plannedDevSprints: 0, plannedPercent: 0 }
  );

  return (
    <section className="card">
      <h2 className="card-title">Categories</h2>
      <table className="categories-table">
        <thead>
          <tr>
            <th>Category</th>
            <th className="num">Target %</th>
            <th className="num">Target</th>
            <th className="num">Planned</th>
            <th className="num">Planned %</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {capacity.byCategory.map((c) => (
            <tr key={c.id}>
              <td>
                <span className="category-row-name">
                  <span
                    className="color-dot"
                    style={{ backgroundColor: `#${c.color}` }}
                  />
                  {c.name}
                </span>
              </td>
              <td className="num">{c.targetPercent}%</td>
              <td className="num">{fmt(c.targetDevSprints)}</td>
              <td className="num">{fmt(c.plannedDevSprints)}</td>
              <td className="num">{fmtPercent(c.plannedPercent)}</td>
              <td>
                <span className={`status-pill status-pill-${c.status}`}>
                  {STATUS_LABEL[c.status]}
                </span>
              </td>
            </tr>
          ))}
          {capacity.byCategory.length === 0 && (
            <tr>
              <td colSpan={6} className="categories-empty">
                No categories defined.
              </td>
            </tr>
          )}
        </tbody>
        {capacity.byCategory.length > 0 && (
          <tfoot>
            <tr>
              <td>Total</td>
              <td className="num">{totals.targetPercent}%</td>
              <td className="num">{fmt(totals.targetDevSprints)}</td>
              <td className="num">{fmt(totals.plannedDevSprints)}</td>
              <td className="num">{fmtPercent(totals.plannedPercent)}</td>
              <td></td>
            </tr>
          </tfoot>
        )}
      </table>
    </section>
  );
}
