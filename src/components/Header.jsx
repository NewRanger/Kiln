import { FileSpreadsheet, Moon, Sun } from 'lucide-react';
import { version } from '../../package.json';

const STATUS_LABEL = {
  saved: 'Saved',
  saving: 'Saving…',
  error: 'Error'
};

const THEME_LABEL = {
  system: 'System',
  light: 'Light',
  dark: 'Dark'
};

export default function Header({
  tabs,
  activeTab,
  onTabChange,
  saveStatus,
  activeTeam,
  onDistribute,
  onExportExcel,
  themePref,
  effectiveTheme,
  onCycleTheme
}) {
  const ThemeIcon = effectiveTheme === 'dark' ? Moon : Sun;
  const themeTitle = `Theme: ${THEME_LABEL[themePref] ?? 'System'}`;

  return (
    <header className="header">
      <div className="header-left">
        <span className="wordmark">Kiln</span>
        <span className="wordmark-version">v{version}</span>
      </div>

      <nav className="tabs" role="tablist">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`tab${isActive ? ' tab-active' : ''}`}
              onClick={() => onTabChange(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      <div className="header-right">
        <button
          type="button"
          className="header-icon-button"
          onClick={onExportExcel}
          aria-label="Export to Excel"
          title="Export to Excel"
        >
          <FileSpreadsheet size={16} />
        </button>
        <button
          type="button"
          className="header-icon-button"
          onClick={onCycleTheme}
          aria-label={themeTitle}
          title={themeTitle}
        >
          <ThemeIcon size={16} />
        </button>
        <button
          type="button"
          className="distribute-button"
          style={
            activeTeam ? { backgroundColor: `#${activeTeam.color}` } : undefined
          }
          onClick={onDistribute}
        >
          Distribute
        </button>
        <div className={`save-indicator save-indicator-${saveStatus}`}>
          <span className="save-dot" aria-hidden="true" />
          <span className="save-text">{STATUS_LABEL[saveStatus]}</span>
        </div>
      </div>
    </header>
  );
}
