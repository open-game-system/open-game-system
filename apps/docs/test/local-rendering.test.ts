/**
 * The local-rendering docs (decision 2026-10-25: no cloud GPU; the TV page renders on the host
 * iPhone for AirPlay, or on the Chromecast itself): the pages exist in their sidebar groups, and
 * every diagram is a real file that reads in both colour schemes.
 */
import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { type BuiltPage, buildSite } from "../src/build";
import { GROUPS, PAGES } from "../src/pages";
import { DIAGRAMS_DIR, SITE_URL } from "../src/paths";

const out = mkdtempSync(join(tmpdir(), "ogs-docs-local-"));
const built: BuiltPage[] = buildSite(out);
const page = (slug: string) => {
  const b = built.find((x) => x.page.slug === slug);
  if (!b) throw new Error(`no page ${slug}`);
  return b;
};
const srcs = (html: string) => [...html.matchAll(/<img\s[^>]*src="([^"]+)"/g)].map((m) => m[1] ?? "");
const srcsets = (html: string) => [...html.matchAll(/<source\s[^>]*srcset="([^"]+)"/g)].map((m) => m[1] ?? "");

const NEW_PAGES = [
  "architecture",
  "real-tv",
  "shell-config",
  "tv-performance",
  "debugging",
  "monetization",
  "faq",
];

describe("the local-rendering pages", () => {
  it("are all built", () => {
    for (const slug of NEW_PAGES) expect(built.map((b) => b.page.slug)).toContain(slug);
  });

  it("put every page in a known sidebar group, groups in order", () => {
    for (const p of PAGES) expect(GROUPS, `${p.slug}'s group`).toContain(p.group);
    const order = PAGES.map((p) => GROUPS.indexOf(p.group));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    for (const g of GROUPS) expect(page("index").html).toContain(`>${g}</p>`);
  });

  it("show the architecture, the two TV paths and the launcher protocol as diagrams", () => {
    const html = page("architecture").html;
    expect(srcs(html).length).toBeGreaterThanOrEqual(3);
    expect(html).toMatch(/AirPlay/);
    expect(html).toMatch(/Chromecast/);
    for (const m of ["ogs:start", "ogs:suspend", "ogs:resume", "ogs:resume-point"])
      expect(html).toContain(m);
  });

  it("say the host phone draws every TV, with no render tiers and no browser-TV wording (2026-10-25)", () => {
    for (const b of built) {
      expect(b.markdown, b.page.slug).not.toMatch(/light tier|Use a browser TV|Chromecast draws/i);
    }
    expect(page("architecture").markdown).toMatch(/always drawn by \*\*the host's phone\*\*/);
    for (const slug of ["architecture", "tv-performance"])
      expect(page(slug).markdown, slug).toContain("spike/phone-p2p-cast");
    expect(page("shell-config").markdown).toContain("Smart TV browser or laptop: open a link, type a code");
  });

  it("answer why OGS doesn't stream from the cloud", () => {
    expect(page("faq").markdown).toMatch(/^## Why not cloud streaming\?$/m);
  });

  it("mark monetization as coming", () => {
    expect(page("monetization").title).toMatch(/coming/i);
  });

  it("document the shell's cast, branding, link, push, Live Activities and client-log options", () => {
    const md = page("shell-config").markdown;
    for (const o of ["`cast`", "`airplay`", "`branding`", "`linkDomains`", "`liveActivities`"])
      expect(md).toContain(o);
    expect(md).toMatch(/client log/i);
  });
});

describe("diagrams", () => {
  const files = readdirSync(DIAGRAMS_DIR).filter((f) => f.endsWith(".svg"));

  it("every <img> on every page is a file in the site", () => {
    const problems = built.flatMap((b) =>
      [...srcs(b.html), ...srcsets(b.html)].flatMap((s) => {
        if (!s.startsWith("/")) return [`${b.page.slug}: ${s} (not a site path)`];
        return existsSync(resolve(out, `.${s}`)) ? [] : [`${b.page.slug}: ${s} (missing)`];
      }),
    );
    expect(problems).toEqual([]);
  });

  it("swaps each wide diagram for its tall version on phones", () => {
    const html = page("architecture").html;
    expect(html).toContain('<source media="(max-width: 640px)" srcset="/diagrams/architecture-narrow.svg">');
  });

  it("every image has alt text, and the Markdown twin links the same diagram on the site", () => {
    for (const b of built) {
      for (const m of b.html.matchAll(/<img\s[^>]*>/g)) expect(m[0]).toMatch(/alt="[^"]{12,}"/);
      for (const s of srcs(b.html)) expect(b.markdown).toContain(`(${SITE_URL}${s})`);
    }
  });

  it("each diagram is used, titled, and has a dark-mode palette", () => {
    const used = built.flatMap((b) => [...srcs(b.html), ...srcsets(b.html)]);
    for (const f of files) {
      const svg = readFileSync(resolve(DIAGRAMS_DIR, f), "utf8");
      expect(used, `${f} is used on a page`).toContain(`/diagrams/${f}`);
      expect(svg, `${f} has a <title>`).toMatch(/<title[^>]*>[^<]{8,}<\/title>/);
      expect(svg, `${f} has a viewBox`).toMatch(/viewBox="0 0 \d+ \d+"/);
      expect(svg, `${f} has a dark palette`).toContain("prefers-color-scheme: dark");
      expect(svg, `${f} loads nothing`).not.toMatch(/<script|href="http/);
    }
  });
});
