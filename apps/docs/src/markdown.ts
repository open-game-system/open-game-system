import { basename, dirname, relative, resolve } from "node:path";
import { Marked, type Tokens } from "marked";
import { htmlPath, PAGES } from "./pages";
import { CONTENT_DIR, REPO_BLOB_URL, REPO_ROOT, SITE_URL } from "./paths";

/** GitHub-style heading anchor: "5. Rules" → "5-rules", "`ogs:start`" → "ogsstart". */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]*>/g, "")
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .trim()
    .replace(/\s/g, "-");
}

/** A heading's plain text (inline code and emphasis markers dropped). */
const plain = (raw: string) => raw.replace(/[`*_]/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");

export function headingIds(markdown: string): string[] {
  const seen = new Map<string, number>();
  const ids: string[] = [];
  let fenced = false;
  for (const line of markdown.split("\n")) {
    if (/^\s*```/.test(line)) fenced = !fenced;
    const m = !fenced && /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (!m) continue;
    ids.push(uniqueId(slugify(plain(m[2] ?? "")), seen));
  }
  return ids;
}

function uniqueId(base: string, seen: Map<string, number>): string {
  const n = seen.get(base) ?? 0;
  seen.set(base, n + 1);
  return n === 0 ? base : `${base}-${n}`;
}

export type LinkMode = "html" | "md";

/**
 * Rewrites the relative links of one source file: a link to another page's source becomes that page
 * (`/contract` in HTML, `https://ogs-docs.pages.dev/contract.md` in Markdown); any other relative link
 * is a file in this repo and goes to GitHub. Fenced code is left alone.
 */
export function rewriteLinks(markdown: string, sourceFile: string, mode: LinkMode): string {
  const dir = dirname(sourceFile);
  const rewrite = (target: string): string => {
    if (/^(https?:|mailto:|#)/.test(target)) return target;
    const [path = "", hash = ""] = target.split(/(?=#)/);
    const abs = resolve(dir, path);
    // A page by its source file, or (in content/) by its slug: `contract.md` is the contract page.
    const page =
      PAGES.find((p) => p.source === abs) ??
      (dirname(abs) === CONTENT_DIR
        ? PAGES.find((p) => `${p.slug}.md` === basename(abs))
        : undefined);
    if (page)
      return mode === "html"
        ? `${htmlPath(page.slug)}${hash}`
        : `${SITE_URL}/${page.slug}.md${hash}`;
    if (target.startsWith("/")) return target;
    const repoPath = relative(REPO_ROOT, abs);
    if (repoPath.startsWith(".."))
      throw new Error(`docs: link outside the repo: ${target} in ${sourceFile}`);
    return `${REPO_BLOB_URL}/${repoPath}${hash}`;
  };
  return markdown
    .split(/(^\s*```[\s\S]*?^\s*```)/m)
    .map((chunk, i) =>
      i % 2 === 1
        ? chunk
        : chunk.replace(/\]\(([^)\s]+)\)/g, (_m, t: string) => `](${rewrite(t)})`),
    )
    .join("");
}

/** Markdown → HTML with GitHub-style heading ids and external links opening in place. */
export function renderHtml(markdown: string): string {
  const seen = new Map<string, number>();
  const marked = new Marked({ gfm: true });
  marked.use({
    renderer: {
      heading(
        this: { parser: { parseInline(tokens: Tokens.Generic[]): string } },
        token: Tokens.Heading,
      ) {
        const id = uniqueId(slugify(plain(token.text)), seen);
        const inner = this.parser.parseInline(token.tokens);
        return `<h${token.depth} id="${id}"><a class="anchor" href="#${id}" aria-hidden="true">#</a>${inner}</h${token.depth}>\n`;
      },
    },
  });
  const html = marked.parse(markdown, { async: false });
  if (typeof html !== "string") throw new Error("docs: marked returned a promise");
  return html;
}
