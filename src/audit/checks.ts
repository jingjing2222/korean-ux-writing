import { own, quote, SPACE, type Row, type Index } from "./values.ts";

export function createChecks() {
  const errors: string[] = [];
  function fail(path: string, message: string): void { errors.push(path + ": " + message); }
  function obj(value: unknown, path: string): Row {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      fail(path, "must be an object");
      return {};
    }
    return value as Row;
  }
  function rows(value: unknown, path: string, nonempty: boolean): unknown[] {
    if (!Array.isArray(value)) {
      fail(path, "must be an array");
      return [];
    }
    const result = value as unknown[];
    if (nonempty && result.length === 0) fail(path, "must not be empty");
    return result;
  }
  function string(value: unknown, path: string, nonempty: boolean): string {
    if (typeof value !== "string") {
      fail(path, nonempty ? "must be a nonempty string" : "must be a string");
      return "";
    }
    const result = value as string;
    if (nonempty && new RegExp("^" + SPACE + "*$", "u").test(result)) {
      fail(path, "must be a nonempty string");
      return "";
    }
    return result;
  }
  function strings(value: unknown, path: string, nonempty: boolean): string[] {
    const values = rows(value, path, nonempty);
    const result: string[] = [];
    for (let i = 0; i < values.length; i += 1) result.push(string(values[i], path + "[" + i + "]", true));
    if (new Set(result).size !== result.length) fail(path, "contains duplicates");
    return result;
  }
  function indexed(value: unknown, path: string, nonempty: boolean): Index {
    const result = new Map<string, Row>();
    const values = rows(value, path, nonempty);
    for (let i = 0; i < values.length; i += 1) {
      const item = obj(values[i], path + "[" + i + "]");
      const key = string(own(item, "id"), path + "[" + i + "].id", true);
      if (result.has(key)) fail(path, "duplicate id " + quote(key));
      result.set(key, item);
    }
    return result;
  }

  return { errors, fail, obj, rows, string, strings, indexed };
}

export type Checks = ReturnType<typeof createChecks>;
