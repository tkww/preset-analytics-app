# Preset Analytics App

Static React (Vite) dashboard that displays snapshot data about Preset teams (and optionally users & roles). Data is fetched during the GitHub Actions build using secure AWS SSM stored credentials and emitted as static JSON (`public/data/*.json`). No secrets or API calls occur client-side at runtime.

## Features Overview

- Teams & Members: View teams, member roles, CSV export.
- Audit Logs: Inspect recent events with expandable details, including raw params/query_context when present.
- Analytics (NEW): Lightweight derived charts from audit logs (top chart views, top dashboard views, most active users, action breakdown) with per-workspace filters and search.

## Architecture

1. GitHub Action retrieves `/dataops/preset/data-ops-team-api-token` from AWS SSM (JSON containing `api_token` and `api_secret`).
2. Action exports `PRESET_API_TOKEN` & `PRESET_API_SECRET` as environment variables.
3. Node script `scripts/fetchPresetData.mjs` calls Preset REST API endpoints and writes JSON payloads into `public/data/`.
4. Site builds & deploys to GitHub Pages (`gh-pages` branch). React app fetches the static JSON.

## Local Development

Set env vars (never commit them):

```bash
export PRESET_API_TOKEN="..."
export PRESET_API_SECRET="..."
npm install
npm run fetch:data
npm run dev
```

Open http://localhost:5173/preset-analytics-app/ (adjust base if running locally; you can also remove `base` in `vite.config.ts` for local simplicity).

## Deployment

Push to `main` triggers data fetch + build + deploy. A nightly cron also refreshes data. See workflow in `.github/workflows/deploy.yml`.

## Security Notes

Secrets exist only inside the GitHub Actions runtime and are not embedded in final JS. JSON output should contain only non-sensitive metadata. Review data before exposing publicly.

## Customizing Data Retrieval

Environment variables:

```bash
# Required credentials
export PRESET_API_TOKEN=...   # sometimes called name
export PRESET_API_SECRET=...

# Optional direct bearer token (skips /v1/auth/ exchange)
export PRESET_BEARER=...

# Enable legacy users / roles fetch
export PRESET_FETCH_USERS=1
export PRESET_FETCH_ROLES=1

# Override endpoints
export PRESET_TEAMS_ENDPOINT="/v1/teams/"
export PRESET_TEAM_MEMBERS_PATTERN="/v1/teams/{team_id}/memberships"

# Debug dumps (_auth_debug.json / _teams_raw.json)
export PRESET_DEBUG_AUTH=1
export PRESET_DEBUG_TEAMS=1
```

Outputs:
`teams.json`, `team_members.json`, and optionally `users.json`, `roles.json`, plus a `summary.json` with counts.

If enabled via audit log fetch, `audit_logs.json` powers the Analytics & Audit Logs tabs.

## License

Proprietary / Internal Use (adjust as needed).
