import * as XLSX from 'xlsx-js-style';
import { absToQS } from './schedule.js';
import { computeCapacity } from './capacity.js';

const ROLES = [
  { key: 'designer', label: 'Designer' },
  { key: 'frontend', label: 'Frontend' },
  { key: 'middle', label: 'Middle' },
  { key: 'backend', label: 'Backend' }
];

export function buildWorkbook(state) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildRoadmapSheet(state), 'Roadmap');
  XLSX.utils.book_append_sheet(wb, buildTopicsSheet(state), 'Topics');
  XLSX.utils.book_append_sheet(wb, buildCapacitySheet(state), 'Capacity');
  XLSX.utils.book_append_sheet(wb, buildCategoriesSheet(state), 'Categories');
  XLSX.utils.book_append_sheet(wb, buildAllocationsSheet(state), 'Allocations');
  return wb;
}

const FIXED_COLS = 6;

function buildRoadmapSheet(state) {
  const { topics, quarters, developers } = state;
  const totalSprints = quarters.reduce((s, q) => s + (q.sprintCount || 0), 0);
  const totalCols = FIXED_COLS + totalSprints;

  const sheet = {};
  const merges = [];

  const quarterRanges = [];
  let cursor = 0;
  for (const q of quarters) {
    const startCol = FIXED_COLS + cursor;
    const endCol = startCol + q.sprintCount - 1;
    quarterRanges.push({
      name: q.name,
      color: (q.color || '6E4FAB').toUpperCase(),
      sprintCount: q.sprintCount,
      startCol,
      endCol
    });
    cursor += q.sprintCount;
  }

  // Row 0: title
  setCell(sheet, 0, 0, {
    v: 'Kiln Roadmap',
    t: 's',
    s: { font: { bold: true, sz: 14 } }
  });

  // Row 1: quarter headers (merged)
  for (const qr of quarterRanges) {
    setCell(sheet, 1, qr.startCol, {
      v: `${qr.name} — ${qr.sprintCount} sprints`,
      t: 's',
      s: {
        fill: { fgColor: { rgb: qr.color } },
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        alignment: { horizontal: 'center', vertical: 'center' }
      }
    });
    if (qr.endCol > qr.startCol) {
      merges.push({
        s: { r: 1, c: qr.startCol },
        e: { r: 1, c: qr.endCol }
      });
    }
  }

  // Row 2: column headers
  const headerStyleCenter = {
    fill: { fgColor: { rgb: 'EBE8E0' } },
    font: { bold: true },
    alignment: { horizontal: 'center', vertical: 'center' }
  };
  const headerStyleLeft = {
    fill: { fgColor: { rgb: 'EBE8E0' } },
    font: { bold: true },
    alignment: { horizontal: 'left', vertical: 'center' }
  };

  setCell(sheet, 2, 0, { v: 'Topic', t: 's', s: headerStyleLeft });
  setCell(sheet, 2, 1, { v: 'Design', t: 's', s: headerStyleCenter });
  setCell(sheet, 2, 2, { v: 'Frontend', t: 's', s: headerStyleCenter });
  setCell(sheet, 2, 3, { v: 'Middle', t: 's', s: headerStyleCenter });
  setCell(sheet, 2, 4, { v: 'Backend', t: 's', s: headerStyleCenter });
  setCell(sheet, 2, 5, { v: 'Total', t: 's', s: headerStyleCenter });

  for (let abs = 1; abs <= totalSprints; abs++) {
    const qs = absToQS(abs, quarters);
    const label = qs ? `S${qs.sprint}` : `S${abs}`;
    setCell(sheet, 2, FIXED_COLS + abs - 1, {
      v: label,
      t: 's',
      s: headerStyleCenter
    });
  }

  // Topic rows
  const devsById = new Map(developers.map((d) => [d.id, d]));
  topics.forEach((topic, idx) => {
    const r = 3 + idx;
    const e = topic.estimates || {};
    const total =
      (e.design || 0) + (e.frontend || 0) + (e.middle || 0) + (e.backend || 0);

    setCell(sheet, r, 0, { v: topic.name, t: 's' });
    setCell(sheet, r, 1, { v: e.design || 0, t: 'n' });
    setCell(sheet, r, 2, { v: e.frontend || 0, t: 'n' });
    setCell(sheet, r, 3, { v: e.middle || 0, t: 'n' });
    setCell(sheet, r, 4, { v: e.backend || 0, t: 'n' });
    setCell(sheet, r, 5, { v: total, t: 'n' });

    const sprintToDevs = new Map();
    for (const devId of Object.keys(topic.allocations || {})) {
      const sprints = topic.allocations[devId] || [];
      const dev = devsById.get(devId);
      if (!dev) continue;
      for (const s of sprints) {
        if (!sprintToDevs.has(s)) sprintToDevs.set(s, []);
        sprintToDevs.get(s).push(dev);
      }
    }

    for (let abs = 1; abs <= totalSprints; abs++) {
      const devsAt = sprintToDevs.get(abs);
      if (!devsAt || devsAt.length === 0) continue;
      const color = (devsAt[0].color || '000000').toUpperCase();
      setCell(sheet, r, FIXED_COLS + abs - 1, {
        v: '',
        t: 's',
        s: { fill: { fgColor: { rgb: color } } }
      });
    }
  });

  const lastRow = Math.max(2, 3 + topics.length - 1);
  const lastCol = Math.max(FIXED_COLS - 1, totalCols - 1);
  sheet['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: lastRow, c: lastCol }
  });

  if (merges.length > 0) sheet['!merges'] = merges;

  const cols = [{ wch: 12 }];
  for (let i = 0; i < 5; i++) cols.push({ wch: 6 });
  for (let i = 0; i < totalSprints; i++) cols.push({ wch: 4 });
  sheet['!cols'] = cols;

  sheet['!views'] = [{ state: 'frozen', xSplit: 6, ySplit: 3 }];

  return sheet;
}

function setCell(sheet, r, c, cell) {
  sheet[XLSX.utils.encode_cell({ r, c })] = cell;
}

function buildTopicsSheet(state) {
  const categoriesById = new Map(state.categories.map((c) => [c.id, c]));
  const headers = [
    'ID', 'Name', 'Category', 'Status', 'Priority',
    'Design', 'Frontend', 'Middle', 'Backend', 'Total',
    'Designer count', 'FE devs', 'ME devs', 'BE devs',
    'Start sprint', 'Locked', 'Notes'
  ];

  const rows = state.topics.map((t) => {
    const e = t.estimates || {};
    const total =
      (e.design || 0) + (e.frontend || 0) + (e.middle || 0) + (e.backend || 0);
    const cat = categoriesById.get(t.categoryId);
    const qs = absToQS(t.startAbs, state.quarters);
    const startLabel = qs ? `${qs.quarter.name} S${qs.sprint}` : `S${t.startAbs}`;
    return [
      t.id,
      t.name,
      cat ? cat.name : '',
      t.status,
      t.priority || 0,
      e.design || 0,
      e.frontend || 0,
      e.middle || 0,
      e.backend || 0,
      total,
      t.designDevCount || 0,
      t.feDevCount || 0,
      t.meDevCount || 0,
      t.beDevCount || 0,
      startLabel,
      t.locked ? 'Yes' : 'No',
      t.notes || ''
    ];
  });

  return finalizeSheet([headers, ...rows]);
}

function buildCapacitySheet(state) {
  const cap = computeCapacity(state);
  const headers = [
    'Role', 'Headcount', 'Productivity %',
    'Capacity (dev-sprints)', 'Planned', 'Planned %'
  ];
  const rows = ROLES.map(({ key, label }) => {
    const r = cap.byRole[key];
    return [
      label,
      r.headcount,
      r.productivity,
      round1(r.capacity),
      round1(r.planned),
      round1(r.percent)
    ];
  });
  return finalizeSheet([headers, ...rows]);
}

function buildCategoriesSheet(state) {
  const cap = computeCapacity(state);
  const headers = [
    'Category', 'Target %',
    'Target dev-sprints', 'Planned dev-sprints',
    'Planned %', 'Status'
  ];
  const rows = cap.byCategory.map((c) => [
    c.name,
    c.targetPercent,
    round1(c.targetDevSprints),
    round1(c.plannedDevSprints),
    round1(c.plannedPercent),
    c.status
  ]);
  return finalizeSheet([headers, ...rows]);
}

function buildAllocationsSheet(state) {
  const headers = [
    'Topic', 'Dev', 'Role', 'Absolute sprint',
    'Quarter', 'Sprint label', 'Half?'
  ];
  const devsById = new Map(state.developers.map((d) => [d.id, d]));
  const rows = [];

  for (const topic of state.topics) {
    const allocations = topic.allocations || {};
    const halfSprints = topic.halfSprints || {};
    for (const devId of Object.keys(allocations)) {
      const dev = devsById.get(devId);
      const sprints = allocations[devId] || [];
      const halfSet = new Set(halfSprints[devId] || []);
      for (const sprint of sprints) {
        const qs = absToQS(sprint, state.quarters);
        rows.push([
          topic.name,
          dev ? dev.name : '(unknown)',
          dev ? dev.role : '',
          sprint,
          qs ? qs.quarter.name : '',
          qs ? `S${qs.sprint}` : '',
          halfSet.has(sprint) ? 'Yes' : 'No'
        ]);
      }
    }
  }

  return finalizeSheet([headers, ...rows]);
}

function finalizeSheet(aoa) {
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet['!views'] = [
    { state: 'frozen', ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft' }
  ];
  sheet['!cols'] = autoSizeCols(aoa);
  return sheet;
}

function autoSizeCols(aoa) {
  if (aoa.length === 0) return [];
  const widths = aoa[0].map(() => 8);
  for (const row of aoa) {
    row.forEach((cell, i) => {
      const len = String(cell ?? '').length;
      const target = Math.min(50, len + 2);
      if (target > widths[i]) widths[i] = target;
    });
  }
  return widths.map((w) => ({ wch: w }));
}

function round1(n) {
  return Math.round((n ?? 0) * 10) / 10;
}
