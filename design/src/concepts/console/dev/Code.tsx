// Code samples with real values. A tiny tokenizer (strings, keys, numbers, keywords, comments) is
// enough for JSON, TypeScript, HTTP and shell; nothing here is a general-purpose highlighter.
import { Children, type ReactNode } from "react";

export type Lang = "json" | "ts" | "http" | "sh";
type Kind = "str" | "key" | "num" | "kw" | "com" | "verb" | "plain";

const KW = new Set(["const", "await", "import", "from", "export", "function", "return", "if", "new", "async", "true", "false", "null", "fetch"]);
const VERB = new Set(["GET", "PUT", "POST", "HTTP/1.1", "200", "202", "409"]);

function tokens(line: string, lang: Lang): { t: string; k: Kind }[] {
  const out: { t: string; k: Kind }[] = [];
  const comment = lang === "sh" ? "#" : lang === "ts" ? "//" : null;
  const re = /("(?:[^"\\]|\\.)*"|`[^`]*`|'[^']*')(\s*:)?|(\/\/.*$|#.*$)|(HTTP\/1\.1|[A-Za-z_][\w-]*)|(-?\d+(?:\.\d+)?)/g;
  let last = 0;
  for (let m = re.exec(line); m; m = re.exec(line)) {
    if (m.index > last) out.push({ t: line.slice(last, m.index), k: "plain" });
    const [all, str, colon, com, word, num] = m;
    if (str !== undefined) {
      out.push({ t: str, k: colon !== undefined && lang !== "sh" ? "key" : "str" });
      if (colon !== undefined) out.push({ t: colon, k: "plain" });
    } else if (com !== undefined) {
      if (comment && com.startsWith(comment)) out.push({ t: com, k: "com" });
      else out.push({ t: com, k: "plain" });
    } else if (word !== undefined) {
      const k: Kind = lang === "http" && VERB.has(word) ? "verb" : lang !== "http" && KW.has(word) ? "kw" : "plain";
      out.push({ t: word, k });
    } else if (num !== undefined) {
      out.push({ t: num, k: lang === "http" && VERB.has(num) ? "verb" : "num" });
    } else out.push({ t: all, k: "plain" });
    last = m.index + all.length;
  }
  if (last < line.length) out.push({ t: line.slice(last), k: "plain" });
  return out;
}

export function CodeLines({ code, lang, marks = [], errors = [], numbers = false }: { code: string; lang: Lang; marks?: number[]; errors?: number[]; numbers?: boolean }) {
  return (
    <pre className={`dv-pre ${numbers ? "dv-pre--num" : ""}`}>
      {code.split("\n").map((line, i) => {
        const n = i + 1;
        const cls = errors.includes(n) ? "is-err" : marks.includes(n) ? "is-mark" : "";
        return (
          <span key={i} className={`dv-line ${cls}`}>
            {numbers && <span className="dv-ln">{n}</span>}
            <span className="dv-src">
              {line === "" ? " " : tokens(line, lang).map((tk, j) => <span key={j} className={tk.k === "plain" ? "dv-tk" : `dv-tk dv-tk--${tk.k}`}>{tk.t}</span>)}
            </span>
          </span>
        );
      })}
    </pre>
  );
}

/** A dark code panel: a file/endpoint label, an optional "New" flag, a copy button, the code. */
export function CodeCard({ title, code, lang, badge, marks, foot, numbers }: { title: string; code: string; lang: Lang; badge?: string; marks?: number[]; foot?: ReactNode; numbers?: boolean }) {
  return (
    <figure className="dv-code">
      <figcaption className="dv-code__head">
        <span className={`dv-code__title ${title.startsWith("/") ? "is-path" : ""}`}>{title}</span>
        {badge && <span className="dv-new">{badge}</span>}
        <button className="dv-copy" aria-label={`Copy ${title}`}>
          Copy
        </button>
      </figcaption>
      <CodeLines code={code} lang={lang} marks={marks} numbers={numbers} />
      {foot && <div className="dv-code__foot">{foot}</div>}
    </figure>
  );
}

/** Inline code in prose. */
export const C = ({ children }: { children: ReactNode }) => <code className="dv-c">{children}</code>;

/** Prose with inline code or bold: each run of plain text gets its own span, so no element's own
 * text box spans across the inline pieces (the shooter's overlap check reads text boxes). */
export function T({ children }: { children: ReactNode }) {
  return <>{Children.map(children, (c) => (typeof c === "string" ? <span>{c}</span> : c))}</>;
}

/** One line of prose (a block): inline code/bold sits in a line that doesn't wrap into its neighbours. */
export function L({ children }: { children: ReactNode }) {
  return (
    <span className="dv-l">
      <T>{children}</T>
    </span>
  );
}
