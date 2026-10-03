import { DEVICE_SIZE, type RegisteredConcept } from "./types";

/** Human index: every concept, scenario and flow, with links. */
export function Index({ concepts }: { concepts: RegisteredConcept[] }) {
  return (
    <div style={{ font: "15px/1.5 system-ui", padding: 32, maxWidth: 1200, color: "#1c1b1f", background: "#fff", minHeight: "100vh" }}>
      <h1 style={{ margin: "0 0 8px" }}>OGS design prototype</h1>
      <p style={{ marginTop: 0, color: "#555" }}>
        <code>?concept=&lt;id&gt;&amp;scenario=&lt;id&gt;&amp;device=phone|ipad|tv|stage</code> · add <code>&amp;shot=1</code> to freeze motion.
      </p>
      {concepts.length === 0 && <p>No concepts yet.</p>}
      {concepts.map((c) => (
        <section key={c.id} style={{ margin: "28px 0" }}>
          <h2 style={{ marginBottom: 2 }}>
            {c.id} · {c.name}
          </h2>
          <p style={{ margin: "0 0 12px", color: "#555" }}>{c.brief}</p>
          <h3>Flows</h3>
          <ul>
            {c.flows.map((f) => (
              <li key={f.id}>
                <a href={`?concept=${c.id}&scenario=${f.start}&device=stage&flow=${f.id}`}>{f.label}</a> · {f.steps.length} steps
              </li>
            ))}
          </ul>
          <h3>Scenarios</h3>
          <table style={{ borderCollapse: "collapse" }}>
            <tbody>
              {c.scenarios.map((s) => (
                <tr key={s.id} style={{ borderTop: "1px solid #eee" }}>
                  <td style={{ padding: "4px 12px 4px 0" }}>
                    <code>{s.id}</code>
                  </td>
                  <td style={{ padding: "4px 12px 4px 0" }}>{s.label}</td>
                  <td style={{ padding: "4px 12px 4px 0", color: "#777" }}>{s.state}</td>
                  <td>
                    {s.devices.map((d) => (
                      <a key={d} style={{ marginRight: 10 }} href={`?concept=${c.id}&scenario=${s.id}&device=${d}`} title={DEVICE_SIZE[d].label}>
                        {d}
                      </a>
                    ))}
                    <a href={`?concept=${c.id}&scenario=${s.id}&device=stage`}>stage</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
