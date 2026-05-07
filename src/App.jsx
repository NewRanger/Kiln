import { useState } from 'react';
import * as XLSX from 'xlsx-js-style';
import Header from './components/Header.jsx';
import InsightsView from './components/InsightsView.jsx';
import RoadmapView from './components/RoadmapView.jsx';
import SettingsView from './components/SettingsView.jsx';
import { buildWorkbook } from './lib/excelExport.js';
import { distribute } from './lib/scheduler.js';
import { useAppState } from './lib/storage.js';

const TABS = [
  { id: 'roadmap', label: 'Roadmap' },
  { id: 'insights', label: 'Insights' },
  { id: 'settings', label: 'Settings' }
];

export default function App() {
  const [state, setState, saveStatus] = useAppState();
  const [activeTab, setActiveTab] = useState('roadmap');

  if (!state) {
    return (
      <div className="placeholder">
        <h1>Loading…</h1>
      </div>
    );
  }

  const activeTeam = state.teams.find((t) => t.id === state.activeTeamId);

  const handleDistribute = () => {
    if (
      !window.confirm(
        'Re-schedule all topics based on estimates and start sprints? Locked topics will stay put.'
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
    await window.kiln.exportExcel(buffer, `kiln-${date}.xlsx`);
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
    </div>
  );
}
