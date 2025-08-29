import React, { useEffect, useState } from 'react';
import { Card } from '../components/Card';
import { search } from '../utils/search';
import { fetchDataFile } from '../utils/fetchData';

interface RoleRecord {
  id: string | number;
  name?: string;
  permissions?: string[];
  [k: string]: unknown;
}

export const RolesPage: React.FC<{ refreshKey: number }> = ({ refreshKey }) => {
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true); setError(null);
    Promise.all([
      fetchDataFile('roles.json', { optional: true }),
      fetchDataFile('team_members.json', { optional: true })
    ]).then(([rolesRaw, membersRaw]) => {
      if (rolesRaw.length) { setRoles(rolesRaw); return; }
      const set = new Map<string, any>();
      for (const m of membersRaw) {
        const roleName = m.team_role_name || m.team_role?.name;
        if (roleName && !set.has(roleName)) set.set(roleName, { id: roleName, name: roleName });
      }
      setRoles(Array.from(set.values()));
    })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const filtered = query ? roles.filter(r => search(r, query)) : roles;

  return (
    <div className="grid auto-fill">
  <Card className="full-span" title="Roles" actions={<input placeholder="Search" value={query} onChange={e => setQuery(e.target.value)} />}> 
        {loading && <p>Loading…</p>}
        {error && <p className="error">{error}</p>}
        {!loading && !error && (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Permissions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>{r.name || '—'}</td>
                    <td>{Array.isArray(r.permissions) ? r.permissions.join(', ') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <p>No roles match.</p>}
          </div>
        )}
      </Card>
    </div>
  );
};
