import type { CurrentGame } from "@open-game-system/ogs-protocol";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  EMPTY_FRAMES,
  type FramePost,
  type FrameSlot,
  type Frames,
  nextFrames,
  readFrameMessage,
  startMessage,
  toSessionMessages,
} from "../launcher/frames";
import type { SessionClient } from "../session/client";

const keyOf = (slot: FrameSlot) => `${slot.instanceId}|${slot.url}`;
const originOf = (url: string) => new URL(url).origin;

/**
 * The framed game pages: follows the session's current game, posts ogs:start / suspend / resume,
 * forwards resume points from the frames, and gives up calmly when a frame never loads.
 */
export function useFrames(client: SessionClient, current: CurrentGame | null, timeoutMs: number) {
  const [frames, setFrames] = useState<Frames>(EMPTY_FRAMES);
  const framesRef = useRef<Frames>(EMPTY_FRAMES);
  const els = useRef(new Map<string, HTMLIFrameElement>());
  const [loaded, setLoaded] = useState<ReadonlySet<string>>(new Set());
  const [failed, setFailed] = useState<string | null>(null);

  const post = (p: FramePost) => {
    const { active, parked } = framesRef.current;
    const slot = [active, parked].find((s) => s?.instanceId === p.instanceId);
    const win = els.current.get(p.instanceId)?.contentWindow;
    if (slot && win) win.postMessage(p.msg, originOf(slot.url));
  };

  useEffect(() => {
    const { frames: next, posts } = nextFrames(framesRef.current, current);
    if (next !== framesRef.current) {
      framesRef.current = next;
      setFrames(next);
    }
    for (const p of posts) post(p);
  });

  const onLoad = useEffectEvent((slot: FrameSlot) => {
    setLoaded((s) => new Set(s).add(keyOf(slot)));
    if (current?.instanceId === slot.instanceId)
      post({ instanceId: slot.instanceId, msg: startMessage(current) });
  });

  const onMessage = useEffectEvent((ev: MessageEvent) => {
    const { active, parked } = framesRef.current;
    const slot = [active, parked].find(
      (s) => s && els.current.get(s.instanceId)?.contentWindow === ev.source,
    );
    if (!slot) return;
    const msg = readFrameMessage(ev, slot.url);
    if (msg) for (const m of toSessionMessages(msg, slot.appId)) client.send(m);
  });
  useEffect(() => {
    const handler = (ev: MessageEvent) => onMessage(ev);
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const activeKey = frames.active ? keyOf(frames.active) : null;
  const activeLoaded = activeKey !== null && loaded.has(activeKey);
  useEffect(() => {
    if (!activeKey || activeLoaded) return;
    const t = setTimeout(() => setFailed(activeKey), timeoutMs);
    return () => clearTimeout(t);
  }, [activeKey, activeLoaded, timeoutMs]);

  return {
    frames,
    register: (instanceId: string, el: HTMLIFrameElement | null) => {
      if (el) els.current.set(instanceId, el);
      else els.current.delete(instanceId);
    },
    onLoad: (slot: FrameSlot) => onLoad(slot),
    isLoaded: (slot: FrameSlot) => loaded.has(keyOf(slot)),
    activeFailed: activeKey !== null && failed === activeKey && !activeLoaded,
  };
}
