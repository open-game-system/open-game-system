import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

/** vendor/<group>/vendor.json, written by scripts/pack-vendor.mjs. */
export const VendorManifestSchema = z.object({
  /** What the project depends on directly: package name → tarball file. */
  direct: z.record(z.string().regex(/\.tgz$/)),
  /** Workspace packages the direct ones need: pinned for the whole tree with pnpm.overrides. */
  overrides: z.record(z.string().regex(/\.tgz$/)),
});
export type VendorManifest = z.infer<typeof VendorManifestSchema>;

export function readVendor(groupDir: string): VendorManifest {
  const file = join(groupDir, "vendor.json");
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    throw new Error(
      `${file} is missing: run \`pnpm --filter create-ogs-game vendor\` in open-game-system first`,
    );
  }
  return VendorManifestSchema.parse(raw);
}

/** The tarballs to copy into the project's vendor/ folder. */
export const vendorFiles = (m: VendorManifest) => [
  ...new Set([...Object.values(m.direct), ...Object.values(m.overrides)]),
];

const PackageJsonSchema = z
  .object({
    dependencies: z.record(z.string()).default({}),
    pnpm: z
      .object({ overrides: z.record(z.string()).optional() })
      .passthrough()
      .default({}),
  })
  .passthrough();

/**
 * The project's package.json with the vendored packages: direct ones as `file:` dependencies, and
 * every vendored package (direct ones too, since they depend on each other) in pnpm.overrides.
 */
export function withVendor(packageJson: unknown, m: VendorManifest): Record<string, unknown> {
  const pkg = PackageJsonSchema.parse(packageJson);
  const all = { ...m.overrides, ...m.direct };
  const dependencies = { ...pkg.dependencies };
  for (const [name, file] of Object.entries(m.direct)) dependencies[name] = `file:vendor/${file}`;
  const overrides = { ...pkg.pnpm.overrides };
  for (const [name, file] of Object.entries(all)) overrides[name] = `file:./vendor/${file}`;
  // Same key order as before (name first), changed values in place.
  const base = z.record(z.unknown()).parse(packageJson);
  return {
    ...base,
    dependencies: sortKeys(dependencies),
    pnpm: { ...pkg.pnpm, overrides: sortKeys(overrides) },
  };
}

const sortKeys = (r: Record<string, string>) =>
  Object.fromEntries(Object.entries(r).sort(([a], [b]) => (a < b ? -1 : 1)));
