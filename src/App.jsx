import { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx-js-style';
import Header from './components/Header.jsx';
import InsightsView from './components/InsightsView.jsx';
import RoadmapView from './components/RoadmapView.jsx';
import SettingsView from './components/SettingsView.jsx';
import { buildWorkbook } from './lib/excelExport.js';
import { migrate } from './lib/migrations.js';
import { distribute } from './lib/scheduler.js';
import { useAppState } from './lib/storage.js';

const TABS = [
  { id: 'roadmap', label: 'Roadmap' },
  { id: 'insights', label: 'Insights' },
  { id: 'settings', label: 'Settings' }
];

const THEME_ORDER = ['system', 'light', 'dark'];

function getSystemTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function isValidKilnData(data) {
  if (!data || typeof data !== 'object') return false;
  if (typeof data.version !== 'number') return false;
  if (!Array.isArray(data.topics)) return false;
  if (!Array.isArray(data.developers)) return false;
  if (!Array.isArray(data.categories)) return false;
  if (!Array.isArray(data.quarters)) return false;
  return true;
}

function basenameOf(filePath) {
  if (!filePath) return '';
  return filePath.split(/[\\/]/).pop();
}

export default function App() {
  const [state, setState, saveStatus] = useAppState();
  const [activeTab, setActiveTab] = useState('roadmap');
  const [systemTheme, setSystemTheme] = useState(getSystemTheme);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => setSystemTheme(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const themePref = state?.theme ?? 'system';
  const effectiveTheme = themePref === 'system' ? systemTheme : themePref;

  useEffect(() => {
    document.documentElement.dataset.theme = effectiveTheme;
  }, [effectiveTheme]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  if (!state) {
    return (
      <div className="placeholder">
        <h1>Loading…</h1>
      </div>
    );
  }

  const showToast = (message, durationMs = 5000) => {
    setToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), durationMs);
  };

  const activeTeam = state.teams.find((t) => t.id === state.activeTeamId);

  const handleDistribute = () => {
    if (
      !window.confirm(
        'Re-schedule all topics based on their assignments and start sprints? Locked topics will stay put.'
      )
    ) {
      return;
    }
    setState(distribute(state));
  };

  const handleExportExcel = async () => {
    const wb = buildWorkbook(state);
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const date = new Date().toISOString().slice(0, 10);
    const path = await window.kiln.exportExcel(buffer, `kiln-${date}.xlsx`);
    if (path) showToast(`Exported to ${basenameOf(path)}`);
  };

  const handleExportJson = async () => {
    const json = JSON.stringify(state, null, 2);
    const date = new Date().toISOString().slice(0, 10);
    const path = await window.kiln.exportJson(json, `kiln-data-${date}.json`);
    if (path) showToast(`Exported to ${basenameOf(path)}`);
  };

  const handleImportJson = async () => {
    const content = await window.kiln.importJson();
    if (!content) return;

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      window.alert(
        "This file doesn't look like a Kiln data file. Import cancelled."
      );
      return;
    }

    if (!isValidKilnData(parsed)) {
      window.alert(
        "This file doesn't look like a Kiln data file. Import cancelled."
      );
      return;
    }

    if (
      !window.confirm(
        'This will replace your current data. A backup will be created automatically. Continue?'
      )
    ) {
      return;
    }

    const backupPath = await window.kiln.backupCurrent();
    setState(migrate(parsed));

    if (backupPath) {
      showToast(`Imported. Previous data backed up to ${basenameOf(backupPath)}.`);
    } else {
      showToast('Imported.');
    }
  };

  const cycleTheme = () => {
    const idx = THEME_ORDER.indexOf(themePref);
    for (let step = 1; step <= THEME_ORDER.length; step++) {
      const candidate = THEME_ORDER[(idx + step) % THEME_ORDER.length];
      const candidateEffective = candidate === 'system' ? systemTheme : candidate;
      if (candidateEffective !== effectiveTheme) {
        setState({ ...state, theme: candidate });
        return;
      }
    }
  };

  return (
    <div className="app">
      <Header
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        saveStatus={saveStatus}
        activeTeam={activeTeam}
        onDistribute={handleDistribute}
        onExportExcel={handleExportExcel}
        onExportJson={handleExportJson}
        onImportJson={handleImportJson}
        themePref={themePref}
        effectiveTheme={effectiveTheme}
        onCycleTheme={cycleTheme}
      />
      <main className={`content${activeTab === 'roadmap' ? ' content-flush' : ''}`}>
        {activeTab === 'roadmap' && (
          <RoadmapView state={state} setState={setState} />
        )}
        {activeTab === 'settings' && (
          <SettingsView state={state} setState={setState} />
        )}
        {activeTab === 'insights' && <InsightsView state={state} />}
      </main>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
