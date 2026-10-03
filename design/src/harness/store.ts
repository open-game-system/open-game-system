import { useSyncExternalStore } from "react";

export interface Store<S> {
  get(): S;
  set(next: S): void;
  update(fn: (s: S) => S): void;
  subscribe(fn: () => void): () => void;
}

export function createStore<S>(initial: S): Store<S> {
  let state = initial;
  const subs = new Set<() => void>();
  return {
    get: () => state,
    set(next) {
      state = next;
      subs.forEach((f) => f());
    },
    update(fn) {
      this.set(fn(state));
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}

export function useStore<S>(store: Store<S>): S {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
