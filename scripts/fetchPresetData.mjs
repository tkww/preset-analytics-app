#!/usr/bin/env node
/**
 * Fetch Preset users & roles using API token/secret and store as static JSON
 * to be served by GitHub Pages without exposing credentials at runtime.
 *
 * Environment expected:
 *   PRESET_API_TOKEN
 *   PRESET_API_SECRET
 * Optional:
 *   PRESET_API_BASE (default: https://api.app.preset.io)
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const token = process.env.PRESET_API_TOKEN; // API token / name
const secret = process.env.PRESET_API_SECRET; // API secret
const presetBearer = process.env.PRESET_BEARER; // Optional: direct bearer token (skips /v1/auth/)
const base = process.env.PRESET_API_BASE || 'https://api.app.preset.io';

if (!token || !secret) {
  console.error('Missing PRESET_API_TOKEN or PRESET_API_SECRET');
  process.exit(1);
}

// Helper fetch wrapper (Node 18+ global fetch)
let cachedJWT = null;
let attemptedAuth = false;
let debugAuthPayload = null;
let sessionCookie = null; // raw cookie string(s)
async function obtainJWT() {
  // Short-circuit if caller supplied a ready bearer token (debug / alt usage)
  if (presetBearer) { cachedJWT = presetBearer; return cachedJWT; }
  if (cachedJWT) return cachedJWT;
  if (attemptedAuth && !cachedJWT && sessionCookie) return null; // we have cookie-based session
  if (attemptedAuth && !cachedJWT && !sessionCookie) throw new Error('Auth previously failed');
  attemptedAuth = true;
  const authUrl = `${base.replace(/\/$/, '')}/v1/auth/`;
  // Attempt JSON POST first
  try {
    // Primary expected schema appears to want name + secret (based on 400 response mentioning those fields)
    const primaryBody = { name: token, secret };
    let res = await fetch(authUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(primaryBody) });
    if (res.status === 400) {
      // Retry legacy field names if validation complained
      res = await fetch(authUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ api_token: token, api_secret: secret }) });
    }
    if (res.ok) {
      const json = await res.json();
      debugAuthPayload = json;
      const jwtExtracted = extractJWT(json, res.headers);
      // Capture cookie if provided
      const setCookie = res.headers.get('set-cookie');
      if (setCookie) sessionCookie = setCookie.split(/,(?=[^;]+;)/).map(s => s.split(';')[0]).join('; ');
      if (jwtExtracted) { cachedJWT = jwtExtracted; return jwtExtracted; }
      if (sessionCookie) { console.log('Auth POST produced session cookie (no JWT). Using cookie auth.'); return null; }
      console.warn('Auth POST succeeded but no jwt field found');
    } else {
      const body = await res.text().catch(()=> '');
      console.warn(`Auth POST failed ${res.status} ${res.statusText} body≈ ${body.slice(0,120)}`);
    }
  } catch (e) {
    console.warn('Auth POST error', e.message);
  }
  // Fallback: Basic GET
  try {
    const res = await fetch(authUrl, {
      headers: { 'Authorization': `Basic ${Buffer.from(`${token}:${secret}`).toString('base64')}` }
    });
    if (res.ok) {
      const json = await res.json();
      debugAuthPayload = debugAuthPayload || json;
      const jwtExtracted = extractJWT(json, res.headers);
      const setCookie = res.headers.get('set-cookie');
      if (setCookie) sessionCookie = setCookie.split(/,(?=[^;]+;)/).map(s => s.split(';')[0]).join('; ');
      if (jwtExtracted) { cachedJWT = jwtExtracted; return jwtExtracted; }
      if (sessionCookie) { console.log('Auth GET produced session cookie (no JWT). Using cookie auth.'); return null; }
    } else {
      const body = await res.text().catch(()=> '');
      console.warn(`Auth GET failed ${res.status} ${res.statusText} body≈ ${body.slice(0,120)}`);
    }
  } catch (e) {
    console.warn('Auth GET error', e.message);
  }
  if (sessionCookie) return null;
  throw new Error('Unable to obtain JWT or session cookie from /v1/auth/');
}

function extractJWT(json, headers) {
  if (!json) return null;
  const candidates = [
    json.jwt,
    json.access_token,
    json.token,
    json.id_token,
  json?.payload?.access_token,
  json?.payload?.token,
    json?.data?.jwt,
    json?.data?.access_token,
    json?.result?.jwt,
    json?.result?.token
  ].filter(Boolean);
  if (candidates.length) return candidates[0];
  // Header fallback
  if (headers) {
    const auth = headers.get('Authorization') || headers.get('authorization');
    if (auth && /bearer /i.test(auth)) return auth.split(/\s+/).pop();
    const xToken = headers.get('x-access-token') || headers.get('X-Access-Token');
    if (xToken) return xToken;
  }
  return null;
}

async function api(relative, opts = {}) {
  const url = `${base.replace(/\/$/, '')}${relative}`;
  let jwt;
  try { jwt = await obtainJWT(); } catch (e) { console.error('Auth obtain failed; API call aborted', e.message); return undefined; }
  const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
  if (jwt) headers['Authorization'] = `Bearer ${jwt}`;
  else if (sessionCookie) headers['Cookie'] = sessionCookie;
  try {
    return await fetch(url, { headers, ...opts });
  } catch (e) {
    console.warn(`Network error for ${relative}: ${e.message}`);
    return undefined;
  }
}

/**
 * Try a list of candidate endpoints (first success wins). Supports both Preset
 * "v1" style and Superset-style "/api/v1/" endpoints. For Superset style, data
 * often lives in `result` property, while Preset custom endpoints may use `data`.
 */
async function tryEndpoints(label, candidates, { paginated = false, pageSize = 100 } = {}) {
  for (const endpoint of candidates) {
    try {
      if (paginated) {
        let page = 0;
        const out = [];
        while (true) {
          page += 1;
          const sep = endpoint.includes('?') ? '&' : '?';
          const paged = `${endpoint}${sep}q=${encodeURIComponent(JSON.stringify({ page, page_size: pageSize }))}`;
          const res = await api(paged);
          if (!res) throw new Error('No response');
          if (res.status === 404) break;
          if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
          const json = await res.json();
          const items = Array.isArray(json?.result) ? json.result : Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
          if (items.length === 0) { if (page === 1) throw new Error('Empty first page'); break; }
          out.push(...items);
          if (!json?.result || items.length < pageSize) break;
          if (page > 50) { console.warn(`Stopping pagination for ${label}; >50 pages.`); break; }
        }
        if (out.length) { console.log(`${label}: fetched ${out.length} records from ${endpoint}`); return out; }
      } else {
        const res = await api(endpoint);
        if (!res) throw new Error('No response');
        if (res.status === 404) { const text = await res.text().catch(()=> ''); console.warn(`${label}: 404 ${endpoint} body≈ ${text.slice(0,120).replace(/\n/g,' ')}`); continue; }
        if (!res.ok) { const text = await res.text().catch(()=> ''); throw new Error(`${res.status} ${res.statusText} body≈ ${text.slice(0,120).replace(/\n/g,' ')}`); }
        const json = await res.json();
        const items = Array.isArray(json?.data) ? json.data : Array.isArray(json?.result) ? json.result : Array.isArray(json) ? json : [];
        if (!items.length) throw new Error('No items');
        console.log(`${label}: fetched ${items.length} records from ${endpoint}`);
        return items;
      }
    } catch (e) {
      console.warn(`${label}: endpoint failed ${endpoint} -> ${e.message}`);
    }
  }
  console.error(`${label}: all candidate endpoints failed.`);
  return [];
}

const AUDIT_DAYS = Number(process.env.PRESET_AUDIT_DAYS || 30);
const AUDIT_PAGE_SIZE = Number(process.env.PRESET_AUDIT_PAGE_SIZE || 100);
const AUDIT_MAX_PAGES = Number(process.env.PRESET_AUDIT_MAX_PAGES || 200);
const AUDIT_MERGE = process.env.PRESET_AUDIT_MERGE !== '0';

// The API only exposes a rolling window, so each run is merged into the committed
// dataset instead of replacing it; otherwise history older than the window is lost.
const auditKey = (l) => [
  l.timestamp,
  typeof l.user === 'string' ? l.user : l.user?.email,
  l.action,
  l.entity_type,
  l.entity_id,
  l.workspace_name
].join('|');

async function mergeAuditHistory(outDir, fresh) {
  if (!AUDIT_MERGE) return fresh;
  let existing = [];
  try {
    const parsed = JSON.parse(await fs.readFile(path.join(outDir, 'audit_logs.json'), 'utf8'));
    if (Array.isArray(parsed)) existing = parsed;
  } catch { /* first run, or unreadable snapshot */ }
  const byKey = new Map(existing.map(l => [auditKey(l), l]));
  const before = byKey.size;
  fresh.forEach(l => { const k = auditKey(l); if (!byKey.has(k)) byKey.set(k, l); });
  const merged = [...byKey.values()].sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
  console.log(`audit_logs: retained ${before}, fetched ${fresh.length}, added ${merged.length - before} -> ${merged.length} total`);
  return merged;
}

// The audit endpoint caps each response at ~100 rows, so a single request only
// covers a few hours and silently drops quieter workspaces (e.g. Production).
// Preset has shipped several pagination conventions, so probe until one advances.
const AUDIT_PAGE_PARAM_STYLES = [
  (page, size) => `page_number=${page}&page_size=${size}`,
  (page, size) => `page=${page}&page_size=${size}`,
  (page, size) => `offset=${(page - 1) * size}&limit=${size}`,
];

const extractAuditItems = (json) => {
  if (Array.isArray(json)) return json;
  for (const key of ['data', 'result', 'payload', 'logs']) {
    if (Array.isArray(json?.[key])) return json[key];
  }
  return [];
};

async function fetchAuditPage(teamId, pageQuery) {
  const endpoint = `/v2/audit/teams/${encodeURIComponent(teamId)}/logs?days=${AUDIT_DAYS}${pageQuery ? `&${pageQuery}` : ''}`;
  const res = await api(endpoint);
  if (!res) return { failed: true };
  if (!res.ok) {
    console.warn(`audit_logs: ${res.status} ${endpoint}`);
    return { failed: true };
  }
  return { items: extractAuditItems(await res.json()) };
}

/** Returns all audit log rows for a team, or null when the endpoint is unusable. */
async function fetchAuditLogs(teamId) {
  const first = await fetchAuditPage(teamId, null);
  if (first.failed) return null;
  if (!first.items.length) return null;

  const seen = new Set(first.items.map(l => JSON.stringify(l)));
  const collected = [...first.items];
  if (first.items.length < AUDIT_PAGE_SIZE) return collected;

  for (const style of AUDIT_PAGE_PARAM_STYLES) {
    const styleSeen = new Set(seen);
    const styleItems = [];
    for (let page = 2; page <= AUDIT_MAX_PAGES; page++) {
      const { failed, items } = await fetchAuditPage(teamId, style(page, AUDIT_PAGE_SIZE));
      if (failed || !items.length) break;
      const fresh = items.filter(l => !styleSeen.has(JSON.stringify(l)));
      if (!fresh.length) break; // param ignored by the API, or end of history
      fresh.forEach(l => styleSeen.add(JSON.stringify(l)));
      styleItems.push(...fresh);
      if (items.length < AUDIT_PAGE_SIZE) break;
    }
    if (styleItems.length) {
      console.log(`audit_logs: paginated team ${teamId} with "${style(2, AUDIT_PAGE_SIZE)}" -> +${styleItems.length}`);
      return [...collected, ...styleItems];
    }
  }

  console.warn(`audit_logs: team ${teamId} returned a full page but no pagination style advanced; results truncated at ${collected.length}`);
  return collected;
}

async function main() {
  const outDir = path.resolve('public/data');
  await fs.mkdir(outDir, { recursive: true });

    // Optional legacy user/role fetch can be enabled via PRESET_FETCH_USERS=1 / PRESET_FETCH_ROLES=1
    const fetchUsers = process.env.PRESET_FETCH_USERS === '1';
    const fetchRoles = process.env.PRESET_FETCH_ROLES === '1';
    const users = fetchUsers ? await tryEndpoints('users', ['/api/v1/user/','/api/v1/users','/v1/users'], { paginated: true }) : [];
    const roles = fetchRoles ? await tryEndpoints('roles', ['/api/v1/role/','/api/v1/roles','/v1/roles'], { paginated: true }) : [];

  // --- Teams / Team Members (primary new requirement) ---
  // Endpoint defaults (configurable)
  const teamsEndpoint = process.env.PRESET_TEAMS_ENDPOINT || '/v1/teams/';
  const teamMembersPattern = process.env.PRESET_TEAM_MEMBERS_PATTERN || '/v1/teams/{team_id}/memberships';
  const teamMembersFallbacks = [
    teamMembersPattern,
    '/v1/teams/{team_id}/memberships/',
    '/v1/teams/{team_id}/members',
    '/v1/teams/{team_id}/members/',
    '/v1/teams/{team_id}/users',
    '/v1/teams/{team_id}/users/'
  ];

  let teams = [];
  let rawTeamsResponse = null;
  try {
    const res = await api(teamsEndpoint);
    if (res?.ok) {
      const json = await res.json();
      rawTeamsResponse = json;
      // Flexible extraction heuristics
      if (Array.isArray(json)) teams = json;
      else if (Array.isArray(json?.data)) teams = json.data;
      else if (Array.isArray(json?.result)) teams = json.result;
      else if (Array.isArray(json?.payload?.data)) teams = json.payload.data;
      else {
        // Scan for first array property whose name contains 'team'
        for (const [k,v] of Object.entries(json || {})) {
          if (/team/i.test(k) && Array.isArray(v) && v.length) { teams = v; break; }
        }
        // Fallback: any array of objects containing id & (name|slug)
        if (!teams.length) {
          for (const v of Object.values(json || {})) {
            if (Array.isArray(v) && v.some(o => o && typeof o === 'object' && ('id' in o) && ('name' in o || 'slug' in o))) { teams = v; break; }
          }
        }
      }
      console.log(`teams: fetched ${teams.length}`);
    } else if (res) {
      const body = await res.text().catch(()=> '');
      console.warn(`teams endpoint failed ${res.status} ${res.statusText} body≈ ${body.slice(0,120)}`);
    }
  } catch (e) { console.warn('teams fetch error', e.message); }

  // Fetch members per team (aggregate)
  const teamMembers = [];
  const auditLogsAll = [];
  for (const t of teams) {
    const numericId = t?.id || t?.team_id;
    const nameId = t?.name || t?.slug || t?.title; // observed membership endpoint uses name (e.g. /v1/teams/{name}/memberships)
    const uuidId = t?.uuid;
    const identifiers = [nameId, numericId, uuidId].filter(v => v !== undefined && v !== null).map(String);
    const uniqueIds = [...new Set(identifiers)];
    if (!uniqueIds.length) continue;
    let got = false;
    for (const candidate of uniqueIds) {
      for (const pattern of teamMembersFallbacks) {
        const ep = pattern.replace('{team_id}', encodeURIComponent(candidate));
        try {
          const res = await api(ep);
          if (!res) continue;
            if (res.status === 404) { console.warn(`team_members: ${candidate} 404 ${ep}`); continue; }
            if (!res.ok) { console.warn(`team_members: ${candidate} ${res.status} ${ep}`); continue; }
          const json = await res.json();
          // Flexible extraction similar to teams
          let items = [];
          if (Array.isArray(json)) items = json;
          else if (Array.isArray(json?.data)) items = json.data;
          else if (Array.isArray(json?.result)) items = json.result;
          else if (Array.isArray(json?.payload)) items = json.payload;
          else if (Array.isArray(json?.payload?.data)) items = json.payload.data;
          if (!items.length) {
            // scan for first array with user_id or email
            for (const v of Object.values(json || {})) {
              if (Array.isArray(v) && v.some(o => o && typeof o === 'object' && ('user_id' in o || 'email' in o))) { items = v; break; }
            }
          }
          if (items.length) {
            items.forEach(m => {
              const u = m?.user || {};
              teamMembers.push({
                ...m,
                _team_id: numericId ?? nameId,
                _team_identifier_used: candidate,
                email: u.email,
                first_name: u.first_name,
                last_name: u.last_name,
                username: u.username,
                user_id: u.id ?? m.user_id ?? m.id,
                team_role_name: m?.team_role?.name
              });
            });
          }
          console.log(`team_members: team ${numericId ?? nameId} via ${ep} -> ${items.length}`);
          if (process.env.PRESET_DEBUG_TEAM_MEMBERS === '1') {
            const dumpName = `_team_members_raw_${(numericId ?? nameId)}.json`;
            try { await fs.writeFile(path.join(outDir, dumpName), JSON.stringify(json, null, 2)); } catch {}
          }
          got = true;
          break;
        } catch (e) { console.warn(`team_members: ${candidate} error ${e.message}`); }
      }
      if (got) break;
    }
    if (!got) console.warn(`team_members: ${(numericId ?? nameId)} all patterns failed`);

    // Audit logs fetch (once per team, paginated across all workspaces)
    const auditTried = new Set();
    for (const candidate of uniqueIds) {
      if (auditTried.has(candidate)) continue;
      auditTried.add(candidate);
      const items = await fetchAuditLogs(candidate);
      if (items === null) continue; // endpoint unusable for this identifier
      items.forEach(l => auditLogsAll.push({ ...l, _team_id: numericId ?? nameId, _team_identifier_used: candidate }));
      console.log(`audit_logs: team ${numericId ?? nameId} -> ${items.length}`);
      break; // stop after first successful identifier
    }
  }

  const usersFinal = users;
  const rolesFinal = roles;
  const auditLogs = await mergeAuditHistory(outDir, auditLogsAll);

  const timestamp = new Date().toISOString();
  const metaWrap = (arr) => ({ generated_at: timestamp, count: arr.length, data: arr.slice(0,3).map(o=>o?.id ?? o?.name ?? 'sample') });

  await fs.writeFile(path.join(outDir, 'users.json'), JSON.stringify(usersFinal, null, 2));
  await fs.writeFile(path.join(outDir, 'roles.json'), JSON.stringify(rolesFinal, null, 2));
  await fs.writeFile(path.join(outDir, 'teams.json'), JSON.stringify(teams, null, 2));
  await fs.writeFile(path.join(outDir, 'team_members.json'), JSON.stringify(teamMembers, null, 2));
  await fs.writeFile(path.join(outDir, 'audit_logs.json'), JSON.stringify(auditLogs, null, 2));
  const auditTimestamps = auditLogs.map(l => l.timestamp).filter(Boolean).sort();
  await fs.writeFile(path.join(outDir, 'summary.json'), JSON.stringify({
    generated_at: timestamp,
    users: metaWrap(usersFinal),
    roles: metaWrap(rolesFinal),
    teams: metaWrap(teams),
    team_members: metaWrap(teamMembers),
    audit_logs: {
      generated_at: timestamp,
      count: auditLogs.length,
      fetched_this_run: auditLogsAll.length,
      window_days: AUDIT_DAYS,
      earliest: auditTimestamps[0] ?? null,
      latest: auditTimestamps[auditTimestamps.length - 1] ?? null
    }
  }, null, 2));
  if (process.env.PRESET_DEBUG_AUTH === '1' && debugAuthPayload) {
    await fs.writeFile(path.join(outDir, '_auth_debug.json'), JSON.stringify(debugAuthPayload, null, 2));
  }
  if (process.env.PRESET_DEBUG_TEAMS === '1' && rawTeamsResponse) {
    await fs.writeFile(path.join(outDir, '_teams_raw.json'), JSON.stringify(rawTeamsResponse, null, 2));
  }
  console.log(`Wrote (users:${usersFinal.length}) (roles:${rolesFinal.length}) (teams:${teams.length}) (team_members:${teamMembers.length}).`);
}

main().catch(err => { console.error(err); process.exit(1); });
