export const UNKNOWN_WORKSPACE = 'Unknown';

// Always offered so an idle workspace is visibly empty rather than silently absent.
const KNOWN_WORKSPACES = ['Production', 'Pre-Production', 'Sandbox'];

export const workspaceOf = (log: any): string =>
  String(log?.workspace_title || log?.workspace_name || '').trim() || UNKNOWN_WORKSPACE;

/** Filter options ordered ALL, known workspaces, then any extras found in the data. */
export function workspaceOptions(logs: any[]): string[] {
  const found = new Set(logs.map(workspaceOf));
  const ordered = KNOWN_WORKSPACES.map(known => {
    const match = [...found].find(f => f.toLowerCase() === known.toLowerCase());
    if (match) found.delete(match);
    return match ?? known;
  });
  const extras = [...found].sort((a, b) => a.localeCompare(b));
  return ['ALL', ...ordered, ...extras];
}
