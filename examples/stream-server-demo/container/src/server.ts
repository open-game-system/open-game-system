/**
 * Stream Container Server
 *
 * This server manages a single browser instance with Puppeteer and monitors
 * active WebRTC connections to automatically shut down when no longer needed.
 *
 * Connection Monitoring Strategy:
 * - Chrome extension maintains window.activeConnections Set with peer IDs
 * - Container server polls this state every 15 seconds via page.evaluate()
 * - When connections drop to 0, starts 60-second grace period
 * - If no connections return within grace period, shuts down browser
 * - If new connections appear during grace period, cancels shutdown
 *
 * Browser Lifecycle:
 * - Browser launches on first /start-stream request
 * - Stays alive as long as connections are active
 * - Automatically shuts down after grace period with no connections
 * - Can be manually restarted with new /start-stream requests
 */

import crypto from "node:crypto";
import http from "node:http";
import url from "node:url";
import type { Browser, Page } from "puppeteer";
import puppeteer from "puppeteer";
import { type IceServerConfig, parseStartStreamRequest } from "./protocol";

// TypeScript declaration for browser window extensions
declare global {
  interface Window {
    activeConnections?: Set<string>;
    streamingDebug?: {
      initializeCalled: boolean;
      addConnectionCalled: boolean;
      lastPeerId: string | null;
      lastError: string | null;
      callCount: number;
    };
    INITIALIZE?: (params: {
      srcPeerId: string;
      destPeerId: string;
      iceServers?: IceServerConfig[];
    }) => Promise<void>;
    Peer?: any; // PeerJS constructor
  }
}

const EXTENSION_PATH = "./extension";
let EXTENSION_ID: string | null = null; // Dynamically detected at runtime

// Connection monitoring configuration
const GRACE_PERIOD_MS = 60000; // 60 seconds
const POLL_INTERVAL_MS = 15000; // 15 seconds

// Module-level state for persistent browser instance
let browser: Browser | undefined;
let activePage: Page | undefined;
let streamingPage: Page | undefined;
let connectionCheckInterval: NodeJS.Timeout | null = null;
let shutdownTimer: NodeJS.Timeout | null = null;

function logTrace(traceId: string, event: string, details?: Record<string, unknown>) {
  if (details) {
    console.log(`[trace:${traceId}] ${event}`, details);
    return;
  }
  console.log(`[trace:${traceId}] ${event}`);
}

function buildTraceHeaders(traceId?: string): HeadersInit | undefined {
  if (!traceId) return undefined;
  return {
    "x-stream-trace-id": traceId,
  };
}

/** Utility: Create JSON response */
function jsonResponse(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-stream-trace-id",
      ...(init.headers || {}),
    },
    ...init,
  });
}

async function collectBrowserState(traceId: string) {
  const activePageState = activePage
    ? await activePage
        .evaluate(() => ({
          url: window.location.href,
          title: document.title,
          visibilityState: document.visibilityState,
          readyState: document.readyState,
          hasFocus: document.hasFocus(),
        }))
        .catch((error: Error) => ({ error: error.message }))
    : null;

  const extensionState = streamingPage
    ? await streamingPage
        .evaluate(() => ({
          location: window.location.href,
          hasInitialize: typeof window.INITIALIZE === "function",
          activeConnections: window.activeConnections ? Array.from(window.activeConnections) : [],
          activeConnectionsSize: window.activeConnections ? window.activeConnections.size : 0,
          streamingDebug: window.streamingDebug || null,
          peerDefined: typeof window.Peer !== "undefined",
        }))
        .catch((error: Error) => ({ error: error.message }))
    : null;

  const targetSummary = browser
    ? browser.targets().map((target) => ({
        type: target.type(),
        url: target.url(),
      }))
    : [];

  const snapshot = {
    browserActive: !!browser,
    activePageState,
    extensionState,
    targetSummary,
    monitoringActive: !!connectionCheckInterval,
    shutdownTimerActive: !!shutdownTimer,
    capturedAt: new Date().toISOString(),
  };

  logTrace(traceId, "browser_state_snapshot", snapshot as Record<string, unknown>);
  return snapshot;
}

/** Build Puppeteer launch options */
function buildLaunchOptions() {
  const absoluteExtensionPath = require("node:path").resolve(EXTENSION_PATH);

  return {
    headless: "new" as any, // Use new headless mode for better container and extension support
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      `--disable-extensions-except=${absoluteExtensionPath}`,
      `--load-extension=${absoluteExtensionPath}`,
      "--webrtc-udp-port-range=10000-10100",
      "--autoplay-policy=no-user-gesture-required",
      "--disable-web-security", // Allow cross-origin requests for streaming
      "--remote-debugging-port=9222", // Enable remote debugging
      "--auto-accept-this-tab-capture",
      // Extension permission flags for headless mode
      "--enable-automation", // Enable automation extensions
      "--disable-extensions-file-access-check", // Allow file access for extensions
      "--allow-running-insecure-content", // Allow extensions to run in secure contexts
      "--disable-component-extensions-with-background-pages=false", // Enable component extensions
      "--enable-extension-activity-logging", // Better extension debugging
      "--allow-file-access-from-files", // Allow file access for extensions
      // Grant extension permissions automatically in headless
      "--allowlisted-extension-id=jjndjgheafjngoipoacpjgeicjeomjli", // Whitelist our extension by key from manifest.json
      // Container-optimized flags
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--disable-default-apps",
      "--no-first-run",
    ],
    defaultViewport: {
      width: 1920,
      height: 1080,
    },
  };
}

/** Launch browser, ensuring the extension is loaded */
async function launchBrowserWithExtension(): Promise<Browser> {
  const options = buildLaunchOptions();

  // Debug logging
  console.log("🔍 ========== BROWSER LAUNCH DEBUG ==========");
  console.log("🔍 Current working directory:", process.cwd());
  console.log("🔍 Extension path (relative):", EXTENSION_PATH);
  console.log("🔍 Extension path (absolute):", require("node:path").resolve(EXTENSION_PATH));

  // Docker-specific environment debugging
  console.log("🔍 ========== ENVIRONMENT DEBUG ==========");
  console.log("🔍 NODE_ENV:", process.env.NODE_ENV);
  console.log("🔍 Platform:", process.platform);
  console.log("🔍 Architecture:", process.arch);
  console.log("🔍 User ID:", process.getuid?.() || "N/A");
  console.log("🔍 Group ID:", process.getgid?.() || "N/A");
  console.log(
    "🔍 Chrome executable path:",
    process.env.PUPPETEER_EXECUTABLE_PATH || "using bundled Chrome",
  );
  console.log("🔍 Display environment:", process.env.DISPLAY || "Not set");

  // Check if extension directory exists and list contents
  const fs = require("node:fs");
  const extensionPath = require("node:path").resolve(EXTENSION_PATH);
  console.log("🔍 ========== FILE SYSTEM DEBUG ==========");
  console.log("🔍 Extension directory exists:", fs.existsSync(extensionPath));

  if (fs.existsSync(extensionPath)) {
    console.log("🔍 Extension directory contents:", fs.readdirSync(extensionPath));

    // Check file permissions for each file
    const files = fs.readdirSync(extensionPath);
    files.forEach((file: string) => {
      const filePath = require("node:path").join(extensionPath, file);
      const stats = fs.statSync(filePath);
      console.log(`🔍 File ${file}:`, {
        readable: fs.constants.R_OK,
        exists: fs.existsSync(filePath),
        size: stats.size,
        mode: stats.mode.toString(8),
        isFile: stats.isFile(),
      });
    });

    // Check for manifest.json specifically
    const manifestPath = require("node:path").join(extensionPath, "manifest.json");
    console.log("🔍 Manifest file exists:", fs.existsSync(manifestPath));

    if (fs.existsSync(manifestPath)) {
      try {
        const manifestContent = fs.readFileSync(manifestPath, "utf8");
        console.log("🔍 Manifest file size:", manifestContent.length);
        const manifest = JSON.parse(manifestContent);
        console.log("🔍 Manifest content:", JSON.stringify(manifest, null, 2));
        console.log("🔍 Manifest key field:", manifest.key);
        console.log("🔍 Manifest version:", manifest.manifest_version);
        console.log("🔍 Background script:", manifest.background?.service_worker);
      } catch (error) {
        console.error("🔍 Error reading manifest:", error);
      }
    }
  } else {
    console.error("❌ Extension directory does not exist!");
    // Try to list parent directory
    const parentDir = require("node:path").dirname(extensionPath);
    console.log("🔍 Parent directory:", parentDir);
    if (fs.existsSync(parentDir)) {
      console.log("🔍 Parent directory contents:", fs.readdirSync(parentDir));
    }
  }

  // Chrome executable validation
  console.log("🔍 ========== CHROME EXECUTABLE DEBUG ==========");
  const chromeExecutable = process.env.PUPPETEER_EXECUTABLE_PATH;
  console.log("🔍 Chrome executable path:", chromeExecutable || "using bundled Chrome/Chromium");
  console.log(
    "🔍 Skip Chromium download:",
    process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD || "false",
  );

  // Debug: Find available Chrome/Chromium executables in the container
  console.log("🔍 Searching for available Chrome/Chromium executables...");
  const possiblePaths = [
    "/usr/bin/chromium", // Standard Chromium location
    "/usr/bin/chromium-browser", // Alternative Chromium name
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/opt/google/chrome/chrome",
    "/usr/bin/chrome",
    "/opt/chromium.org/chromium/chromium", // Chromium snap location
    "/snap/bin/chromium", // Snap Chromium
    "/usr/local/bin/chromium", // Local install
    "/usr/local/bin/chrome", // Local install
  ];

  let foundChrome: string | null = null;
  possiblePaths.forEach((path) => {
    const exists = fs.existsSync(path);
    console.log(`🔍 ${path}: ${exists ? "EXISTS" : "NOT FOUND"}`);
    if (exists && !foundChrome) {
      foundChrome = path;
    }
  });

  // Try to find any Chrome/Chromium executable using find command
  try {
    const { exec } = require("node:child_process");
    const { promisify } = require("node:util");
    const execAsync = promisify(exec);

    console.log("🔍 Searching filesystem for Chrome/Chromium executables...");
    const { stdout: findResults } = await execAsync(
      'find /usr /opt /snap -name "*chromium*" -o -name "*chrome*" 2>/dev/null | head -20 || echo "find command failed"',
    );
    console.log("🔍 Find results:", findResults.trim());

    // Also check what's in common bin directories
    const binDirs = ["/usr/bin", "/usr/local/bin", "/opt"];
    for (const dir of binDirs) {
      if (fs.existsSync(dir)) {
        try {
          const files = fs
            .readdirSync(dir)
            .filter((f: string) => f.includes("chrome") || f.includes("chromium"));
          if (files.length > 0) {
            console.log(`🔍 Chrome/Chromium files in ${dir}:`, files);
          }
        } catch (error) {
          console.log(`🔍 Could not read ${dir}:`, (error as Error).message);
        }
      }
    }
  } catch (error) {
    console.warn("🔍 Could not search filesystem:", (error as Error).message);
  }

  // Try to find Chrome/Chromium via which command
  try {
    const { exec } = require("node:child_process");
    const { promisify } = require("node:util");
    const execAsync = promisify(exec);
    const { stdout: whichChrome } = await execAsync(
      'which chromium-browser || which chromium || which google-chrome-stable || which google-chrome || echo "not found"',
    );
    console.log("🔍 Which Chrome/Chromium:", whichChrome.trim());

    // Get version of found executable
    if (whichChrome.trim() !== "not found") {
      try {
        const { stdout: version } = await execAsync(`${whichChrome.trim()} --version`);
        console.log("🔍 Found browser version:", version.trim());
        foundChrome = whichChrome.trim();
      } catch (versionError) {
        console.warn("🔍 Could not get browser version:", (versionError as Error).message);
      }
    }
  } catch (error) {
    console.warn("🔍 Could not run which command:", (error as Error).message);
  }

  // Check Puppeteer's expected Chrome location
  try {
    const puppeteer = require("puppeteer");
    console.log("🔍 Puppeteer version:", puppeteer._launcher?._preferredRevision || "unknown");

    // Try to get default executable path from Puppeteer
    if (puppeteer.executablePath) {
      const defaultPath = puppeteer.executablePath();
      console.log("🔍 Puppeteer default executable path:", defaultPath);
      if (fs.existsSync(defaultPath)) {
        console.log("🔍 Puppeteer default executable EXISTS");
        foundChrome = defaultPath;
      } else {
        console.log("🔍 Puppeteer default executable NOT FOUND");
      }
    }
  } catch (error) {
    console.warn("🔍 Could not get Puppeteer executable path:", (error as Error).message);
  }

  if (foundChrome) {
    console.log("🔍 ✅ Using Chrome/Chromium at:", foundChrome);
  } else {
    console.log("🔍 ❌ No Chrome/Chromium executable found");
  }

  console.log("🔍 Browser launch options:", JSON.stringify(options, null, 2));

  console.log("🚀 Launching browser with extension...");

  // Progressive testing approach to isolate the issue
  console.log("🔍 ========== PROGRESSIVE BROWSER TESTING ==========");

  // Test 0: Direct Chrome execution test
  console.log("🧪 Test 0: Direct Chrome execution test...");
  try {
    const { exec } = require("node:child_process");
    const { promisify } = require("node:util");
    const execAsync = promisify(exec);

    const chromePath =
      foundChrome || "/root/.cache/puppeteer/chrome/linux-140.0.7339.82/chrome-linux64/chrome";
    console.log("🔍 Testing Chrome binary directly:", chromePath);

    // Test Chrome version command
    const { stdout: versionOutput } = await execAsync(
      `timeout 10s ${chromePath} --version 2>&1 || echo "Chrome version failed"`,
    );
    console.log("🔍 Chrome version output:", versionOutput.trim());

    // Test Chrome with basic flags
    const { stdout: helpOutput } = await execAsync(
      `timeout 5s ${chromePath} --help 2>&1 | head -5 || echo "Chrome help failed"`,
    );
    console.log("🔍 Chrome help output:", helpOutput.trim());

    // Test Chrome startup with minimal flags
    console.log("🔍 Testing Chrome startup with minimal flags...");
    const testCommand = `timeout 10s ${chromePath} --no-sandbox --disable-gpu --headless --disable-dev-shm-usage --remote-debugging-port=9223 --user-data-dir=/tmp/chrome-test --dump-dom about:blank 2>&1 || echo "Chrome startup failed"`;
    const { stdout: startupOutput } = await execAsync(testCommand);
    console.log(
      "🔍 Chrome startup test:",
      startupOutput.includes("<html>")
        ? "SUCCESS - Chrome can start"
        : "FAILED - Chrome cannot start",
    );
    console.log("🔍 Chrome startup output:", `${startupOutput.substring(0, 200)}...`);
  } catch (error) {
    console.error("❌ Test 0 Chrome direct execution failed:", (error as Error).message);
  }

  // Test 1: Basic browser launch (we know this works)
  console.log("🧪 Test 1: Basic browser launch without extensions...");
  try {
    console.log("🔍 Starting basic browser launch with new headless mode...");
    const testBrowser1 = await puppeteer.launch({
      headless: "new" as any, // Use new headless mode
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });
    console.log("✅ Test 1 PASSED: Basic browser launch works");

    // Test that we can create a page
    const page = await testBrowser1.newPage();
    await page.goto("data:text/html,<h1>Test</h1>");
    console.log("✅ Test 1.1 PASSED: Page creation and navigation works");

    await testBrowser1.close();
  } catch (error) {
    console.error("❌ Test 1 FAILED: Basic browser launch failed:", (error as Error).message);
    console.error("❌ This indicates Chrome cannot start in this container environment");
    console.error("❌ Possible causes:");
    console.error("   - Platform architecture mismatch (AMD64 vs ARM64)");
    console.error("   - Missing container capabilities or permissions");
    console.error("   - Chrome binary compatibility issues");
    throw error;
  }

  // Test 2: Browser launch with extension flags but no actual extension
  console.log("🧪 Test 2: Browser launch with extension flags (no extension)...");
  try {
    const testBrowser2 = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-extensions-except=/nonexistent/path",
        "--load-extension=/nonexistent/path",
      ],
    });
    console.log("✅ Test 2 PASSED: Extension flags work (even with invalid path)");
    await testBrowser2.close();
  } catch (error) {
    console.error("❌ Test 2 FAILED: Extension flags cause issues:", (error as Error).message);
    console.log("🔍 This suggests extension flags themselves are problematic");
  }

  // Test 3: Browser launch with valid extension path
  console.log("🧪 Test 3: Browser launch with actual extension...");

  // Add extra logging around the launch process
  try {
    const browserInstance = await puppeteer.launch(options);
    console.log("✅ Browser launched successfully");

    // Get browser version immediately
    try {
      const version = await browserInstance.version();
      console.log("✅ Browser version:", version);
    } catch (versionError) {
      console.warn("⚠️ Could not get browser version:", (versionError as Error).message);
    }

    // Log initial targets immediately after launch
    console.log("🔍 ========== INITIAL TARGETS DEBUG ==========");
    const initialTargets = browserInstance.targets();
    console.log("🔍 Initial target count:", initialTargets.length);
    initialTargets.forEach((target, index) => {
      console.log(`🔍 Target ${index}:`, {
        type: target.type(),
        url: target.url(),
        isServiceWorker: target.type() === "service_worker",
        isExtensionUrl: target.url().startsWith("chrome-extension://"),
        isBackgroundPage: target.type() === "background_page",
        opener: target.opener()?.url() || "none",
      });
    });

    // Wait a bit for extensions to load and check again
    console.log("🔍 Waiting 3 seconds for extensions to initialize...");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const postWaitTargets = browserInstance.targets();
    console.log("🔍 ========== POST-WAIT TARGETS DEBUG ==========");
    console.log("🔍 Target count after wait:", postWaitTargets.length);
    postWaitTargets.forEach((target, index) => {
      console.log(`🔍 Post-Wait Target ${index}:`, {
        type: target.type(),
        url: target.url(),
        isServiceWorker: target.type() === "service_worker",
        isExtensionUrl: target.url().startsWith("chrome-extension://"),
        isBackgroundPage: target.type() === "background_page",
        endsWithBackgroundJs: target.url().endsWith("background.js"),
        containsStreaming: target.url().includes("streaming"),
      });
    });

    // Try to access chrome://extensions/ page for additional debugging
    try {
      console.log("🔍 ========== CHROME EXTENSIONS PAGE DEBUG ==========");
      const debugPage = await browserInstance.newPage();
      await debugPage.goto("chrome://extensions/", {
        waitUntil: "domcontentloaded",
        timeout: 5000,
      });

      // Try to extract extension information from the page
      const extensionInfo = await debugPage.evaluate(() => {
        const extensions = Array.from(document.querySelectorAll("extensions-item"));
        return extensions.map((ext) => ({
          id: ext.getAttribute("id"),
          name: ext.querySelector("#name")?.textContent?.trim(),
          enabled: !ext.hasAttribute("disabled"),
          version: ext.querySelector("#version")?.textContent?.trim(),
        }));
      });

      console.log("🔍 Extensions found on chrome://extensions/:", extensionInfo);
      await debugPage.close();
    } catch (extensionsPageError) {
      console.warn(
        "⚠️ Could not access chrome://extensions/ page:",
        (extensionsPageError as Error).message,
      );
    }

    return browserInstance;
  } catch (launchError) {
    console.error("❌ Browser launch failed:", launchError);
    console.error("❌ Launch error details:", {
      name: (launchError as Error).name,
      message: (launchError as Error).message,
      stack: (launchError as Error).stack?.split("\n").slice(0, 5),
    });
    throw launchError;
  }
}

/** Wait for the extension service worker and get streaming page */
async function getExtensionStreamingPage(browser: Browser, timeout = 15000): Promise<Page> {
  console.log("🔍 ========== EXTENSION SERVICE WORKER DETECTION ==========");
  console.log("🔍 Looking for extension service worker...");
  console.log("🔍 Timeout set to:", timeout, "ms");

  // Log all current targets before waiting
  const preTargets = browser.targets();
  console.log("🔍 Current targets before waiting:", preTargets.length);
  preTargets.forEach((target, index) => {
    console.log(`🔍 Pre-Target ${index}:`, {
      type: target.type(),
      url: target.url(),
      isServiceWorker: target.type() === "service_worker",
      isExtensionUrl: target.url().startsWith("chrome-extension://"),
      endsWithBackgroundJs: target.url().endsWith("background.js"),
    });
  });

  try {
    console.log("🔍 Starting waitForTarget for service worker...");

    // Wait for the service worker from our extension (MV3)
    const workerTarget = await browser.waitForTarget(
      (target) => {
        const isServiceWorker = target.type() === "service_worker";
        const endsWithBackgroundJs = target.url().endsWith("background.js");
        const isMatch = isServiceWorker && endsWithBackgroundJs;

        console.log(`🔍 Evaluating target: ${target.url()}`);
        console.log(`🔍   - Type: ${target.type()} (isServiceWorker: ${isServiceWorker})`);
        console.log(`🔍   - Ends with background.js: ${endsWithBackgroundJs}`);
        console.log(`🔍   - Match: ${isMatch}`);

        return isMatch;
      },
      { timeout },
    );

    console.log("✅ Found extension service worker:", workerTarget.url());

    // Try to get the worker
    let worker;
    try {
      worker = await workerTarget.worker();
      console.log("✅ Got worker object:", !!worker);
    } catch (workerError) {
      console.warn(
        "⚠️ Could not get worker object (this might be normal):",
        (workerError as Error).message,
      );
    }

    // Get the extension ID from the worker URL
    const urlMatch = workerTarget.url().match(/chrome-extension:\/\/([^/]+)/);
    const extensionId = urlMatch?.[1];

    console.log("🔍 URL match result:", urlMatch);
    console.log("🔍 Extracted extension ID:", extensionId);

    if (!extensionId) {
      throw new Error(`Could not extract extension ID from worker URL: ${workerTarget.url()}`);
    }

    console.log("✅ Detected extension ID:", extensionId);
    EXTENSION_ID = extensionId;

    // Wait for the streaming.html page to be created by background.js
    const streamingUrl = `chrome-extension://${extensionId}/streaming.html`;
    console.log("🔍 ========== STREAMING PAGE DETECTION ==========");
    console.log("🔍 Waiting for streaming page:", streamingUrl);
    console.log("🔍 Timeout set to:", timeout, "ms");

    // Log current targets before waiting for streaming page
    const preStreamingTargets = browser.targets();
    console.log(
      "🔍 Current targets before waiting for streaming page:",
      preStreamingTargets.length,
    );
    preStreamingTargets.forEach((target, index) => {
      console.log(`🔍 Pre-Streaming Target ${index}:`, {
        type: target.type(),
        url: target.url(),
        isPage: target.type() === "page",
        isStreamingUrl: target.url() === streamingUrl,
      });
    });

    const streamingTarget = await browser.waitForTarget(
      (target) => {
        const isPage = target.type() === "page";
        const isStreamingUrl = target.url() === streamingUrl;
        const isMatch = isPage && isStreamingUrl;

        console.log(`🔍 Evaluating streaming target: ${target.url()}`);
        console.log(`🔍   - Type: ${target.type()} (isPage: ${isPage})`);
        console.log(`🔍   - URL matches: ${isStreamingUrl}`);
        console.log(`🔍   - Match: ${isMatch}`);

        return isMatch;
      },
      { timeout },
    );

    console.log("✅ Found streaming page target:", streamingTarget.url());

    const page = await streamingTarget.page();
    if (!page) {
      throw new Error("Failed to get page from streaming target");
    }

    console.log("✅ Got streaming page object successfully");
    console.log("✅ Final streaming page URL:", page.url());

    return page;
  } catch (error) {
    console.error("❌ Failed to get extension streaming page:", error);

    // Enhanced debug: show all available targets at the time of failure
    console.log("🔍 ========== FAILURE DEBUG - ALL TARGETS ==========");
    const targets = browser.targets();
    console.log("🔍 Total targets at failure:", targets.length);
    targets.forEach((target, index) => {
      console.log(`🔍 Failure Target ${index}:`, {
        type: target.type(),
        url: target.url(),
        isServiceWorker: target.type() === "service_worker",
        isPage: target.type() === "page",
        isExtensionUrl: target.url().startsWith("chrome-extension://"),
        endsWithBackgroundJs: target.url().endsWith("background.js"),
        containsStreaming: target.url().includes("streaming"),
      });
    });

    throw error;
  }
}

/** Check if INITIALIZE function exists in the page */
async function assertExtensionLoaded(page: Page, maxRetries = 3) {
  const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const hasInitialize = await page.evaluate(
        () => typeof (globalThis as any).INITIALIZE === "function",
      );
      if (hasInitialize) {
        console.log("INITIALIZE function found in extension page");
        return;
      }
    } catch (_error) {
      console.log(`Attempt ${attempt + 1}: INITIALIZE not ready yet`);
    }
    await wait(100 ** attempt); // 100ms, 1s, 10s
  }
  throw new Error("Could not find INITIALIZE function in the browser context after retries");
}

/** Start monitoring active connections via Puppeteer polling */
async function startConnectionMonitoring() {
  if (!streamingPage) {
    console.warn("Cannot start connection monitoring: no active streaming page");
    return;
  }

  console.log("Starting connection monitoring...");

  connectionCheckInterval = setInterval(async () => {
    try {
      if (!streamingPage) {
        console.log("Streaming page no longer available, stopping monitoring");
        stopConnectionMonitoring();
        return;
      }

      const activeCount = await streamingPage.evaluate(() => {
        return window.activeConnections ? window.activeConnections.size : 0;
      });

      // Enhanced debugging - show what's actually in the set
      const activeConnectionsDebug = await streamingPage.evaluate(() => {
        if (!window.activeConnections) return { size: 0, connections: [] };
        return {
          size: window.activeConnections.size,
          connections: Array.from(window.activeConnections),
        };
      });

      // Check streaming debug info
      const streamingDebug = await streamingPage.evaluate(() => {
        return window.streamingDebug || { debug: "not available" };
      });

      // Get more detailed extension state
      const extensionState = await streamingPage.evaluate(() => {
        return {
          hasStreamingDebug: typeof window.streamingDebug !== "undefined",
          hasActiveConnections: typeof window.activeConnections !== "undefined",
          hasInitializeFunction: typeof window.INITIALIZE === "function",
          windowKeys: Object.keys(window).filter(
            (key) =>
              key.includes("streaming") || key.includes("active") || key.includes("INITIALIZE"),
          ),
          location: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        };
      });

      console.log(`Active connections: ${activeCount}`);
      console.log(`Connection details:`, activeConnectionsDebug);
      console.log(`Streaming debug:`, streamingDebug);
      console.log(`Extension state:`, extensionState);

      if (activeCount === 0 && !shutdownTimer) {
        console.log(`No active connections, starting ${GRACE_PERIOD_MS}ms shutdown timer...`);
        shutdownTimer = setTimeout(() => {
          console.log("Grace period expired, shutting down browser...");
          shutdownBrowser();
        }, GRACE_PERIOD_MS);
      } else if (activeCount > 0 && shutdownTimer) {
        console.log("Active connections detected, cancelling shutdown timer");
        clearTimeout(shutdownTimer);
        shutdownTimer = null;
      }
    } catch (error) {
      console.error("Failed to check connection status:", error);
      // Continue monitoring even if one check fails
    }
  }, POLL_INTERVAL_MS);
}

/** Stop connection monitoring */
function stopConnectionMonitoring() {
  if (connectionCheckInterval) {
    clearInterval(connectionCheckInterval);
    connectionCheckInterval = null;
    console.log("Connection monitoring stopped");
  }

  if (shutdownTimer) {
    clearTimeout(shutdownTimer);
    shutdownTimer = null;
    console.log("Shutdown timer cancelled");
  }
}

/** Gracefully shutdown the browser and clean up resources */
async function shutdownBrowser() {
  console.log("Shutting down browser...");

  stopConnectionMonitoring();

  if (browser) {
    try {
      await browser.close();
      console.log("Browser closed successfully");
    } catch (error) {
      console.error("Error closing browser:", error);
    }
    browser = undefined;
    activePage = undefined;
    streamingPage = undefined;
    EXTENSION_ID = null;
  }
}

/* ---------- Route Handlers ---------- */
async function handleHealth(): Promise<Response> {
  return jsonResponse({
    status: "healthy",
    puppeteer: "imported",
    location: process.env.CLOUDFLARE_LOCATION || "local",
    region: process.env.CLOUDFLARE_REGION || "dev",
    expectedExtensionId: EXTENSION_ID || "unknown",
    browserActive: !!browser,
    monitoringActive: !!connectionCheckInterval,
  });
}

async function handlePing(): Promise<Response> {
  return jsonResponse({
    status: "pong",
    timestamp: Date.now(),
    browserActive: !!browser,
  });
}

async function handleTest(): Promise<Response> {
  let testBrowser: Browser | undefined;
  try {
    testBrowser = await launchBrowserWithExtension();
    const version = await testBrowser.version();

    // Get extension streaming page
    streamingPage = await getExtensionStreamingPage(testBrowser);

    await testBrowser.close();
    return jsonResponse({
      status: "success",
      browserVersion: version,
      extensionFound: true,
      extensionId: EXTENSION_ID,
    });
  } catch (err: any) {
    console.error("handleTest error:", err);
    if (testBrowser) await testBrowser.close();
    return jsonResponse({ status: "error", message: err.message }, { status: 500 });
  }
}

async function handleDebugState(traceId: string): Promise<Response> {
  const snapshot = await collectBrowserState(traceId);
  return jsonResponse(snapshot, {
    headers: buildTraceHeaders(traceId),
  });
}

async function handleStartStream(
  data: { url: string; peerId: string; iceServers?: IceServerConfig[] },
  traceId: string,
): Promise<Response> {
  try {
    const { url: targetUrl, peerId: destPeerId, iceServers } = data;
    if (!targetUrl || !destPeerId) {
      return jsonResponse(
        { error: "Missing targetUrl or peerId", traceId },
        { status: 400, headers: buildTraceHeaders(traceId) },
      );
    }

    logTrace(traceId, "start_stream_request_received", {
      targetUrl,
      destPeerId,
      iceServerCount: Array.isArray(iceServers) ? iceServers.length : 0,
      browserReused: !!browser,
    });

    // Use existing browser or launch new one
    if (!browser) {
      logTrace(traceId, "browser_launch_start");
      browser = await launchBrowserWithExtension();
      logTrace(traceId, "browser_launch_complete");
    } else {
      logTrace(traceId, "browser_reuse");
    }

    // Create new page for this stream
    const page = await browser.newPage();
    activePage = page; // Set as active page for monitoring
    page.on("console", (msg) => {
      logTrace(traceId, `page_console_${msg.type()}`, { text: msg.text() });
    });
    page.on("pageerror", (error) => {
      logTrace(traceId, "page_error", { message: error.message });
    });

    // Navigate to target URL
    logTrace(traceId, "page_navigation_start", { targetUrl });
    await page.goto(targetUrl);
    logTrace(traceId, "page_navigation_complete", {
      finalUrl: page.url(),
      title: await page.title().catch(() => "(unavailable)"),
    });

    // Set page to full screen
    await page.setViewport({ width: 1920, height: 1080 }); // Set a large viewport
    logTrace(traceId, "page_viewport_set", { width: 1920, height: 1080 });

    // Get extension streaming page and initialize streaming
    logTrace(traceId, "extension_page_wait_start");
    streamingPage = await getExtensionStreamingPage(browser, 30000); // This also sets EXTENSION_ID
    logTrace(traceId, "extension_page_ready", { extensionId: EXTENSION_ID });

    // Trigger a user-gesture-like command to satisfy activeTab requirements
    try {
      const pageTargets = browser.targets().filter((t) => t.type() === "page");
      const nyTimesTarget =
        pageTargets.find((t) => t.url().startsWith("https://")) || pageTargets[0];
      const nyPage = await nyTimesTarget?.page();
      if (nyPage) {
        // Simulate the keyboard shortcut for the command (Alt+Shift+S)
        await nyPage.keyboard.down("Alt");
        await nyPage.keyboard.down("Shift");
        await nyPage.keyboard.press("KeyS");
        await nyPage.keyboard.up("Shift");
        await nyPage.keyboard.up("Alt");
        logTrace(traceId, "capture_shortcut_sent");
      }
    } catch (e) {
      logTrace(traceId, "capture_shortcut_failed", { message: (e as Error).message });
    }

    // Set up console log monitoring for the extension page
    streamingPage.on("console", (msg) => {
      const type = msg.type();
      const text = msg.text();
      logTrace(traceId, `extension_console_${type}`, { text });
    });

    streamingPage.on("pageerror", (error) => {
      logTrace(traceId, "extension_page_error", { message: error.message });
    });

    // Test if we can execute code in the extension context
    console.log("🧪 Testing extension context execution...");
    try {
      const testResult = await streamingPage.evaluate(() => {
        console.log("[TEST] This is a test log from extension context");
        return {
          location: window.location.href,
          hasWindow: typeof window !== "undefined",
          hasPeer: typeof (globalThis as any).Peer !== "undefined",
          hasChrome: typeof (globalThis as any).chrome !== "undefined",
          hasTabCapture:
            typeof (globalThis as any).chrome !== "undefined" &&
            typeof (globalThis as any).chrome.tabCapture !== "undefined",
          windowKeys: Object.keys(window).filter(
            (key) =>
              key.includes("streaming") ||
              key.includes("active") ||
              key.includes("INITIALIZE") ||
              key.includes("Peer"),
          ),
        };
      });
      logTrace(traceId, "extension_context_test", testResult as Record<string, unknown>);
    } catch (error) {
      logTrace(traceId, "extension_context_test_failed", { message: (error as Error).message });
    }

    // Ensure INITIALIZE function is loaded
    await assertExtensionLoaded(streamingPage);
    logTrace(traceId, "extension_initialize_detected");

    // Force a simple log to test console monitoring
    logTrace(traceId, "extension_console_probe_start");
    await streamingPage.evaluate(() => {
      console.log("[FORCED-TEST] This should appear in container logs if console monitoring works");
      console.error("[FORCED-ERROR] This is a test error");
      console.warn("[FORCED-WARN] This is a test warning");
    });

    logTrace(traceId, "extension_console_probe_complete");

    const srcPeerId = crypto.randomUUID();
    const peers = {
      srcPeerId,
      destPeerId,
      iceServers: Array.isArray(iceServers) ? iceServers : [],
      peerHost: process.env.PEERJS_HOST || "",
      peerPort: parseInt(process.env.PEERJS_PORT || "0", 10),
    };

    // Initialize streaming in extension page
    logTrace(traceId, "extension_initialize_start", {
      srcPeerId,
      destPeerId,
      extensionUrl: streamingPage.url(),
    });

    try {
      await Promise.race([
        streamingPage.evaluate(async (p: any) => {
          console.log("[PUPPETEER] INITIALIZE call starting with params:", p);
          // @ts-expect-error
          const result = await INITIALIZE(p);
          console.log("[PUPPETEER] INITIALIZE call completed, result:", result);
          return result;
        }, peers),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("INITIALIZE timeout")), 30000),
        ),
      ]);

      logTrace(traceId, "extension_initialize_complete");

      // Check the state immediately after INITIALIZE
      const postInitState = await streamingPage.evaluate(() => {
        return {
          activeConnections: window.activeConnections ? Array.from(window.activeConnections) : null,
          activeConnectionsSize: window.activeConnections ? window.activeConnections.size : 0,
          streamingDebug: window.streamingDebug || null,
          hasInitialize: typeof window.INITIALIZE === "function",
        };
      });

      logTrace(traceId, "post_initialize_state", postInitState as Record<string, unknown>);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await collectBrowserState(traceId);
    } catch (error) {
      logTrace(traceId, "extension_initialize_failed", {
        name: (error as Error).name,
        message: (error as Error).message,
        stack: (error as Error).stack,
      });
      throw error; // Re-throw to propagate the error
    }

    // Start connection monitoring if not already running
    if (!connectionCheckInterval) {
      startConnectionMonitoring();
    }

    logTrace(traceId, "start_stream_response_sent", {
      srcPeerId,
      monitoringActive: !!connectionCheckInterval,
    });
    return jsonResponse(
      {
        status: "success",
        traceId,
        srcPeerId,
        browserWSEndpoint: browser.wsEndpoint(),
        monitoringActive: !!connectionCheckInterval,
      },
      {
        headers: buildTraceHeaders(traceId),
      },
    );
  } catch (err: any) {
    logTrace(traceId, "start_stream_error", {
      message: err.message,
      stack: err.stack,
    });
    // Don't close browser on error - let monitoring handle lifecycle
    return jsonResponse(
      { status: "error", message: err.message, traceId },
      { status: 500, headers: buildTraceHeaders(traceId) },
    );
  }
}

/* ---------- Node.js HTTP Server ---------- */
const server = http.createServer(async (req: any, res: any) => {
  const parsedUrl = url.parse(req.url || "", true);
  const { pathname } = parsedUrl;
  const traceId = req.headers["x-stream-trace-id"] || crypto.randomUUID();

  try {
    logTrace(traceId, "http_request_received", {
      method: req.method,
      pathname,
    });
    // Set CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-stream-trace-id");
    res.setHeader("x-stream-trace-id", traceId);

    // Handle CORS preflight requests
    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    let response: Response;

    if (pathname === "/health") {
      response = await handleHealth();
    } else if (pathname === "/ping") {
      response = await handlePing();
    } else if (pathname === "/test-puppeteer") {
      response = await handleTest();
    } else if (pathname === "/debug-state") {
      response = await handleDebugState(traceId);
    } else if (pathname === "/start-stream" && req.method === "POST") {
      // Parse request body for POST requests
      let body = "";
      req.on("data", (chunk: any) => {
        body += chunk.toString();
      });

      await new Promise((resolve) => {
        req.on("end", resolve);
      });

      const data = parseStartStreamRequest(JSON.parse(body));
      response = await handleStartStream(data, traceId);
    } else {
      response = new Response(`Not Found: ${req.method} ${req.url} (parsed path: ${pathname})`, {
        status: 404,
      });
    }

    // Convert Response object to Node.js response
    res.writeHead(response.status || 200, {
      "Content-Type": response.headers.get("Content-Type") || "application/json",
      ...Object.fromEntries(response.headers.entries()),
    });

    const responseText = await response.text();
    res.end(responseText);
  } catch (err: any) {
    if (err instanceof SyntaxError || err?.message?.includes("must be")) {
      res.writeHead(400, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, x-stream-trace-id",
        "x-stream-trace-id": req.headers["x-stream-trace-id"] || "",
      });
      res.end(JSON.stringify({ status: "error", message: err.message }));
      return;
    }

    console.error("Unhandled error:", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
});

const PORT = parseInt(process.env.PORT || "8080", 10);
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Container server running at http://0.0.0.0:${PORT}`);
});

// Graceful shutdown on process termination
process.on("SIGTERM", async () => {
  console.log("Received SIGTERM, shutting down gracefully...");
  await shutdownBrowser();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("Received SIGINT, shutting down gracefully...");
  await shutdownBrowser();
  process.exit(0);
});
