"use client";

import type { CellOutput, QueryResultRow } from "@/lib/analytics/query-engine";

type PyodideInterface = {
  runPythonAsync: (code: string) => Promise<unknown>;
  globals: {
    set: (key: string, value: unknown) => void;
  };
  toPy: (value: unknown) => unknown;
};

declare global {
  interface Window {
    loadPyodide?: (config: { indexURL: string }) => Promise<PyodideInterface>;
  }
}

const PYODIDE_VERSION = "0.26.4";
const INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

let pyodidePromise: Promise<PyodideInterface> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

export async function getPyodide(): Promise<PyodideInterface> {
  if (typeof window === "undefined") {
    throw new Error("Python runtime is only available in the browser");
  }
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      await loadScript(`${INDEX_URL}pyodide.js`);
      if (!window.loadPyodide) {
        throw new Error("Pyodide failed to initialize");
      }
      return window.loadPyodide({ indexURL: INDEX_URL });
    })();
  }
  return pyodidePromise;
}

function jsFromPy(value: unknown): unknown {
  if (
    value &&
    typeof value === "object" &&
    "toJs" in value &&
    typeof (value as { toJs: (opts?: object) => unknown }).toJs === "function"
  ) {
    return (value as { toJs: (opts?: object) => unknown }).toJs({
      dict_converter: Object.fromEntries,
    });
  }
  return value;
}

function asTable(
  value: unknown
): Omit<Extract<CellOutput, { kind: "table" }>, "durationMs"> | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (typeof value[0] !== "object" || value[0] === null || Array.isArray(value[0])) {
    return null;
  }
  const rows = value as QueryResultRow[];
  const columns = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((k) => set.add(k));
      return set;
    }, new Set<string>())
  );
  return {
    kind: "table",
    columns,
    rows,
    rowCount: rows.length,
  };
}

export async function runPythonCell(
  source: string,
  sqlRows: QueryResultRow[] | null
): Promise<CellOutput> {
  const start = Date.now();
  try {
    const pyodide = await getPyodide();
    pyodide.globals.set("df", pyodide.toPy(sqlRows ?? []));
    pyodide.globals.set("__cell_source", source);

    const runner = `
import sys
from io import StringIO
import ast

_stdout = StringIO()
sys.stdout = _stdout
_locals = {"df": df}
_source = __cell_source
_result = None
_error = None
try:
    _mod = ast.parse(_source, mode="exec")
    if _mod.body and isinstance(_mod.body[-1], ast.Expr):
        _expr = _mod.body.pop()
        exec(compile(_mod, "<cell>", "exec"), _locals, _locals)
        _result = eval(compile(ast.Expression(_expr.value), "<cell>", "eval"), _locals, _locals)
    else:
        exec(compile(_mod, "<cell>", "exec"), _locals, _locals)
except Exception as e:
    _error = f"{type(e).__name__}: {e}"
(_error, _result, _stdout.getvalue())
`;

    const raw = await pyodide.runPythonAsync(runner);
    const tuple = jsFromPy(raw) as [string | null, unknown, string];
    const [error, result, stdout] = tuple;
    const durationMs = Date.now() - start;

    if (error) {
      return { kind: "error", message: error };
    }

    const table = asTable(jsFromPy(result));
    if (table) {
      return { ...table, durationMs };
    }

    const parts: string[] = [];
    if (stdout?.trim()) parts.push(stdout.trimEnd());
    if (result !== null && result !== undefined) {
      const js = jsFromPy(result);
      if (typeof js === "string") parts.push(js);
      else parts.push(JSON.stringify(js, null, 2));
    }

    return {
      kind: "text",
      text: parts.join("\n") || "(no output)",
      durationMs,
    };
  } catch (e) {
    return {
      kind: "error",
      message: e instanceof Error ? e.message : String(e),
    };
  }
}
