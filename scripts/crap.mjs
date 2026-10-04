#!/usr/bin/env node
/**
 * CRAP (Change Risk Anti-Patterns) per function, from the TypeScript AST + lcov.
 *
 *   CRAP(f) = CC(f)² × (1 − cov(f))³ + CC(f)
 *
 * Unlike the regex-based crap4ts, this sees every function-like node (arrow
 * handlers passed to Hono routes, object methods, callbacks), ignores `?` inside
 * strings and types, and gives each nested function its own score (a parent's
 * CC and coverage exclude its nested functions' bodies).
 *
 * CC = 1 + if / ternary / case / for / for-in / for-of / while / do / catch /
 *      && / || / ?? / ?. / &&= / ||= / ??=
 * cov = covered ÷ instrumented lcov lines that belong to the function itself.
 *       Several --coverage files are merged (a line is covered if any run hit it).
 *
 * Usage (from a package dir):
 *   node ../../scripts/crap.mjs --src src --coverage coverage/lcov.info [--coverage other/lcov.info]
 *        [--exclude friends] [--threshold 8] [--json] [--top 15]
 * Exits 1 when any function is at or above --threshold (when given).
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative, resolve } from "node:path";

const require = createRequire(join(process.cwd(), "noop.js"));
const ts = (() => {
  try {
    return require("typescript");
  } catch {
    return createRequire(import.meta.url)("typescript");
  }
})();

const args = process.argv.slice(2);
const all = (name) =>
  args.flatMap((a, i) => (a === `--${name}` && args[i + 1] ? [args[i + 1]] : []));
const one = (name, fallback) => all(name)[0] ?? fallback;
const srcDirs = all("src").length ? all("src") : ["src"];
const coverageFiles = all("coverage").length ? all("coverage") : ["coverage/lcov.info"];
const excludes = all("exclude");
const threshold = Number(one("threshold", "0"));
const top = Number(one("top", "0"));
const asJson = args.includes("--json");

const isTestFile = (f) => /\.(test|spec|e2e)\.tsx?$/.test(f) || /__tests__|__mocks__/.test(f);

function findFiles(dir) {
  if (!existsSync(dir)) return [];
  if (!statSync(dir).isDirectory()) return [dir];
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return ["node_modules", "dist", "coverage"].includes(entry) ? [] : findFiles(full);
    }
    return /\.tsx?$/.test(entry) && !entry.endsWith(".d.ts") && !isTestFile(full) ? [full] : [];
  });
}

/** file (absolute) → Map<line, hits>, merged across lcov files by max. */
function readCoverage(paths) {
  const byFile = new Map();
  for (const p of paths) {
    if (!existsSync(p)) {
      console.error(`warning: no coverage at ${p}`);
      continue;
    }
    const base = resolve(p, "..", "..");
    let lines = null;
    for (const raw of readFileSync(p, "utf8").split("\n")) {
      if (raw.startsWith("SF:")) {
        const file = resolve(base, raw.slice(3));
        lines = byFile.get(file) ?? new Map();
        byFile.set(file, lines);
      } else if (raw.startsWith("DA:") && lines) {
        const [line, hits] = raw.slice(3).split(",").map(Number);
        lines.set(line, Math.max(lines.get(line) ?? 0, hits));
      } else if (raw === "end_of_record") {
        lines = null;
      }
    }
  }
  return byFile;
}

const BRANCH_KINDS = new Set([
  ts.SyntaxKind.IfStatement,
  ts.SyntaxKind.ConditionalExpression,
  ts.SyntaxKind.CaseClause,
  ts.SyntaxKind.ForStatement,
  ts.SyntaxKind.ForInStatement,
  ts.SyntaxKind.ForOfStatement,
  ts.SyntaxKind.WhileStatement,
  ts.SyntaxKind.DoStatement,
  ts.SyntaxKind.CatchClause,
]);
const BRANCH_OPERATORS = new Set([
  ts.SyntaxKind.AmpersandAmpersandToken,
  ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.QuestionQuestionToken,
  ts.SyntaxKind.AmpersandAmpersandEqualsToken,
  ts.SyntaxKind.BarBarEqualsToken,
  ts.SyntaxKind.QuestionQuestionEqualsToken,
]);

const isFunctionLike = (n) =>
  ts.isFunctionDeclaration(n) ||
  ts.isFunctionExpression(n) ||
  ts.isArrowFunction(n) ||
  ts.isMethodDeclaration(n) ||
  ts.isGetAccessorDeclaration(n) ||
  ts.isSetAccessorDeclaration(n) ||
  ts.isConstructorDeclaration(n);

function nameOf(fn, sf) {
  if (fn.name) return fn.name.getText(sf);
  if (ts.isConstructorDeclaration(fn)) return "constructor";
  const p = fn.parent;
  if (ts.isVariableDeclaration(p) || ts.isPropertyAssignment(p) || ts.isPropertyDeclaration(p)) {
    return p.name.getText(sf);
  }
  if (ts.isCallExpression(p)) {
    const callee = p.expression.getText(sf).replace(/\s+/g, "");
    const first = p.arguments[0];
    const label = first && ts.isStringLiteralLike(first) ? ` ${first.text}` : "";
    return `${callee.length > 24 ? `…${callee.slice(-23)}` : callee}${label} cb`;
  }
  return "<anonymous>";
}

function analyse(file) {
  const text = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const line = (pos) => sf.getLineAndCharacterOfPosition(pos).line + 1;
  const fns = [];

  function visitFn(fn) {
    const record = {
      name: nameOf(fn, sf),
      start: line(fn.getStart(sf)),
      end: line(fn.getEnd()),
      cc: 1,
      nested: [],
    };
    fns.push(record);
    const walk = (n) => {
      if (n !== fn && isFunctionLike(n)) {
        record.nested.push([line(n.getStart(sf)), line(n.getEnd())]);
        visitFn(n);
        return;
      }
      if (BRANCH_KINDS.has(n.kind)) record.cc++;
      if (ts.isBinaryExpression(n) && BRANCH_OPERATORS.has(n.operatorToken.kind)) record.cc++;
      if (n.questionDotToken) record.cc++;
      ts.forEachChild(n, walk);
    };
    ts.forEachChild(fn, walk);
  }
  const top = (n) => (isFunctionLike(n) ? visitFn(n) : ts.forEachChild(n, top));
  ts.forEachChild(sf, top);
  return fns;
}

function coverageOf(fn, lines) {
  if (!lines) return 0;
  let total = 0;
  let hit = 0;
  for (let l = fn.start; l <= fn.end; l++) {
    if (!lines.has(l)) continue;
    // A line that opens a nested function still belongs to the parent (the call site).
    if (fn.nested.some(([s, e]) => l > s && l <= e)) continue;
    total++;
    if (lines.get(l) > 0) hit++;
  }
  return total === 0 ? 1 : hit / total;
}

const crap = (cc, cov) => Math.round((cc * cc * (1 - cov) ** 3 + cc) * 10) / 10;

const coverage = readCoverage(coverageFiles.map((p) => resolve(p)));
const results = srcDirs
  .flatMap(findFiles)
  .filter((f) => !excludes.some((x) => f.includes(x)))
  .flatMap((file) => {
    const abs = resolve(file);
    return analyse(abs).map((fn) => {
      const cov = coverageOf(fn, coverage.get(abs));
      return {
        function: fn.name,
        file: `${relative(process.cwd(), abs)}:${fn.start}`,
        cc: fn.cc,
        coverage: Math.round(cov * 1000) / 10,
        crap: crap(fn.cc, cov),
      };
    });
  })
  .sort((a, b) => b.crap - a.crap || b.cc - a.cc);

const over = threshold > 0 ? results.filter((r) => r.crap >= threshold) : [];
const shown = top > 0 ? results.slice(0, top) : threshold > 0 ? over : results;

if (asJson) {
  console.log(JSON.stringify(shown, null, 2));
} else {
  const pad = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s.padEnd(n));
  console.log(
    `${pad("Function", 34)}${pad("File", 48)}${"CC".padStart(4)}${"Cov%".padStart(8)}${"CRAP".padStart(8)}`,
  );
  for (const r of shown) {
    console.log(
      `${pad(r.function, 34)}${pad(r.file, 48)}${String(r.cc).padStart(4)}${`${r.coverage}%`.padStart(8)}${String(r.crap).padStart(8)}`,
    );
  }
  console.log(`\n${results.length} functions; max CRAP ${results[0]?.crap ?? 0}`);
  if (threshold > 0) console.log(`${over.length} at or above ${threshold}`);
}
process.exit(threshold > 0 && over.length > 0 ? 1 : 0);
