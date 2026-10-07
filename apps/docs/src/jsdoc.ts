/**
 * The `/** … *\/` comments on zod schema fields, read from the schema's source file, so the generated
 * tables say what the code says. Keys are dotted paths inside one exported schema: `token`,
 * `art.icon`, and for a discriminated union the message type first: `ogs:start.token`. A comment on
 * a whole union member is keyed by its type alone (`ogs:room`).
 */
import { readFileSync } from "node:fs";
import ts from "typescript";

function commentBefore(node: ts.Node, text: string): string {
  const ranges = ts.getLeadingCommentRanges(text, node.pos) ?? [];
  const docs = ranges
    .map((r) => text.slice(r.pos, r.end))
    .filter((c) => c.startsWith("/**"))
    .map((c) =>
      c
        .replace(/^\/\*\*/, "")
        .replace(/\*\/$/, "")
        .split("\n")
        .map((l) => l.replace(/^\s*\* ?/, "").trim())
        .join(" ")
        .trim(),
    );
  return docs.at(-1) ?? "";
}

/** `z.object({ … })` (also `z.object({ … }).default({})` etc.): its literal argument. */
function objectLiteralOf(call: ts.CallExpression): ts.ObjectLiteralExpression | null {
  const callee = call.expression;
  if (!ts.isPropertyAccessExpression(callee) || callee.name.text !== "object") return null;
  const arg = call.arguments[0];
  return arg && ts.isObjectLiteralExpression(arg) ? arg : null;
}

/** `type: z.literal("ogs:start")` in an object literal: "ogs:start". */
function typeLiteral(obj: ts.ObjectLiteralExpression): string | null {
  for (const p of obj.properties) {
    if (!ts.isPropertyAssignment(p) || p.name.getText() !== "type") continue;
    const init = p.initializer;
    if (ts.isCallExpression(init) && init.arguments[0] && ts.isStringLiteral(init.arguments[0]))
      return init.arguments[0].text;
  }
  return null;
}

export function schemaDocs(file: string, exportName: string): Map<string, string> {
  const text = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true);
  const docs = new Map<string, string>();

  const visit = (node: ts.Node, prefix: string): void => {
    if (ts.isCallExpression(node)) {
      const obj = objectLiteralOf(node);
      if (obj) {
        const member = typeLiteral(obj);
        const base = member ?? prefix;
        if (member) {
          const doc = commentBefore(node, text);
          if (doc) docs.set(member, doc);
        }
        for (const p of obj.properties) {
          if (!ts.isPropertyAssignment(p)) continue;
          const key = base ? `${base}.${p.name.getText()}` : p.name.getText();
          const doc = commentBefore(p, text);
          if (doc) docs.set(key, doc);
          visit(p.initializer, key);
        }
        // The rest of the call chain (`.default({})`, `.optional()`): same prefix.
        visit(node.expression, prefix);
        return;
      }
    }
    ts.forEachChild(node, (child) => visit(child, prefix));
  };

  let found = false;
  sf.forEachChild((stmt) => {
    if (!ts.isVariableStatement(stmt)) return;
    for (const decl of stmt.declarationList.declarations) {
      if (decl.name.getText() !== exportName || !decl.initializer) continue;
      found = true;
      visit(decl.initializer, "");
    }
  });
  if (!found) throw new Error(`${exportName} not found in ${file}`);
  return docs;
}
