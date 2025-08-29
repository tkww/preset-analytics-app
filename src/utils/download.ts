import { dump } from 'js-yaml';

export function downloadYAML(data: unknown, filename: string) {
  const yaml = dump(data, { lineWidth: 120 });
  const blob = new Blob([yaml], { type: 'text/yaml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.yaml') ? filename : `${filename}.yaml`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}

export function downloadCSV(rows: any[], filename: string) {
  if (!Array.isArray(rows) || !rows.length) return;
  // Collect column set from union of keys (excluding nested objects except flatten common user fields)
  const columns = Array.from(new Set(rows.flatMap(r => Object.keys(r)))).filter(k => !k.startsWith('_') && typeof rows[0][k] !== 'object');
  const escape = (v: any) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
    return s;
  };
  const header = columns.join(',');
  const lines = rows.map(r => columns.map(c => escape(r[c])).join(','));
  const csv = [header, ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
}
