import { SPACE } from "./values.ts";

// Match Python's Unicode \w and whitespace, rather than JavaScript's ASCII \w.
const WORD = "[\\p{L}\\p{N}_]";
const WORD_DOT = "[\\p{L}\\p{N}_.]";
const TOKEN_SOURCE =
  "\\{\\{" + SPACE + "*" + WORD_DOT + "+" + SPACE + "*\\}\\}|\\$\\{[^{}]+\\}|" +
  "\\{[A-Za-z_]" + WORD_DOT + "*\\}|\\{[0-9]+\\}|" +
  "\\{" + SPACE + "*[A-Za-z_]" + WORD_DOT + "*" + SPACE + "*," + SPACE +
  "*(?:plural|selectordinal|select|number|date|time)(?!" + WORD + ")|" +
  "%(?:\\([A-Za-z_]" + WORD_DOT + "*\\)|[0-9]+\\$)?[-+#0 ]*[0-9]*(?:\\.[0-9]+)?[sdif]";

function increment(counter: Map<string, number>, key: string, amount = 1): void {
  counter.set(key, (counter.get(key) ?? 0) + amount);
}

export function count(text: string, fragment: string): number {
  if (fragment.length === 0) return [...text].length + 1;
  let total = 0;
  let start = 0;
  for (;;) {
    const found = text.indexOf(fragment, start);
    if (found < 0) return total;
    total += 1;
    start = found + fragment.length;
  }
}

/** Common interpolation tokens and ICU selectors; not a complete ICU parser. */
export function tokenSignature(text: string): Map<string, number> {
  const result = new Map<string, number>();
  const token = new RegExp(TOKEN_SOURCE, "gu");
  let match = token.exec(text);
  while (match !== null) {
    increment(result, match[0]);
    match = token.exec(text);
  }
  const header = new RegExp("\\{" + SPACE + "*(" + WORD_DOT + "+)" + SPACE + "*," + SPACE + "*(plural|selectordinal|select)" + SPACE + "*,", "gu");
  const offsetPattern = new RegExp("^" + SPACE + "*offset" + SPACE + "*:" + SPACE + "*([0-9]+)", "u");
  const branchPattern = new RegExp("^" + SPACE + "*([^" + SPACE.slice(1, -1) + "{}]+)" + SPACE + "*\\{", "u");
  let group = header.exec(text);
  while (group !== null) {
    const name = group[1];
    const kind = group[2];
    let cursor = group.index + group[0].length;
    const offset = offsetPattern.exec(text.slice(cursor));
    if (offset !== null) {
      increment(result, "ICU:" + name + ":" + kind + ":offset:" + offset[1]);
      cursor += offset[0].length;
    }
    while (cursor < text.length) {
      const branch = branchPattern.exec(text.slice(cursor));
      if (branch === null) break;
      increment(result, "ICU:" + name + ":" + kind + ":branch:" + branch[1]);
      cursor += branch[0].length;
      let depth = 1;
      const start = cursor;
      while (cursor < text.length && depth !== 0) {
        if (text[cursor] === "{") depth += 1;
        if (text[cursor] === "}") depth -= 1;
        cursor += 1;
      }
      if (depth !== 0) {
        increment(result, "ICU:unclosed");
        break;
      }
      if (kind !== "select") increment(result, "ICU:" + name + ":" + kind + ":number-marker", count(text.slice(start, cursor - 1), "#"));
    }
    group = header.exec(text);
  }
  return result;
}

export function sameCounter(left: Map<string, number>, right: Map<string, number>): boolean {
  // Python Counter treats missing and explicitly zero counts as equivalent.
  for (const [key, value] of left) if (value !== (right.get(key) ?? 0)) return false;
  for (const [key, value] of right) if (value !== (left.get(key) ?? 0)) return false;
  return true;
}

