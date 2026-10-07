/**
 * The public API of profile-kit, read from its source with the TypeScript compiler (not guessed):
 * one entry per package entry point, every exported name, value or type.
 */
import { resolve } from "node:path";
import ts from "typescript";
import { REPO_ROOT } from "./paths";

export const PROFILE_KIT_ENTRIES = [
  { entry: "@open-game-system/profile-kit", file: "packages/profile-kit/src/index.ts" },
  { entry: "@open-game-system/profile-kit/react", file: "packages/profile-kit/src/react.tsx" },
  { entry: "@open-game-system/profile-kit/server", file: "packages/profile-kit/src/server.ts" },
] as const;

export interface ExportedName {
  name: string;
  kind: "value" | "type";
}

export function profileKitExports(): Map<string, ExportedName[]> {
  const files = PROFILE_KIT_ENTRIES.map((e) => resolve(REPO_ROOT, e.file));
  const program = ts.createProgram(files, {
    jsx: ts.JsxEmit.ReactJSX,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ES2022,
    strict: true,
    skipLibCheck: true,
    noEmit: true,
  });
  const checker = program.getTypeChecker();
  const out = new Map<string, ExportedName[]>();
  PROFILE_KIT_ENTRIES.forEach((e, i) => {
    const sf = program.getSourceFile(files[i] ?? "");
    const mod = sf && checker.getSymbolAtLocation(sf);
    if (!mod) throw new Error(`profile-kit entry not found: ${e.file}`);
    const names = checker.getExportsOfModule(mod).map((s): ExportedName => {
      const target = s.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(s) : s;
      return { name: s.name, kind: target.flags & ts.SymbolFlags.Value ? "value" : "type" };
    });
    out.set(e.entry, names);
  });
  return out;
}
