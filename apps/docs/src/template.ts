import { htmlPath, PAGES, type PageDef } from "./pages";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function sidebar(current: string): string {
  const items = PAGES.map((p) => {
    const here = p.slug === current ? ' aria-current="page"' : "";
    return `<li><a href="${htmlPath(p.slug)}"${here}>${esc(p.nav)}</a></li>`;
  }).join("");
  return `<nav class="side" aria-label="Pages"><ol>${items}</ol>
<p class="agents"><strong>For agents</strong><br>Every page as Markdown: add <code>.md</code>.<br><a href="/llms.txt">llms.txt</a> · <a href="/llms-full.txt">llms-full.txt</a></p></nav>`;
}

function pager(current: string): string {
  const i = PAGES.findIndex((p) => p.slug === current);
  const prev = PAGES[i - 1];
  const next = PAGES[i + 1];
  const link = (p: PageDef | undefined, rel: string, label: string) =>
    p
      ? `<a rel="${rel}" href="${htmlPath(p.slug)}"><span>${label}</span>${esc(p.nav)}</a>`
      : "<span></span>";
  return `<nav class="pager" aria-label="Previous and next">${link(prev, "prev", "Previous")}${link(next, "next", "Next")}</nav>`;
}

export function pageHtml(opts: { page: PageDef; title: string; body: string }): string {
  const { page, title, body } = opts;
  const mdHref = `/${page.slug}.md`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · OGS for game developers</title>
<meta name="description" content="${esc(page.summary)}">
<link rel="alternate" type="text/markdown" href="${mdHref}" title="This page as Markdown">
<link rel="alternate" type="text/plain" href="/llms.txt" title="llms.txt">
<link rel="stylesheet" href="/style.css">
</head>
<body>
<header class="top">
<a class="brand" href="/"><span class="mark" aria-hidden="true"></span>OGS <span class="for">for game developers</span></a>
<a class="raw" href="${mdHref}">Markdown</a>
</header>
<div class="layout">
${sidebar(page.slug)}
<main>
<article>
${body}
</article>
${pager(page.slug)}
</main>
</div>
</body>
</html>
`;
}

export function notFoundHtml(): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Not found · OGS for game developers</title><link rel="stylesheet" href="/style.css"></head>
<body><header class="top"><a class="brand" href="/"><span class="mark" aria-hidden="true"></span>OGS <span class="for">for game developers</span></a></header>
<div class="layout">${sidebar("")}<main><article><h1>Not found</h1><p>No page here. Start at the <a href="/">overview</a>, or read <a href="/llms.txt">llms.txt</a>.</p></article></main></div></body></html>
`;
}
