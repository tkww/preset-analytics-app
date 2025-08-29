// Resilient data fetch that tries current Vite base, then root-relative, then bare relative
export async function fetchDataFile(file: string, { optional }: { optional?: boolean } = {}) {
  const cacheBust = `ck=${Date.now()}`;
  const base = ((import.meta as any).env.BASE_URL || '/').replace(/\/+/g,'/');
  const normalizedBase = base.endsWith('/') ? base : base + '/';
  const names = [
    `${normalizedBase}data/${file}`,
    `/data/${file}`,
    `data/${file}`,
    `/preset-analytics-app/data/${file}`
  ];
  const candidates = [...new Set(names)].map(u => `${u}?${cacheBust}`);
  const errors: string[] = [];
  for (const url of candidates) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) return res.json();
      errors.push(`${url} -> ${res.status}`);
    } catch (e: any) {
      errors.push(`${url} -> ${e.message}`);
    }
  }
  if (optional) return [];
  throw new Error(`All fetch attempts failed for ${file}:\n${errors.join('\n')}`);
}
