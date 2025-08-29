import React, { useEffect, useState } from 'react';
import { Card } from '../components/Card';
import { search } from '../utils/search';
import { downloadCSV } from '../utils/download';
import { fetchDataFile } from '../utils/fetchData';

interface Team { id: string | number; name?: string; [k: string]: any }
interface TeamMember { id?: string | number; user_id?: string | number; email?: string; _team_id?: string | number; [k: string]: any }

export const TeamsPage: React.FC<{ refreshKey: number }> = ({ refreshKey }) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'teams' | 'members'>('members');

  useEffect(() => {
    setLoading(true); setError(null);
    Promise.all([
      fetchDataFile('teams.json'),
      fetchDataFile('team_members.json')
    ]).then(([teamsData, membersData]) => { setTeams(teamsData); setMembers(membersData); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const data = view === 'teams' ? teams : members;
  const filtered = query ? data.filter(d => search(d, query)) : data;

  // Precompute counts map
  const memberCount = React.useMemo(() => {
    const map = new Map<string|number, number>();
    for (const m of members) {
      const key = m._team_id as any;
      if (key === undefined) continue;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [members]);

  return (
    <div className="grid auto-fill">
      <Card className="full-span" title={view === 'teams' ? 'Teams' : 'Team Members'} actions={
        <div style={{ display: 'flex', gap: '.5rem' }}>
            <div style={{ display:'flex', gap:'.25rem' }}>
              <button type="button" onClick={() => setView('members')} className={view==='members' ? 'secondary' : ''} style={{opacity:view==='members'?1:.6}}>Members</button>
              <button type="button" onClick={() => setView('teams')} className={view==='teams' ? 'secondary' : ''} style={{opacity:view==='teams'?1:.6}}>Teams</button>
            </div>
          <input placeholder="Search" value={query} onChange={e => setQuery(e.target.value)} />
            <button onClick={() => downloadCSV(filtered as any[], view + '-export.csv')}>Download CSV</button>
        </div>
      }>
        {loading && <p>Loading…</p>}
        {error && <p className="error">{error}</p>}
        {!loading && !error && (
          <div className="table-wrapper">
            {view === 'teams' && (
              <table>
                <thead><tr><th>ID</th><th>Name</th><th>Title</th><th>Members</th></tr></thead>
                <tbody>
                  {filtered.map(t => {
                    const id = t.id || (t as any).uuid;
                    const count = memberCount.get(id) || 0;
                    return <tr key={String(id)}><td>{id}</td><td>{t.name || '—'}</td><td>{(t as any).title || '—'}</td><td>{count}</td></tr>;
                  })}
                </tbody>
              </table>
            )}
            {view === 'members' && (
              <table>
                <thead><tr><th>User ID</th><th>Name</th><th>Email</th><th>Role</th><th>Type</th></tr></thead>
                <tbody>
                  {filtered.map(m => {
                    const name = [m.first_name, m.last_name].filter(Boolean).join(' ') || '—';
                    return <tr key={String(m.user_id || m.id || Math.random())}>
                      <td>{m.user_id || m.id || '—'}</td>
                      <td>{name}</td>
                      <td>{m.email || '—'}</td>
                      <td>{m.team_role_name || (m as any).team_role?.name || '—'}</td>
                      <td>{m.user_type || '—'}</td>
                    </tr>;
                  })}
                </tbody>
              </table>
            )}
            {filtered.length === 0 && <p>No records.</p>}
          </div>
        )}
      </Card>
    </div>
  );
};
