export function genId(prefix) {
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${rnd}`;
}

export function randomColor() {
  return Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, '0')
    .toUpperCase();
}

export function getDefaultState() {
  const teamId = 'team-1';

  return {
    version: 5,
    teams: [
      {
        id: teamId,
        name: 'My Team',
        color: '6E4FAB',
        roleProductivity: {
          designer: 80,
          frontend: 75,
          middle: 75,
          backend: 75
        }
      }
    ],
    developers: [
      { id: genId('dev'), teamId, name: 'Designer', role: 'designer', color: 'D4A24C' },
      { id: genId('dev'), teamId, name: 'FE Dev 1', role: 'frontend', color: '6E4FAB' },
      { id: genId('dev'), teamId, name: 'FE Dev 2', role: 'frontend', color: 'B5A1D6' },
      { id: genId('dev'), teamId, name: 'ME Dev 1', role: 'middle',   color: '3E7A4F' },
      { id: genId('dev'), teamId, name: 'ME Dev 2', role: 'middle',   color: '94BC8E' },
      { id: genId('dev'), teamId, name: 'BE Dev 1', role: 'backend',  color: '1E5F8B' }
    ],
    topics: [],
    categories: [
      { id: genId('cat'), name: 'KBO',     color: 'a3c4dc', targetPercent: 60 },
      { id: genId('cat'), name: 'Backlog', color: 'd4a24c', targetPercent: 30 },
      { id: genId('cat'), name: 'Tech',    color: 'c47a9c', targetPercent: 10 }
    ],
    quarters: [
      { id: genId('q'), name: 'Q1', sprintCount: 7, color: '378ADD' },
      { id: genId('q'), name: 'Q2', sprintCount: 6, color: '1D9E75' },
      { id: genId('q'), name: 'Q3', sprintCount: 6, color: 'D4537E' },
      { id: genId('q'), name: 'Q4', sprintCount: 6, color: 'BA7517' }
    ],
    sprintCalendar: { yearStart: '2026-01-05', sprintLengthWeeks: 2 },
    now: { quarter: 'Q1', sprint: 1 },
    activeTeamId: teamId,
    theme: 'system'
  };
}
