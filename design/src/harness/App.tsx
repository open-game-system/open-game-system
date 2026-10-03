import { useEffect, useMemo, useState } from "react";
import { conceptById, CONCEPTS } from "./registry";
import type { Device, RegisteredConcept } from "./types";
import { DeviceFrame } from "./DeviceFrame";
import { Stage } from "./Stage";
import { Index } from "./Index";

const params = new URLSearchParams(location.search);
const isDevice = (d: string | null): d is Device => d === "phone" || d === "ipad" || d === "tv";

/** Writes what was actually loaded onto <html>, so the shooter can refuse a mislabelled shot. */
function acknowledge(ack: string | null, error: string | null) {
  const el = document.documentElement;
  if (ack) el.dataset.scenarioAck = ack;
  if (error) el.dataset.scenarioError = error;
}

function Fail({ message }: { message: string }) {
  useEffect(() => acknowledge(null, message), [message]);
  return <div style={{ padding: 40, font: "600 28px system-ui", color: "#b00020" }}>Scenario error: {message}</div>;
}

/** Injects the concept's CSS synchronously, before any child acknowledges its scenario. */
function injectConceptCss(concept: RegisteredConcept | undefined) {
  if (!concept?.css || document.querySelector(`style[data-concept="${concept.id}"]`)) return;
  const style = document.createElement("style");
  style.dataset.concept = concept.id;
  style.textContent = concept.css;
  document.head.appendChild(style);
}

function Single({ concept, scenarioId, device, shot, seat }: { concept: RegisteredConcept; scenarioId: string; device: Device; shot: boolean; seat?: string }) {
  const Bound = useMemo(() => concept.session(scenarioId), [concept, scenarioId]);
  const meta = concept.scenarios.find((s) => s.id === scenarioId);
  useEffect(() => {
    if (Bound && meta) acknowledge(`${concept.id}/${scenarioId}/${device}`, null);
  }, [Bound, meta, concept.id, scenarioId, device]);
  if (!Bound || !meta) return <Fail message={`no scenario "${scenarioId}" in concept "${concept.id}"`} />;
  return (
    <DeviceFrame device={device} seat={seat}>
      <Bound device={device} shot={shot} seat={seat} />
    </DeviceFrame>
  );
}

export function App() {
  const conceptId = params.get("concept");
  const scenarioId = params.get("scenario");
  const device = params.get("device");
  const shot = params.get("shot") === "1";
  const concept = conceptById(conceptId);
  injectConceptCss(concept);
  const [, force] = useState(0);
  useEffect(() => {
    document.documentElement.classList.toggle("shot", shot);
    force(1);
  }, [shot]);

  if (!conceptId) return <Index concepts={CONCEPTS} />;
  if (!concept) return <Fail message={`no concept "${conceptId}"`} />;
  if (!scenarioId) return <Index concepts={[concept]} />;
  if (device === "stage") return <Stage concept={concept} scenarioId={scenarioId} flowId={params.get("flow")} onReady={(ack) => acknowledge(ack, null)} />;
  if (!isDevice(device)) return <Fail message={`unknown device "${device}"`} />;
  return <Single concept={concept} scenarioId={scenarioId} device={device} shot={shot} seat={params.get("seat") ?? undefined} />;
}
