import React, { useState } from 'react';
import { TeamsPage } from './pages/TeamsPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { DataAge } from './components/DataAge';
import { IconRefresh } from './components/Icons';

export const App: React.FC = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [tab, setTab] = useState<'analytics' | 'audit' | 'teams'>('analytics');

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Preset Analytics</h1>
        <nav className="nav-tabs" aria-label="Primary">
          <button className={tab==='analytics' ? 'active' : ''} onClick={()=>setTab('analytics')}>📊 Analytics</button>
          <button className={tab==='audit' ? 'active' : ''} onClick={()=>setTab('audit')}>📜 Audit Logs</button>
          <button className={tab==='teams' ? 'active' : ''} onClick={()=>setTab('teams')}>🧩 Teams</button>
        </nav>
        <div className="actions">
          <DataAge refreshKey={refreshKey} />
          <button className="secondary" onClick={() => setRefreshKey(k => k + 1)} title="Re-read the published JSON snapshot. New data only appears after the nightly GitHub Actions build.">
            <IconRefresh /> Reload
          </button>
        </div>
      </header>
      <main>
  {tab === 'analytics' && <AnalyticsPage refreshKey={refreshKey} />}
  {tab === 'audit' && <AuditLogsPage refreshKey={refreshKey} />}
  {tab === 'teams' && <TeamsPage refreshKey={refreshKey} />}
      </main>
      <footer className="app-footer">Static snapshot generated from Preset API via GitHub Actions. Secrets never exposed client-side.</footer>
    </div>
  );
};
