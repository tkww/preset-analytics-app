import React, { useEffect, useState } from 'react';
import { fetchDataFile } from '../utils/fetchData';

const relative = (iso: string): string => {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (!isFinite(mins)) return '';
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

/** Surfaces snapshot age, since the data only changes when the nightly build runs. */
export const DataAge: React.FC<{ refreshKey: number }> = ({ refreshKey }) => {
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  useEffect(() => {
    fetchDataFile('summary.json', { optional: true })
      .then((s: any) => setGeneratedAt(s?.generated_at ?? s?.audit_logs?.generated_at ?? s?.teams?.generated_at ?? null))
      .catch(() => setGeneratedAt(null));
  }, [refreshKey]);

  if (!generatedAt) return null;
  const stale = Date.now() - Date.parse(generatedAt) > 36 * 3600 * 1000;
  return (
    <span
      className="data-age"
      title={`Snapshot built ${new Date(generatedAt).toLocaleString()} by the nightly GitHub Actions job`}
      style={stale ? { color: '#e0a341' } : undefined}
    >
      Data as of {relative(generatedAt)}{stale ? ' ⚠' : ''}
    </span>
  );
};
