import type { StreamKitHooks, StateChange } from './types';

export interface MockEnv {
  storage: Map<string, unknown>;
  subscribers: Map<string, Set<(change: StateChange) => void>>;
}

export function createMockHooks(): StreamKitHooks<MockEnv> {
  const env: MockEnv = {
    storage: new Map(),
    subscribers: new Map(),
  };

  return {
    async saveStreamState({ streamId, state, env }) {
      env.storage.set(streamId, state);
      
      // Notify subscribers
      const subscribers = env.subscribers.get(streamId);
      if (subscribers) {
        const change: StateChange = {
          type: 'snapshot',
          data: state,
          id: Date.now().toString(),
        };
        subscribers.forEach(cb => cb(change));
      }
    },

    async loadStreamState({ streamId, env }) {
      return env.storage.get(streamId) ?? null;
    },

    async deleteStreamState({ streamId, env }) {
      env.storage.delete(streamId);
      env.subscribers.delete(streamId);
    },

    subscribeToStateChanges({ streamId, env, lastEventId }) {
      const subscribers = env.subscribers.get(streamId) ?? new Set();
      env.subscribers.set(streamId, subscribers);

      return {
        [Symbol.asyncIterator]() {
          return {
            async next() {
              return new Promise<IteratorResult<StateChange>>((resolve) => {
                const callback = (change: StateChange) => {
                  subscribers.delete(callback);
                  resolve({ done: false, value: change });
                };
                subscribers.add(callback);

                // Send initial state if requested
                if (lastEventId) {
                  const state = env.storage.get(streamId);
                  if (state) {
                    resolve({
                      done: false,
                      value: {
                        type: 'snapshot',
                        data: state,
                        id: lastEventId,
                      },
                    });
                  }
                }
              });
            },
            async return() {
              subscribers.clear();
              return { done: true, value: undefined };
            },
          };
        },
      };
    },
  };
} 