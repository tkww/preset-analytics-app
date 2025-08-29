// Basic deep search utility for filtering
export function search(obj: unknown, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  const visit = (val: unknown): boolean => {
    if (val == null) return false;
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
      return String(val).toLowerCase().includes(needle);
    }
    if (Array.isArray(val)) return val.some(visit);
    if (typeof val === 'object') return Object.values(val).some(visit);
    return false;
  };
  return visit(obj);
}
