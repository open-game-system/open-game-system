import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ExpoConfig } from "expo/config";
import { IOSConfig } from "expo/config-plugins";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addWidgetTarget,
  appGroupFor,
  extensionBundleId,
  extensionEntitlements,
  extensionInfoPlist,
  LIVE_ACTIVITY_TARGET,
  widgetBuildSettings,
  widgetSourceFiles,
  withLiveActivityAppConfig,
  writeWidgetFiles,
} from "../live-activity";
import { createShellPlugins } from "../with-ogs-shell";

const PACKAGE_ROOT = path.resolve(__dirname, "..", "..", "..");
const FIXTURE = path.join(__dirname, "__fixtures__", "app.pbxproj");
const app: ExpoConfig = {
  name: "Settlewood",
  slug: "settlewood",
  version: "1.2.0",
  ios: { bundleIdentifier: "tv.settlewood.app", appleTeamId: "34S957HD77" },
};

const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});
function tmp(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ogs-live-activity-"));
  tmpDirs.push(dir);
  return dir;
}

/** A project root with the OGS app's prebuilt Xcode project (no extension), parsed like Expo does. */
function fixtureProject() {
  const root = tmp();
  const proj = path.join(root, "ios", "app.xcodeproj");
  fs.mkdirSync(proj, { recursive: true });
  fs.copyFileSync(FIXTURE, path.join(proj, "project.pbxproj"));
  return IOSConfig.XcodeUtils.getPbxproj(root);
}

describe("names", () => {
  it("the extension and the app group follow the app's bundle id", () => {
    expect(LIVE_ACTIVITY_TARGET).toBe("OgsLiveActivity");
    expect(extensionBundleId("org.opengame.app")).toBe("org.opengame.app.OgsLiveActivity");
    expect(appGroupFor("org.opengame.app")).toBe("group.org.opengame.app.ogs");
  });
});

describe("withLiveActivityAppConfig (the app config part)", () => {
  it("turns Live Activities on, names the app group for Swift, and entitles the app to it", () => {
    const next = withLiveActivityAppConfig(app);
    expect(next.ios?.infoPlist).toEqual({
      NSSupportsLiveActivities: true,
      OGSAppGroup: "group.tv.settlewood.app.ogs",
    });
    expect(next.ios?.entitlements).toEqual({
      "com.apple.security.application-groups": ["group.tv.settlewood.app.ogs"],
    });
    expect(next.extra?.ogsLiveActivities).toBe(true);
  });

  it("tells EAS about the extension so it can be signed", () => {
    expect(withLiveActivityAppConfig(app).extra?.eas).toEqual({
      build: {
        experimental: {
          ios: {
            appExtensions: [
              {
                targetName: "OgsLiveActivity",
                bundleIdentifier: "tv.settlewood.app.OgsLiveActivity",
                entitlements: {
                  "com.apple.security.application-groups": ["group.tv.settlewood.app.ogs"],
                },
              },
            ],
          },
        },
      },
    });
  });

  it("is additive and idempotent: the app's own keys, groups, extensions and EAS id stay", () => {
    const own: ExpoConfig = {
      ...app,
      ios: {
        ...app.ios,
        infoPlist: { ITSAppUsesNonExemptEncryption: false },
        entitlements: {
          "com.apple.security.application-groups": ["group.mine"],
          "aps-environment": "production",
        },
      },
      extra: {
        eas: {
          projectId: "p1",
          build: {
            experimental: {
              ios: { appExtensions: [{ targetName: "Other", bundleIdentifier: "x" }] },
            },
          },
        },
      },
    };
    const once = withLiveActivityAppConfig(own);
    const twice = withLiveActivityAppConfig(once);
    expect(twice).toEqual(once);
    expect(once.ios?.infoPlist?.ITSAppUsesNonExemptEncryption).toBe(false);
    expect(once.ios?.entitlements).toEqual({
      "com.apple.security.application-groups": ["group.mine", "group.tv.settlewood.app.ogs"],
      "aps-environment": "production",
    });
    expect(once.extra?.eas?.projectId).toBe("p1");
    expect(
      once.extra?.eas?.build.experimental.ios.appExtensions.map(
        (e: { targetName: string }) => e.targetName,
      ),
    ).toEqual(["Other", "OgsLiveActivity"]);
  });

  it("needs the app's bundle id", () => {
    expect(() => withLiveActivityAppConfig({ name: "X", slug: "x" })).toThrow(
      /ios.bundleIdentifier/,
    );
  });
});

describe("the extension's files", () => {
  it("are the package's widget sources plus the shared attributes", () => {
    expect(widgetSourceFiles(PACKAGE_ROOT).map((f) => f.name)).toEqual([
      "Info.plist",
      "OgsLiveActivityWidget.swift",
      "OgsGameActivityAttributes.swift",
    ]);
  });

  it("the entitlements and Info.plist carry the app group", () => {
    expect(extensionEntitlements("group.x.ogs")).toContain("<string>group.x.ogs</string>");
    expect(extensionEntitlements("group.x.ogs")).toContain("com.apple.security.application-groups");
    const plist = extensionInfoPlist(
      fs.readFileSync(path.join(PACKAGE_ROOT, "ios", "widget", "Info.plist"), "utf8"),
      "group.x.ogs",
    );
    expect(plist).toContain("<key>OGSAppGroup</key>\n\t<string>group.x.ogs</string>");
    expect(plist).toContain("com.apple.widgetkit-extension");
  });

  it("are written into ios/OgsLiveActivity at prebuild (and again, the same, on the next)", () => {
    const ios = tmp();
    const swift = writeWidgetFiles(ios, PACKAGE_ROOT, "group.x.ogs");
    expect(swift).toEqual(["OgsLiveActivityWidget.swift", "OgsGameActivityAttributes.swift"]);
    const dir = path.join(ios, LIVE_ACTIVITY_TARGET);
    expect(fs.readdirSync(dir).sort()).toEqual([
      "Info.plist",
      "OgsGameActivityAttributes.swift",
      "OgsLiveActivity.entitlements",
      "OgsLiveActivityWidget.swift",
    ]);
    expect(fs.readFileSync(path.join(dir, "Info.plist"), "utf8")).toContain("group.x.ogs");
    const first = fs.readFileSync(path.join(dir, "OgsGameActivityAttributes.swift"), "utf8");
    writeWidgetFiles(ios, PACKAGE_ROOT, "group.x.ogs");
    expect(fs.readFileSync(path.join(dir, "OgsGameActivityAttributes.swift"), "utf8")).toBe(first);
  });
});

describe("addWidgetTarget (the OGS app's prebuilt Xcode project)", () => {
  const options = {
    bundleId: "org.opengame.app.OgsLiveActivity",
    teamId: "34S957HD77",
    version: "1.0.0",
    buildNumber: "7",
    swiftFiles: ["OgsLiveActivityWidget.swift", "OgsGameActivityAttributes.swift"],
  };

  it("adds an app-extension target embedded in the app, with its sources and settings", () => {
    const project = fixtureProject();
    expect(project.pbxTargetByName(LIVE_ACTIVITY_TARGET)).toBeFalsy();
    expect(addWidgetTarget(project, options)).toBe(true);
    const text = project.writeSync();
    expect(text).toContain('productType = "com.apple.product-type.app-extension"');
    expect(text).toContain("OgsLiveActivity.appex");
    expect(text).toContain("OgsLiveActivityWidget.swift in Sources");
    expect(text).toContain("OgsGameActivityAttributes.swift in Sources");
    expect(text).toContain('PRODUCT_BUNDLE_IDENTIFIER = "org.opengame.app.OgsLiveActivity"');
    expect(text).toContain("IPHONEOS_DEPLOYMENT_TARGET = 16.2");
    expect(text).toContain("CODE_SIGN_ENTITLEMENTS = OgsLiveActivity/OgsLiveActivity.entitlements");
    expect(text).toContain("INFOPLIST_FILE = OgsLiveActivity/Info.plist");
    expect(text).toContain("DEVELOPMENT_TEAM = 34S957HD77");
    // Embedded in the app's PlugIns (dstSubfolderSpec 13) by a copy phase on the app target.
    expect(text).toMatch(/OgsLiveActivity\.appex in Copy Files \*\/,[\s\S]*dstSubfolderSpec = 13;/);
  });

  it("leaves the app target's own deployment target alone", () => {
    const project = fixtureProject();
    const before = (project.writeSync().match(/IPHONEOS_DEPLOYMENT_TARGET = [\d.]+/g) ?? []).sort();
    addWidgetTarget(project, options);
    const after = (project.writeSync().match(/IPHONEOS_DEPLOYMENT_TARGET = [\d.]+/g) ?? []).sort();
    const appOnly = (list: string[]) => list.filter((s) => !s.endsWith("16.2"));
    expect(appOnly(after)).toEqual(appOnly(before));
  });

  it("is idempotent: a project that has the target is left as it is", () => {
    const project = fixtureProject();
    addWidgetTarget(project, options);
    const once = project.writeSync();
    expect(addWidgetTarget(project, options)).toBe(false);
    expect(project.writeSync()).toBe(once);
  });

  it("sets no team when the app names none", () => {
    expect(widgetBuildSettings({ ...options, teamId: undefined })).not.toHaveProperty(
      "DEVELOPMENT_TEAM",
    );
    expect(widgetBuildSettings(options)).toMatchObject({
      MARKETING_VERSION: '"1.0.0"',
      CURRENT_PROJECT_VERSION: '"7"',
      APPLICATION_EXTENSION_API_ONLY: "YES",
    });
  });
});

describe("the shell plugin with liveActivities", () => {
  const props = {
    appId: "settlewood",
    gameUrl: "https://settlewood.example/host",
    name: "Settlewood",
  };
  const plugins = () => createShellPlugins(vi.fn((config: ExpoConfig) => config));
  /** The Xcode project mod Expo would run at prebuild (registered by withXcodeProject). */
  const xcodeMod = (config: ExpoConfig): unknown => {
    const mods: unknown = Reflect.get(config, "mods");
    const ios: unknown =
      typeof mods === "object" && mods !== null ? Reflect.get(mods, "ios") : null;
    return typeof ios === "object" && ios !== null ? Reflect.get(ios, "xcodeproj") : undefined;
  };

  it("adds Live Activities when the shell config says true", () => {
    const config = plugins().withOgsShell(app, { ...props, liveActivities: true });
    expect(config.ios?.infoPlist?.NSSupportsLiveActivities).toBe(true);
    expect(config.extra?.ogsShell?.liveActivities).toBe(true);
    expect(xcodeMod(config)).toBeTypeOf("function");
  });

  it("adds nothing of it otherwise", () => {
    for (const p of [props, { ...props, liveActivities: false }]) {
      const config = plugins().withOgsShell(app, p);
      expect(config.ios?.infoPlist?.NSSupportsLiveActivities).toBeUndefined();
      expect(config.extra?.ogsShell).not.toHaveProperty("liveActivities");
      expect(config.extra?.ogsLiveActivities).toBeUndefined();
      expect(xcodeMod(config)).toBeUndefined();
    }
  });
});
