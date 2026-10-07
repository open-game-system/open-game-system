import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderHtml, rewriteLinks } from "./markdown";
import { PAGES, type PageDef } from "./pages";
import { DIST_DIR, DOCS_ROOT, SITE_URL } from "./paths";
import { fillSchemaBlocks } from "./schemas";
import { notFoundHtml, pageHtml } from "./template";

export interface BuiltPage {
  page: PageDef;
  title: string;
  /** The page's Markdown as served at /<slug>.md (links absolute). */
  markdown: string;
  html: string;
}

/** Lines of a source that are about the source itself, not for readers of the site. */
const SOURCE_ONLY = /^\*\*Rendered\*\* .*$\n?/m;

export function pageMarkdown(page: PageDef, mode: "html" | "md"): string {
  const raw = readFileSync(page.source, "utf8").replace(SOURCE_ONLY, "");
  return rewriteLinks(fillSchemaBlocks(raw), page.source, mode);
}

export function titleOf(markdown: string, source: string): string {
  const m = /^# (.+)$/m.exec(markdown);
  if (!m?.[1]) throw new Error(`docs: ${source} has no "# Title"`);
  return m[1].replace(/`/g, "").trim();
}

export const SITE_TITLE = "OGS for game developers";
export const SITE_SUMMARY =
  "How to make a web game OGS-compatible: the OGS app casts once, a TV launcher frames each game's TV page, phones play its phone page, and the game learns who is playing through profile-kit.";

function llmsTxt(built: BuiltPage[]): string {
  const lines = built.map(
    (b) => `- [${b.title}](${SITE_URL}/${b.page.slug}.md): ${b.page.summary}`,
  );
  return `# ${SITE_TITLE}

> ${SITE_SUMMARY}

Start with the Quickstart for agents: it is a step-by-step checklist. The game contract is the single source of truth; when it and the code disagree, the zod schemas in packages/ogs-protocol win. Every page is also served as HTML at the same path without \`.md\`.

## Docs

${lines.join("\n")}

## Optional

- [Everything in one file](${SITE_URL}/llms-full.txt): all pages above, concatenated
- [Source repository](https://github.com/open-game-system/open-game-system): the OGS monorepo (profile-kit, ogs-protocol, the TV launcher)
`;
}

function llmsFullTxt(built: BuiltPage[]): string {
  const parts = built.map(
    (b) => `<!-- ${SITE_URL}/${b.page.slug}.md -->\n\n${b.markdown.trim()}\n`,
  );
  return `# ${SITE_TITLE}\n\n> ${SITE_SUMMARY}\n\n${parts.join("\n---\n\n")}`;
}

const HEADERS = `/*.md
  Content-Type: text/markdown; charset=utf-8
  Access-Control-Allow-Origin: *
/llms.txt
  Content-Type: text/plain; charset=utf-8
  Access-Control-Allow-Origin: *
/llms-full.txt
  Content-Type: text/plain; charset=utf-8
  Access-Control-Allow-Origin: *
`;

/** Renders every page to `outDir` (HTML + Markdown twin), plus llms.txt, llms-full.txt, CSS. */
export function buildSite(outDir: string = DIST_DIR): BuiltPage[] {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const built = PAGES.map((page): BuiltPage => {
    const markdown = pageMarkdown(page, "md");
    const title = titleOf(markdown, page.source);
    const body = renderHtml(pageMarkdown(page, "html"));
    return { page, title, markdown, html: pageHtml({ page, title, body }) };
  });
  for (const b of built) {
    writeFileSync(resolve(outDir, `${b.page.slug}.html`), b.html);
    writeFileSync(resolve(outDir, `${b.page.slug}.md`), b.markdown);
  }
  writeFileSync(resolve(outDir, "llms.txt"), llmsTxt(built));
  writeFileSync(resolve(outDir, "llms-full.txt"), llmsFullTxt(built));
  writeFileSync(resolve(outDir, "404.html"), notFoundHtml());
  writeFileSync(resolve(outDir, "_headers"), HEADERS);
  copyFileSync(resolve(DOCS_ROOT, "src/style.css"), resolve(outDir, "style.css"));
  return built;
}
