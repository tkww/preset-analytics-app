import React, { useEffect, useState } from 'react';
import { Card } from '../components/Card';
import { fetchDataFile } from '../utils/fetchData';
import { search } from '../utils/search';

interface AuditLog { [k: string]: any }

// Helper formatters for form-style rendering
const formatVal = (v: any): string => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v.length > 500 ? v.slice(0,500) + '…' : v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.length === 0 ? '[]' : JSON.stringify(v).slice(0,120) + (JSON.stringify(v).length>120?'…':'');
  if (typeof v === 'object') {
    const keys = Object.keys(v);
    return `{${keys.slice(0,5).join(',')}${keys.length>5?'…':''}}`;
  }
  return String(v);
};

const previewVal = (v: any): string => {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'string') return v.slice(0,120) + (v.length>120?'…':'');
  try { return JSON.stringify(typeof v === 'string' ? JSON.parse(v) : v).slice(0,120) + (JSON.stringify(v).length>120?'…':''); } catch { return String(v).slice(0,120); }
};

const renderStructured = (raw: any): JSX.Element => {
  let obj: any = raw;
  if (typeof raw === 'string') {
    try { obj = JSON.parse(raw); } catch { return <pre style={{margin:'0.5rem 0 0', maxHeight:240, overflow:'auto'}}>{raw}</pre>; }
  }
  if (typeof obj !== 'object' || obj === null) return <pre style={{margin:'0.5rem 0 0'}}>{String(obj)}</pre>;
  const entries = Object.entries(obj);
  return (
    <div style={{margin:'0.5rem 0 0', display:'grid', gridTemplateColumns:'max-content 1fr', gap:'.35rem 1rem', maxHeight:260, overflow:'auto', padding:'.25rem .25rem'}}>
      {entries.map(([k,v]) => (
        <React.Fragment key={k}>
          <label style={{fontSize:'0.75rem', opacity:.8}}>{k}</label>
          <div style={{fontSize:'0.75rem', whiteSpace:'pre-wrap'}}>{typeof v === 'object' && v !== null ? JSON.stringify(v, null, 2) : String(v)}</div>
        </React.Fragment>
      ))}
  {entries.length === 0 && <span style={{gridColumn:'1 / -1', opacity:0.6}}>Empty object</span>}
    </div>
  );
};

export const AuditLogsPage: React.FC<{ refreshKey: number }> = ({ refreshKey }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [showParams, setShowParams] = useState<Record<number, boolean>>({});
  const [showQueryCtx, setShowQueryCtx] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setLoading(true); setError(null);
    fetchDataFile('audit_logs.json', { optional: true })
      .then(d => setLogs(d))
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const filtered = query ? logs.filter(l => search(l, query)) : logs;

  const toggle = (idx: number) => setExpanded(e => ({ ...e, [idx]: !e[idx] }));

  const renderRow = (log: AuditLog, idx: number) => {
    const hiddenKeys = ['params','query_context'];
    const hasHidden = hiddenKeys.some(k => log[k] !== undefined && log[k] !== null);
    const userVal = typeof log.user === 'string' ? log.user : (log.user?.email || log.user_email || log.actor);
    return (
      <tr key={idx}>
        <td style={{whiteSpace:'nowrap'}} title={log.timestamp}>{log.timestamp?.replace('T',' ').replace(/\..+/, '') || '—'}</td>
        <td>{userVal || '—'}</td>
        <td>{log.action || log.event || log.type || '—'}</td>
        <td>{log.entity_type || log.object_type || log.resource_type || '—'}</td>
        <td>{log.entity_name || log.object_name || '—'}</td>
        <td>{log.entity_id || log.object_id || log.resource_id || '—'}</td>
        <td>{log.workspace_title || log.workspace_name || '—'}</td>
        <td>{hasHidden || log.details ? <button className="mini" onClick={() => toggle(idx)}>{expanded[idx] ? 'Hide' : 'Show'}</button> : '—'}</td>
      </tr>
    );
  };

  return (
    <div className="grid auto-fill">
      <Card className="full-span" title="Audit Logs" actions={<input placeholder="Search" value={query} onChange={e => setQuery(e.target.value)} />}> 
        {loading && <p>Loading…</p>}
        {error && <p className="error">{error}</p>}
        {!loading && !error && (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Entity Type</th>
                  <th>Entity Name</th>
                  <th>Entity ID</th>
                  <th>Workspace</th>
                  <th>More</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log, idx) => (
                  <React.Fragment key={idx}>
                    {renderRow(log, idx)}
                    {expanded[idx] && (
                      <tr className="expanded-row">
                        <td colSpan={8} style={{background:'#12161c'}}>
                          <div style={{display:'flex', flexDirection:'column', gap:'1rem'}}>
                            {/* Form-style key/value layout */}
                            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                              <strong style={{fontSize:'0.8rem', letterSpacing:'.5px', opacity:.85}}>All Fields</strong>
                              <button className="mini" onClick={()=>toggle(idx)}>Close</button>
                            </div>
                            <div style={{display:'grid', gridTemplateColumns:'max-content 1fr', gap:'.5rem 1rem', maxHeight:300, overflow:'auto', paddingRight:'.25rem'}}>
                              {(() => {
                                const rows: JSX.Element[] = [];
                                const visited = new Set<string>();
                                const isLarge = (v: any) => typeof v === 'string' && v.length > 500;
                                const pushRow = (path: string, value: any) => {
                                  // Do not skip nested params/query_context (e.g. details.params) – only skip top-level for dedicated sections
                                  if (path === 'params' || path === 'query_context') return;
                                  visited.add(path);
                                  const display = value === null ? 'null' : formatVal(value);
                                  const isJSONish = typeof value === 'string' && /[{[]/.test(value) && /[}\]]/.test(value);
                                  const long = typeof value === 'string' && value.length > 160;
                                  const control = (isJSONish && long) ? (
                                    <textarea
                                      readOnly
                                      style={{width:'100%', fontSize:'0.65rem', lineHeight:'1.1', minHeight: '3.2rem', resize:'vertical'}}
                                      value={value}
                                    />
                                  ) : (
                                    <input style={{width:'100%', fontSize:'0.7rem'}} readOnly value={display} title={typeof value === 'string' ? value : (typeof value === 'object' ? JSON.stringify(value).slice(0,400) : String(value))} />
                                  );
                                  rows.push(<React.Fragment key={path}>
                                    <label title={path} style={{textTransform:'none', fontSize:'0.7rem', opacity:.85}}>{path}</label>
                                    {control}
                                  </React.Fragment>);
                                };
                                const walk = (obj: any, prefix: string = '') => {
                                  if (obj === null) { pushRow(prefix.slice(0,-1), obj); return; }
                                  if (typeof obj !== 'object') { pushRow(prefix.slice(0,-1), obj); return; }
                                  if (Array.isArray(obj)) { pushRow(prefix.slice(0,-1), obj); return; }
                                  for (const [k,v] of Object.entries(obj)) {
                                    const path = prefix + k;
                                    if (v && typeof v === 'object' && !Array.isArray(v) && !(k === 'params' || k === 'query_context')) {
                                      // Recurse but also add a synthetic summary row for this object (if not empty)
                                      if (Object.keys(v).length > 0) {
                                        pushRow(path, v);
                                      } else {
                                        pushRow(path, v); // empty object
                                      }
                                      walk(v, path + '.');
                                    } else {
                                      pushRow(path, v);
                                    }
                                  }
                                };
                                walk(log);
                                if (rows.length === 0) rows.push(<span key="_empty" style={{gridColumn:'1 / -1', opacity:.7}}>No fields.</span>);
                                return rows;
                              })()}
                            </div>
                            {(() => {
                              const paramVal: any = (log as any).params !== undefined ? (log as any).params : (log as any).details?.params;
                              if (paramVal === undefined) return null;
                              return (
                                <div>
                                  <div style={{display:'flex', alignItems:'center', gap:'.5rem'}}>
                                    <strong>params</strong>
                                    <button className="mini" onClick={()=>setShowParams(s=>({...s,[idx]:!s[idx]}))}>{showParams[idx] ? 'Collapse' : 'Expand'}</button>
                                  </div>
                                  {showParams[idx] ? renderStructured(paramVal) : <code style={{opacity:.8}}>{previewVal(paramVal)}</code>}
                                </div>
                              );
                            })()}
                            {(() => {
                              const qcVal: any = (log as any).query_context !== undefined ? (log as any).query_context : (log as any).details?.query_context;
                              if (qcVal === undefined) return null;
                              return (
                                <div>
                                  <div style={{display:'flex', alignItems:'center', gap:'.5rem'}}>
                                    <strong>query_context</strong>
                                    <button className="mini" onClick={()=>setShowQueryCtx(s=>({...s,[idx]:!s[idx]}))}>{showQueryCtx[idx] ? 'Collapse' : 'Expand'}</button>
                                  </div>
                                  {showQueryCtx[idx] ? renderStructured(qcVal) : <code style={{opacity:.8}}>{previewVal(qcVal)}</code>}
                                </div>
                              );
                            })()}
                            {(() => {
                              const paramVal: any = (log as any).params !== undefined ? (log as any).params : (log as any).details?.params;
                              const qcVal: any = (log as any).query_context !== undefined ? (log as any).query_context : (log as any).details?.query_context;
                              if (paramVal === undefined && qcVal === undefined) {
                                return <code style={{opacity:.7}}>No params/query_context present.</code>;
                              }
                              return null;
                            })()}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <p>No logs.</p>}
          </div>
        )}
      </Card>
    </div>
  );
};
