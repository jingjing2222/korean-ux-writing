export type Row = Record<string, unknown>;
export type Index = Map<string, Row>;

export const LIMITATION =
  "Checks declared coverage, references and string invariants only. " +
  "It does not prove exhaustive discovery, evidence truth, semantic preservation, " +
  "authorization truth, user understanding, translation origin, diagnostic accuracy, review order, Korean quality, " +
  "accessibility or rendered UI behavior.";

/** A companion is a local JSON file below the report directory, on every OS. */
export function isCompanionReference(value: unknown): value is string {
  if (typeof value !== "string" || !value.endsWith(".json") || /[\\\u0000-\u001f:]/u.test(value)) return false;
  return value.split("/").every(part => part !== "" && part !== "." && part !== "..");
}

export function own(row: Row, key: string): unknown {
  // JSON field names are untrusted; inherited prototype properties are not data.
  if (!Object.keys(row).includes(key)) return undefined;
  return row[key];
}

export function hasOwn(row: Row, key: string): boolean {
  return Object.keys(row).includes(key);
}

export function getRow(index: Index, key: string): Row {
  const value = index.get(key);
  return value === undefined ? {} : value;
}

export function keys(index: Index): Set<string> {
  const result = new Set<string>();
  for (const key of index.keys()) result.add(key);
  return result;
}

export function equalSets(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) return false;
  for (const key of left) if (!right.has(key)) return false;
  return true;
}

export function difference(left: Set<string>, right: Set<string>): string[] {
  const result: string[] = [];
  for (const key of left) if (!right.has(key)) result.push(key);
  return result.sort();
}

export function quote(value: string): string {
  return "'" + value.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t") + "'";
}

export function list(values: string[]): string {
  return "[" + values.map(quote).join(", ") + "]";
}

export function reachable(seeds: Set<string>, graph: Map<string, Set<string>>): Set<string> {
  const visited = new Set<string>();
  const queue: string[] = [];
  for (const seed of seeds) {
    visited.add(seed);
    queue.push(seed);
  }
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const neighbors = graph.get(queue[cursor]);
    if (neighbors === undefined) continue;
    for (const next of neighbors) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return visited;
}


export const SPACE = "[\\t\\n\\v\\f\\r \\u001c-\\u001f\\u0085\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000]";
