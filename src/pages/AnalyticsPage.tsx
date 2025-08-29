import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/Card';
import { fetchDataFile } from '../utils/fetchData';
import { search } from '../utils/search';

interface AuditLog { [k: string]: any }

interface BarDatum { label: string; value: number; extra?: string }

const HBarChart: React.FC<{ data: BarDatum[]; maxBars?: number; title: string; valueLabel?: string }>
 = ({ data, maxBars = 10, title, valueLabel = 'count' }) => {
  if (!data.length) return null;
  const top = data.slice(0, maxBars);
  const maxVal = Math.max(...top.map(d => d.value));
  return (
    <div className="hbar-block">
      <h3>{title}</h3>
      <div className="hbar-list">
        {top.map(d => (
          <div key={d.label} className="hbar-row" title={d.extra || d.label}>
            <div className="hbar-label">{d.label}</div>
            <div className="hbar-bar-wrap">
              <div className="hbar-bar" style={{width: (d.value / maxVal * 100) + '%'}} />
            </div>
            <div className="hbar-val" aria-label={valueLabel}>{d.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const AnalyticsPage: React.FC<{ refreshKey: number }> = ({ refreshKey }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [workspace, setWorkspace] = useState<string>('ALL');
  const [query, setQuery] = useState('');
  const [range, setRange] = useState<'week' | 'month' | 'year'>('week');

  useEffect(() => {
    setLoading(true); setError(null);
    fetchDataFile('audit_logs.json', { optional: true })
      .then(d => setLogs(d))
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const workspaces = useMemo(() => {
    const found = new Set<string>();
    logs.forEach(l => {
      const title = (l.workspace_title || l.workspace_name || 'unknown').trim() || 'unknown';
      found.add(title);
    });
    const desiredOrder = ['Production','Pre-Production','Sandbox','unknown'];
    const ordered: string[] = ['ALL'];
    desiredOrder.forEach(name => {
      // case-insensitive match of exact desired name present in set
      for (const f of Array.from(found)) {
        if (f.toLowerCase() === name.toLowerCase()) {
          ordered.push(f);
          found.delete(f);
          break;
        }
      }
    });
    // Append any remaining workspaces (alphabetical) not already added
    const remaining = Array.from(found).filter(f => !ordered.includes(f)).sort((a,b)=>a.localeCompare(b));
    return [...ordered, ...remaining];
  }, [logs]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const rangeMs = range === 'week' ? 7*24*3600*1000 : range === 'month' ? 30*24*3600*1000 : 365*24*3600*1000;
    const cutoff = now - rangeMs;
    return logs.filter(l => {
      if (workspace !== 'ALL' && (l.workspace_title || l.workspace_name || 'Unknown') !== workspace) return false;
      if (query && !search(l, query)) return false;
      const ts = l.timestamp ? Date.parse(l.timestamp) : NaN;
      if (!isNaN(ts) && ts < cutoff) return false; // keep only within range
      return true;
    });
  }, [logs, workspace, query, range]);

  const metrics = useMemo(() => {
    if (!filtered.length) return { chartViews: [], dashboardViews: [], activeUsers: [], actionCounts: [] };
    const chartMap: Record<string, number> = {};
    const dashMap: Record<string, number> = {};
    const userMap: Record<string, number> = {};
    const actionMap: Record<string, number> = {};
    filtered.forEach(l => {
      const action = l.action || l.event || l.type;
      if (action) actionMap[action] = (actionMap[action]||0)+1;
      const user = typeof l.user === 'string' ? l.user : (l.user?.email || l.user_email || 'Unknown');
      userMap[user] = (userMap[user]||0)+1;
      if (action === 'chart:view' && l.entity_name) chartMap[l.entity_name] = (chartMap[l.entity_name]||0)+1;
      if (action === 'dashboard:view' && l.entity_name) dashMap[l.entity_name] = (dashMap[l.entity_name]||0)+1;
    });
    const toSorted = (m: Record<string, number>): BarDatum[] => Object.entries(m)
      .map(([label,value]) => ({label, value}))
      .sort((a,b)=>b.value-a.value);
    return {
      chartViews: toSorted(chartMap),
      dashboardViews: toSorted(dashMap),
      activeUsers: toSorted(userMap),
      actionCounts: toSorted(actionMap),
    };
  }, [filtered]);

  return (
    <div className="grid auto-fill">
      <Card className="full-span" title="Analytics" actions={
        <div style={{display:'flex', gap:'.5rem', alignItems:'center'}}>
          <select value={range} onChange={e=>setRange(e.target.value as any)} title="Time range">
            <option value="week">Week</option>
            <option value="month">Month</option>
            <option value="year">Year</option>
          </select>
            <input placeholder="Search logs" value={query} onChange={e=>setQuery(e.target.value)} />
        </div>
      }>
        {loading && <p>Loading…</p>}
        {error && <p className="error">{error}</p>}
        {!loading && !error && (
          <div className="analytics-body">
            <div className="workspace-filters" style={{display:'flex', flexWrap:'wrap', gap:'.4rem', marginBottom:'1rem'}}>
              {workspaces.map(ws => (
                <button
                  key={ws}
                  className={ws===workspace? 'mini active' : 'mini'}
                  onClick={()=>setWorkspace(ws)}
                  style={ws===workspace?{background:'#3a4b63'}:undefined}
                >{ws}</button>
              ))}
            </div>
            {filtered.length === 0 && <p>No audit log entries for selection.</p>}
            {filtered.length > 0 && (
              <p style={{opacity:.6, fontSize:'.7rem', margin:'0 0 .5rem'}}>{filtered.length} events (last {range === 'week' ? '7 days' : range === 'month' ? '30 days' : '365 days'})</p>
            )}
            {filtered.length > 0 && (
              <div className="charts-grid" style={{display:'grid', gap:'1.25rem', gridTemplateColumns:'repeat(auto-fit,minmax(340px,1fr))'}}>
                <HBarChart title="Top Chart Views" data={metrics.chartViews} />
                <HBarChart title="Top Dashboard Views" data={metrics.dashboardViews} />
                <HBarChart title="Most Active Users" data={metrics.activeUsers} valueLabel="events" />
                <HBarChart title="Action Breakdown" data={metrics.actionCounts} />
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};
