import React, { useState } from 'react';
import { TeamsPage } from './pages/TeamsPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { IconRefresh } from './components/Icons';

export const App: React.FC = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [tab, setTab] = useState<'teams' | 'audit' | 'analytics'>('teams');

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Preset Analytics</h1>
        <nav className="nav-tabs" aria-label="Primary">
          <button className={tab==='teams' ? 'active' : ''} onClick={()=>setTab('teams')}>🧩 Teams</button>
          <button className={tab==='audit' ? 'active' : ''} onClick={()=>setTab('audit')}>📜 Audit Logs</button>
          <button className={tab==='analytics' ? 'active' : ''} onClick={()=>setTab('analytics')}>📊 Analytics</button>
        </nav>
        <div className="actions">
          <button className="secondary" onClick={() => setRefreshKey(k => k + 1)} title="Reload local JSON data">
            <IconRefresh /> Refresh Data
          </button>
        </div>
      </header>
      <main>
  {tab === 'teams' && <TeamsPage refreshKey={refreshKey} />}
  {tab === 'audit' && <AuditLogsPage refreshKey={refreshKey} />}
  {tab === 'analytics' && <AnalyticsPage refreshKey={refreshKey} />}
      </main>
      <footer className="app-footer">Static snapshot generated from Preset API via GitHub Actions. Secrets never exposed client-side.</footer>
    </div>
  );
};
