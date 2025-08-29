import React, { useEffect, useState } from 'react';
import { Card } from '../components/Card';
import { search } from '../utils/search';
import { fetchDataFile } from '../utils/fetchData';

interface UserRecord {
  id: string | number;
  username?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  roles?: (string | number)[];
  [k: string]: unknown;
}

export const UsersPage: React.FC<{ refreshKey: number }> = ({ refreshKey }) => {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true); setError(null);
    Promise.all([
      fetchDataFile('users.json', { optional: true }),
      fetchDataFile('team_members.json', { optional: true })
    ]).then(([usersRaw, membersRaw]) => {
      if (usersRaw.length) { setUsers(usersRaw); return; }
      // Derive users from flattened member records
      const map = new Map<string|number, any>();
      for (const m of membersRaw) {
        const id = m.user_id || m.id || (m.user && m.user.id);
        if (!id) continue;
        if (!map.has(id)) {
          map.set(id, {
            id,
            first_name: m.first_name || m.user?.first_name,
            last_name: m.last_name || m.user?.last_name,
            email: m.email || m.user?.email,
            username: m.username || m.user?.username,
            roles: m.roles || [],
            user_type: m.user_type,
            team_role: m.team_role_name || m.team_role?.name
          });
        }
      }
      setUsers(Array.from(map.values()));
    })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const filtered = query ? users.filter(u => search(u, query)) : users;

  return (
    <div className="grid auto-fill">
  <Card className="full-span" title="Users" actions={<input placeholder="Search" value={query} onChange={e => setQuery(e.target.value)} />}> 
        {loading && <p>Loading…</p>}
        {error && <p className="error">{error}</p>}
        {!loading && !error && (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Username</th>
                  <th>Roles</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id}>
                    <td>{u.id}</td>
                    <td>{[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'}</td>
                    <td>{u.email || '—'}</td>
                    <td>{u.username || '—'}</td>
                    <td>{Array.isArray(u.roles) ? u.roles.join(', ') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <p>No users match.</p>}
          </div>
        )}
      </Card>
    </div>
  );
};
