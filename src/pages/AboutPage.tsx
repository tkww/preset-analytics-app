import React, { useEffect, useState } from 'react';
import { Card } from '../components/Card';
import { fetchDataFile } from '../utils/fetchData';

interface Summary { [k: string]: any }

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString() : '—');

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <>
    <dt style={{ opacity: .7, fontSize: '.75rem' }}>{label}</dt>
    <dd style={{ margin: 0, fontSize: '.8rem' }}>{children}</dd>
  </>
);

export const AboutPage: React.FC<{ refreshKey: number }> = ({ refreshKey }) => {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    fetchDataFile('summary.json', { optional: true })
      .then((s: any) => setSummary(Array.isArray(s) ? null : s))
      .catch(() => setSummary(null));
  }, [refreshKey]);

  const audit = summary?.audit_logs;

  return (
    <div className="grid auto-fill">
      <Card className="full-span" title="About this dashboard">
        <p style={{ fontSize: '.85rem', lineHeight: 1.6 }}>
          A static snapshot of Preset activity for the Data Ops team. There is no live connection to
          Preset from your browser — a scheduled GitHub Actions job calls the Preset API, writes the
          results to JSON, and publishes them with the site.
        </p>
      </Card>

      <Card title="Current snapshot">
        <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '.4rem 1rem', margin: 0 }}>
          <Row label="Built">{fmt(summary?.generated_at)}</Row>
          <Row label="Audit events">{audit?.count?.toLocaleString() ?? '—'}</Row>
          <Row label="Coverage">{audit ? `${fmt(audit.earliest)} → ${fmt(audit.latest)}` : '—'}</Row>
          <Row label="Fetched this run">{audit?.fetched_this_run?.toLocaleString() ?? '—'}</Row>
          <Row label="Teams">{summary?.teams?.count ?? '—'}</Row>
          <Row label="Team members">{summary?.team_members?.count ?? '—'}</Row>
        </dl>
      </Card>

      <Card title="How data is refreshed">
        <ul style={{ fontSize: '.8rem', lineHeight: 1.6, paddingLeft: '1.1rem', margin: 0 }}>
          <li>A GitHub Actions job runs every 6 hours, and on every push to <code>main</code>.</li>
          <li>It reads Preset API credentials from AWS SSM — they exist only inside the runner and are never sent to the browser.</li>
          <li><strong>Reload</strong> re-reads the published snapshot. It cannot pull new data from Preset; new data appears only after the job runs.</li>
          <li>The header shows how old the snapshot is, and warns once it exceeds 36 hours.</li>
        </ul>
      </Card>

      <Card title="Why history keeps growing">
        <p style={{ fontSize: '.8rem', lineHeight: 1.6, margin: 0 }}>
          The Preset audit API only returns a rolling {audit?.window_days ?? 30}-day window, and each
          response is capped at 100 rows. The fetch job pages through the full window and merges the
          result into the previously committed dataset rather than replacing it, so coverage extends
          further back than the API alone allows and grows with every run.
        </p>
      </Card>

      <Card title="Workspaces">
        <p style={{ fontSize: '.8rem', lineHeight: 1.6, margin: 0 }}>
          Production, Pre-Production and Sandbox are always listed on the Analytics and Audit Logs
          pages, even when a workspace has no events in the current selection — an idle workspace
          reads as empty rather than disappearing. Events with no workspace attached, such as team
          membership changes, are grouped under <em>Unknown</em>.
        </p>
      </Card>

      <Card title="Questions & source">
        <p style={{ fontSize: '.8rem', lineHeight: 1.6, margin: '0 0 .6rem' }}>
          Questions, data issues or feature requests: reach the Data Ops team in the Slack channel{' '}
          <strong>#data-ops-support</strong>.
        </p>
        <p style={{ fontSize: '.8rem', lineHeight: 1.6, margin: 0 }}>
          Source and refresh workflow:{' '}
          <a href="https://github.com/tkww/preset-analytics-app" target="_blank" rel="noreferrer">
            github.com/tkww/preset-analytics-app
          </a>
        </p>
      </Card>
    </div>
  );
};
