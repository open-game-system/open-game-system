import {
  appendCapped,
  type BucketSummary,
  type ClientLogNamespace,
  type ClientLogObject,
  filterIndex,
  touchIndex,
} from "../../src/lib/client-log-store";

/** The ClientLog Durable Object namespace in memory (unit tests): the same helpers the object uses. */
export function memoryClientLogNamespace(): ClientLogNamespace<string> {
  const objects = new Map<string, ClientLogObject>();
  const make = (): ClientLogObject => {
    let lines: string[] = [];
    let buckets: BucketSummary[] = [];
    return {
      append: async (added) => {
        lines = appendCapped(lines, added);
      },
      read: async (limit) => lines.slice(-limit),
      touch: async (t) => {
        buckets = touchIndex(buckets, t);
      },
      recent: async (f) => filterIndex(buckets, f),
    };
  };
  return {
    idFromName: (name) => name,
    get(id) {
      let o = objects.get(id);
      if (!o) {
        o = make();
        objects.set(id, o);
      }
      return o;
    },
  };
}
