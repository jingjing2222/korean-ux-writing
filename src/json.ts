import { readFileSync } from 'node:fs';

// JSON.parse alone silently accepts repeated object keys. Scan each object first
// so a later key cannot hide an original audit value or a pinned source setting.
class JsonScanner {
  text: string;
  cursor: number;

  constructor(text: string) {
    this.text = text;
    this.cursor = 0;
  }

  whitespace(): void {
    while (this.cursor < this.text.length) {
      const code = this.text.charCodeAt(this.cursor);
      if (code !== 32 && code !== 9 && code !== 10 && code !== 13) break;
      this.cursor += 1;
    }
  }

  take(expected: string): void {
    this.whitespace();
    if (this.text[this.cursor] !== expected) throw new Error('Invalid JSON syntax');
    this.cursor += 1;
  }

  quoted(): string {
    this.whitespace();
    const start = this.cursor;
    if (this.text[this.cursor] !== '"') throw new Error('Expected a JSON string');
    this.cursor += 1;
    while (this.cursor < this.text.length) {
      const character = this.text[this.cursor];
      this.cursor += 1;
      if (character === '\\') {
        this.cursor += 1;
      } else if (character === '"') {
        const decoded: unknown = JSON.parse(this.text.slice(start, this.cursor));
        if (typeof decoded !== 'string') throw new Error('Expected a JSON string');
        return decoded;
      }
    }
    throw new Error('Unterminated JSON string');
  }

  value(depth: number): void {
    if (depth > 512) throw new Error('JSON nesting exceeds 512 levels');
    this.whitespace();
    const character = this.text[this.cursor];
    if (character === '{') {
      this.cursor += 1;
      const keys = new Set<string>();
      this.whitespace();
      if (this.text[this.cursor] === '}') {
        this.cursor += 1;
        return;
      }
      while (true) {
        const key = this.quoted();
        if (keys.has(key)) throw new Error('duplicate JSON key: ' + key);
        keys.add(key);
        this.take(':');
        this.value(depth + 1);
        this.whitespace();
        if (this.text[this.cursor] === '}') {
          this.cursor += 1;
          return;
        }
        this.take(',');
      }
    } else if (character === '[') {
      this.cursor += 1;
      this.whitespace();
      if (this.text[this.cursor] === ']') {
        this.cursor += 1;
        return;
      }
      while (true) {
        this.value(depth + 1);
        this.whitespace();
        if (this.text[this.cursor] === ']') {
          this.cursor += 1;
          return;
        }
        this.take(',');
      }
    } else if (character === '"') {
      this.quoted();
    } else {
      const start = this.cursor;
      while (this.cursor < this.text.length) {
        const current = this.text[this.cursor];
        if (current === ',' || current === ']' || current === '}' || current === ' ' || current === '\t' || current === '\n' || current === '\r') break;
        this.cursor += 1;
      }
      const token = this.text.slice(start, this.cursor);
      if (!/^(?:true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)$/.test(token)) {
        throw new Error('Invalid JSON value');
      }
    }
  }
}

export function parseJson(text: string): unknown {
  const scanner = new JsonScanner(text);
  scanner.value(0);
  scanner.whitespace();
  if (scanner.cursor !== text.length) throw new Error('Unexpected content after JSON value');
  return JSON.parse(text);
}

export function readJson(file: string): unknown {
  const bytes = readFileSync(file);
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
  return parseJson(decoder.decode(bytes));
}
