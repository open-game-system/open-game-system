import fs from "node:fs";
import path from "node:path";
import type { ExpoConfig } from "expo/config";
import { type ConfigPlugin, withXcodeProject, type XcodeProject } from "expo/config-plugins";
import { z } from "zod";

/**
 * iOS Live Activities for the controller phone (docs/acceptance/2026-10-21-live-activities.feature):
 * the widget extension target `OgsLiveActivity`, generated at every `expo prebuild` from this
 * package's ios/widget and ios/shared sources (never hand-edited into ios/). The app gets
 * NSSupportsLiveActivities and an app group shared with the extension (the key art), and EAS is told
 * about the extension (its bundle id and entitlements) so it can sign it.
 */
export const LIVE_ACTIVITY_TARGET = "OgsLiveActivity";
/** The extension's minimum iOS (ActivityContent, staleDate); the app's own target is unchanged. */
export const LIVE_ACTIVITY_DEPLOYMENT_TARGET = "16.2";
const APP_GROUPS = "com.apple.security.application-groups";

export const extensionBundleId = (appBundleId: string) => `${appBundleId}.${LIVE_ACTIVITY_TARGET}`;
export const appGroupFor = (appBundleId: string) => `group.${appBundleId}.ogs`;

/** This package's widget sources: the extension's own files, then the attributes both targets share. */
export function widgetSourceFiles(packageRoot: string): { from: string; name: string }[] {
  const dirs = [path.join(packageRoot, "ios", "widget"), path.join(packageRoot, "ios", "shared")];
  return dirs.flatMap((dir) =>
    fs
      .readdirSync(dir)
      .filter((name) => name.endsWith(".swift") || name.endsWith(".plist"))
      .sort()
      .map((name) => ({ from: path.join(dir, name), name })),
  );
}

const StringList = z.array(z.string());
const AppExtension = z.object({ targetName: z.string() }).passthrough();
const EasExtra = z
  .object({
    build: z
      .object({
        experimental: z
          .object({
            ios: z
              .object({ appExtensions: z.array(AppExtension).optional() })
              .passthrough()
              .optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

const withList = (existing: unknown, item: string): string[] => {
  const parsed = StringList.safeParse(existing);
  const list = parsed.success ? parsed.data : [];
  return list.includes(item) ? list : [...list, item];
};

/**
 * The app config part (pure): Info.plist (NSSupportsLiveActivities, the app group's name for Swift),
 * the app group entitlement, EAS's app extension entry, and `extra.ogsLiveActivities` (the runtime's
 * flag). Additive: nothing the app set is replaced.
 */
export function withLiveActivityAppConfig(config: ExpoConfig): ExpoConfig {
  const bundleId = config.ios?.bundleIdentifier;
  if (!bundleId)
    throw new Error(
      "@open-game-system/shell: Live Activities need ios.bundleIdentifier in the app config",
    );
  const group = appGroupFor(bundleId);
  const eas = EasExtra.safeParse(config.extra?.eas ?? {});
  const easExtra = eas.success ? eas.data : {};
  const iosExtensions = (easExtra.build?.experimental?.ios?.appExtensions ?? []).filter(
    (e) => e.targetName !== LIVE_ACTIVITY_TARGET,
  );
  return {
    ...config,
    ios: {
      ...config.ios,
      infoPlist: {
        ...config.ios?.infoPlist,
        NSSupportsLiveActivities: true,
        OGSAppGroup: group,
      },
      entitlements: {
        ...config.ios?.entitlements,
        [APP_GROUPS]: withList(config.ios?.entitlements?.[APP_GROUPS], group),
      },
    },
    extra: {
      ...config.extra,
      ogsLiveActivities: true,
      eas: {
        ...easExtra,
        build: {
          ...easExtra.build,
          experimental: {
            ...easExtra.build?.experimental,
            ios: {
              ...easExtra.build?.experimental?.ios,
              appExtensions: [
                ...iosExtensions,
                {
                  targetName: LIVE_ACTIVITY_TARGET,
                  bundleIdentifier: extensionBundleId(bundleId),
                  entitlements: { [APP_GROUPS]: [group] },
                },
              ],
            },
          },
        },
      },
    },
  };
}

/** The extension's entitlements file (the app group, for the art). */
export function extensionEntitlements(group: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>${APP_GROUPS}</key>
	<array>
		<string>${group}</string>
	</array>
</dict>
</plist>
`;
}

/** The widget's Info.plist with the app group named for Swift (OgsLiveActivityShared.appGroup). */
export function extensionInfoPlist(template: string, group: string): string {
  return template.replace(
    "\t<key>NSExtension</key>",
    `\t<key>OGSAppGroup</key>\n\t<string>${group}</string>\n\t<key>NSExtension</key>`,
  );
}

export interface WidgetTargetOptions {
  bundleId: string;
  teamId?: string;
  version: string;
  buildNumber: string;
  swiftFiles: string[];
}

const quoted = (v: string) => `"${v}"`;

/** The extension's build settings (Debug and Release alike). */
export function widgetBuildSettings(o: Omit<WidgetTargetOptions, "swiftFiles">) {
  return {
    PRODUCT_NAME: quoted("$(TARGET_NAME)"),
    PRODUCT_BUNDLE_IDENTIFIER: quoted(o.bundleId),
    INFOPLIST_FILE: `${LIVE_ACTIVITY_TARGET}/Info.plist`,
    CODE_SIGN_ENTITLEMENTS: `${LIVE_ACTIVITY_TARGET}/${LIVE_ACTIVITY_TARGET}.entitlements`,
    CODE_SIGN_STYLE: "Automatic",
    ...(o.teamId ? { DEVELOPMENT_TEAM: o.teamId } : {}),
    IPHONEOS_DEPLOYMENT_TARGET: LIVE_ACTIVITY_DEPLOYMENT_TARGET,
    TARGETED_DEVICE_FAMILY: quoted("1,2"),
    SWIFT_VERSION: "5.0",
    MARKETING_VERSION: quoted(o.version),
    CURRENT_PROJECT_VERSION: quoted(o.buildNumber),
    APPLICATION_EXTENSION_API_ONLY: "YES",
    SKIP_INSTALL: "YES",
    LD_RUNPATH_SEARCH_PATHS: quoted(
      "$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks",
    ),
    SWIFT_EMIT_LOC_STRINGS: "YES",
  };
}

const Settings = z.record(z.string(), z.unknown());
const ConfigList = z.object({ buildConfigurations: z.array(z.object({ value: z.string() })) });
const NativeTarget = z.object({ name: z.string() });
const unquote = (v: string) => v.replace(/^"(.*)"$/, "$1");
const entryOf = (section: unknown, key: string): unknown =>
  typeof section === "object" && section !== null ? Reflect.get(section, key) : null;

/** Whether the project has the extension's target (the xcode lib stores names quoted). */
export function hasWidgetTarget(project: XcodeProject): boolean {
  const section: unknown = project.pbxNativeTargetSection();
  if (typeof section !== "object" || section === null) return false;
  return Object.values(section).some((entry) => {
    const target = NativeTarget.safeParse(entry);
    return target.success && unquote(target.data.name) === LIVE_ACTIVITY_TARGET;
  });
}

/** Merges settings into one XCBuildConfiguration in place (the project object is what gets written). */
function mergeBuildSettings(entry: unknown, settings: Record<string, string>): void {
  if (typeof entry !== "object" || entry === null) return;
  const current = Settings.safeParse(Reflect.get(entry, "buildSettings"));
  Reflect.set(entry, "buildSettings", { ...(current.success ? current.data : {}), ...settings });
}

/**
 * Adds the widget extension target to the app's Xcode project: sources, frameworks and resources
 * phases, embedded in the app (PlugIns), its group, and its build settings. Idempotent: a project
 * that has the target already is left as it is (false).
 */
export function addWidgetTarget(project: XcodeProject, o: WidgetTargetOptions): boolean {
  if (hasWidgetTarget(project)) return false;
  const target = project.addTarget(
    LIVE_ACTIVITY_TARGET,
    "app_extension",
    LIVE_ACTIVITY_TARGET,
    o.bundleId,
  );
  project.addBuildPhase(o.swiftFiles, "PBXSourcesBuildPhase", "Sources", target.uuid);
  project.addBuildPhase([], "PBXResourcesBuildPhase", "Resources", target.uuid);
  project.addBuildPhase([], "PBXFrameworksBuildPhase", "Frameworks", target.uuid);

  const files = [...o.swiftFiles, "Info.plist", `${LIVE_ACTIVITY_TARGET}.entitlements`];
  const group = project.addPbxGroup(files, LIVE_ACTIVITY_TARGET, LIVE_ACTIVITY_TARGET);
  const mainGroup: unknown = project.getFirstProject().firstProject.mainGroup;
  if (typeof mainGroup === "string") project.addToPbxGroup(group.uuid, mainGroup);

  const settings = widgetBuildSettings(o);
  const list = ConfigList.safeParse(
    entryOf(project.pbxXCConfigurationList(), target.pbxNativeTarget.buildConfigurationList),
  );
  const section: unknown = project.pbxXCBuildConfigurationSection();
  for (const { value } of list.success ? list.data.buildConfigurations : [])
    mergeBuildSettings(entryOf(section, value), settings);
  return true;
}

/** Copies the widget sources and writes its entitlements into ios/OgsLiveActivity (prebuild). */
export function writeWidgetFiles(iosRoot: string, packageRoot: string, group: string): string[] {
  const dir = path.join(iosRoot, LIVE_ACTIVITY_TARGET);
  fs.mkdirSync(dir, { recursive: true });
  const sources = widgetSourceFiles(packageRoot);
  for (const { from, name } of sources) {
    const text = fs.readFileSync(from, "utf8");
    fs.writeFileSync(
      path.join(dir, name),
      name === "Info.plist" ? extensionInfoPlist(text, group) : text,
    );
  }
  fs.writeFileSync(
    path.join(dir, `${LIVE_ACTIVITY_TARGET}.entitlements`),
    extensionEntitlements(group),
  );
  return sources.map((s) => s.name).filter((name) => name.endsWith(".swift"));
}

/** packages/shell, from plugin/build (or plugin/src under the tests). */
const PACKAGE_ROOT = path.resolve(__dirname, "..", "..");

/**
 * `withShellLiveActivity`: the app config part, then the extension written into ios/ and added to
 * the Xcode project. The shell plugin applies it when the shell config says `liveActivities: true`;
 * the OGS app applies it directly (apps/mobile/app.config.js, OGS_LIVE_ACTIVITIES=1).
 */
export const withShellLiveActivity: ConfigPlugin<unknown> = (config) => {
  const next = withLiveActivityAppConfig(config);
  const bundleId = next.ios?.bundleIdentifier ?? "";
  return withXcodeProject(next, (mod) => {
    const group = appGroupFor(bundleId);
    const swiftFiles = writeWidgetFiles(mod.modRequest.platformProjectRoot, PACKAGE_ROOT, group);
    addWidgetTarget(mod.modResults, {
      bundleId: extensionBundleId(bundleId),
      teamId: mod.ios?.appleTeamId,
      version: mod.version ?? "1.0.0",
      buildNumber: mod.ios?.buildNumber ?? "1",
      swiftFiles,
    });
    return mod;
  });
};
