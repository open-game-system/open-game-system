/**
 * Chrome Extension Streaming Handler (streaming.js)
 *
 * FILE STRUCTURE:
 * - background.js: Creates hidden tab with streaming.html when extension loads
 * - streaming.html: Loads PeerJS library and this streaming.js file
 * - streaming.js: Contains INITIALIZE() function and connection tracking logic
 *
 * HOW THE SYSTEM WORKS:
 *
 * 1. CONTAINER STARTUP:
 *    - Container server starts Puppeteer browser with this Chrome extension
 *    - background.js creates a hidden tab loading streaming.html
 *    - streaming.html loads peer.js (PeerJS library) and this streaming.js file
 *
 * 2. PUPPETEER INTEGRATION:
 *    - Container server calls page.evaluate() to execute INITIALIZE() function
 *    - This function captures the current tab's video/audio stream
 *    - Creates PeerJS connection to stream to remote peer (like a receiver device)
 *
 * 3. CONNECTION TRACKING SYSTEM:
 *    - window.activeConnections tracks all active streaming connections
 *    - Container server polls this every 15 seconds via page.evaluate()
 *    - When connections drop to 0, starts 60-second shutdown timer
 *    - If no new connections within grace period, browser shuts down automatically
 *
 * 4. LIFECYCLE MANAGEMENT:
 *    - Browser stays alive as long as streams are active
 *    - Automatically shuts down when unused (resource efficient)
 *    - Can handle multiple simultaneous streams to different peers
 *
 * ARCHITECTURE FLOW:
 * Stream Request → Container Server → Puppeteer → Chrome Extension → PeerJS → Remote Peer
 *                              ↘ Connection Monitoring ↙
 *                           (Polls window.activeConnections)
 *
 * IMPORTANT NOTES:
 * - This runs in the Chrome extension context (isolated from normal web pages)
 * - Has special permissions for tab capture (see manifest.json)
 * - INITIALIZE function must be globally accessible for Puppeteer's page.evaluate()
 * - Connection tracking is critical for automatic resource management
 */

/**
 * INITIALIZE gets called within the context of the chrome extension
 * by puppeteer calling evaluate on the extension's background page (streaming.html)
 *
 * captures the active puppeteer tab into a media stream that we use
 * to call the remote peer using peerjs
 *
 * @param {Object} params - Parameters from container server
 * @param {string} params.srcPeerId - This browser's PeerJS ID (UUID)
 * @param {string} params.destPeerId - Remote peer's PeerJS ID (receiver)
 */

// Initialize connection tracking for container server monitoring
// The container server polls this Set to determine when to shut down
console.log("[INIT] Initializing window.activeConnections Set");
window.activeConnections = new Set();

// Debug tracking that container server can read
console.log("[INIT] Initializing window.streamingDebug object");
window.streamingDebug = {
  initializeCalled: false,
  addConnectionCalled: false,
  lastPeerId: null,
  lastError: null,
  callCount: 0,
  scriptLoadTime: new Date().toISOString(),
  peerJsAvailable: typeof Peer !== "undefined",
  chromeTabCaptureAvailable:
    typeof chrome !== "undefined" && typeof chrome.tabCapture !== "undefined",
  captureDiagnostics: null,
  testVideoDiagnostics: null,
  eventLog: [],
};

function recordDebugEvent(event, details = {}) {
  const entry = {
    event,
    details,
    timestamp: new Date().toISOString(),
  };
  window.streamingDebug.eventLog.push(entry);
  if (window.streamingDebug.eventLog.length > 40) {
    window.streamingDebug.eventLog.shift();
  }
}

console.log("[INIT] streaming.js loaded successfully");
console.log("[INIT] PeerJS available:", window.streamingDebug.peerJsAvailable);
console.log("[INIT] Chrome tabCapture available:", window.streamingDebug.chromeTabCaptureAvailable);
console.log("[INIT] Initial activeConnections size:", window.activeConnections.size);

/**
 * Add a peer connection to the tracking set
 * Container server monitors window.activeConnections.size via page.evaluate()
 */
function addConnection(peerId) {
  console.log(`[CONNECTION] Adding connection for peer: ${peerId}`);
  console.log(`[CONNECTION] activeConnections before add:`, Array.from(window.activeConnections));
  console.log(`[CONNECTION] activeConnections size before add:`, window.activeConnections.size);

  window.activeConnections.add(peerId);

  console.log(`[CONNECTION] activeConnections after add:`, Array.from(window.activeConnections));
  console.log(`[CONNECTION] activeConnections size after add:`, window.activeConnections.size);
  console.log(
    `[CONNECTION] Connection opened to ${peerId}. Active: ${window.activeConnections.size}`,
  );

  // Update debug info
  window.streamingDebug.addConnectionCalled = true;
  window.streamingDebug.lastPeerId = peerId;
  recordDebugEvent("connection_added", { peerId, size: window.activeConnections.size });
}

/**
 * Remove a peer connection from tracking set
 * When this reaches 0, container server starts shutdown grace period
 */
function removeConnection(peerId) {
  console.log(`[CONNECTION] Removing connection for peer: ${peerId}`);
  console.log(
    `[CONNECTION] activeConnections before remove:`,
    Array.from(window.activeConnections),
  );
  console.log(`[CONNECTION] activeConnections size before remove:`, window.activeConnections.size);

  const wasPresent = window.activeConnections.has(peerId);
  window.activeConnections.delete(peerId);
  recordDebugEvent("connection_removed", {
    peerId,
    wasPresent,
    size: window.activeConnections.size,
  });

  console.log(`[CONNECTION] Was peer present before removal: ${wasPresent}`);
  console.log(`[CONNECTION] activeConnections after remove:`, Array.from(window.activeConnections));
  console.log(`[CONNECTION] activeConnections size after remove:`, window.activeConnections.size);
  console.log(
    `[CONNECTION] Connection closed to ${peerId}. Active: ${window.activeConnections.size}`,
  );
}

async function INITIALIZE({ srcPeerId, destPeerId, iceServers = [] }) {
  console.log(`[INITIALIZE] ========== STARTING INITIALIZATION ==========`);
  console.log(`[INITIALIZE] Function called with params:`, { srcPeerId, destPeerId });
  console.log(`[INITIALIZE] srcPeerId type: ${typeof srcPeerId}, value: "${srcPeerId}"`);
  console.log(`[INITIALIZE] destPeerId type: ${typeof destPeerId}, value: "${destPeerId}"`);

  // Mark that INITIALIZE was called
  window.streamingDebug.initializeCalled = true;
  window.streamingDebug.callCount++;
  window.streamingDebug.lastPeerId = destPeerId;
  window.streamingDebug.lastError = null; // Reset error state
  window.streamingDebug.captureDiagnostics = null;
  window.streamingDebug.testVideoDiagnostics = null;
  recordDebugEvent("initialize_called", {
    srcPeerId,
    destPeerId,
    iceServerCount: Array.isArray(iceServers) ? iceServers.length : 0,
  });

  console.log(`[INITIALIZE] Updated debug info - call count: ${window.streamingDebug.callCount}`);
  console.log(`[INITIALIZE] Current activeConnections:`, Array.from(window.activeConnections));
  console.log(`[INITIALIZE] Current activeConnections size:`, window.activeConnections.size);

  try {
    // First, find and activate the target tab to satisfy activeTab permission
    console.log(`[TAB_ACTIVATION] Finding target tab to activate extension...`);

    const tabs = await new Promise((resolve, reject) => {
      chrome.tabs.query({}, (tabs) => {
        if (chrome.runtime.lastError) {
          console.error(`[TAB_ACTIVATION] ❌ Failed to query tabs:`, chrome.runtime.lastError);
          reject(new Error(`Failed to query tabs: ${chrome.runtime.lastError.message}`));
          return;
        }
        console.log(`[TAB_ACTIVATION] Found ${tabs.length} tabs`);
        tabs.forEach((tab, index) => {
          console.log(
            `[TAB_ACTIVATION] Tab ${index}: ${tab.url} (active: ${tab.active}, id: ${tab.id})`,
          );
        });
        resolve(tabs);
      });
    });

    // Find the active tab (the one Puppeteer is controlling)
    const activeTab =
      tabs.find((tab) => tab.active) ||
      tabs.find((tab) => !tab.url.startsWith("chrome-extension://"));

    if (!activeTab) {
      throw new Error("No suitable target tab found for capture");
    }

    console.log(`[TAB_ACTIVATION] Selected target tab: ${activeTab.url} (id: ${activeTab.id})`);

    // Programmatically activate the extension for this tab by injecting a small script
    // This satisfies the activeTab permission requirement
    console.log(`[TAB_ACTIVATION] Activating extension for tab ${activeTab.id}...`);

    try {
      await new Promise((resolve, _reject) => {
        chrome.scripting.executeScript(
          {
            target: { tabId: activeTab.id },
            func: () => {
              // This script injection activates the extension for this tab
              console.log("[TAB_INJECTION] Extension activated for this tab");
              return true;
            },
          },
          (_results) => {
            if (chrome.runtime.lastError) {
              console.warn(
                `[TAB_ACTIVATION] ⚠️ Script injection failed (may be normal for some pages):`,
                chrome.runtime.lastError.message,
              );
              // Don't reject - some pages can't be injected into, but tabCapture might still work
              resolve();
            } else {
              console.log(`[TAB_ACTIVATION] ✅ Successfully activated extension for tab`);
              resolve();
            }
          },
        );
      });
    } catch (activationError) {
      console.warn(
        `[TAB_ACTIVATION] ⚠️ Extension activation failed, proceeding anyway:`,
        activationError.message,
      );
      // Continue - tabCapture might still work even without successful injection
    }

    // Now attempt tab capture
    console.log(`[TAB_CAPTURE] Starting tab capture for tab ${activeTab.id}...`);
    console.log(`[TAB_CAPTURE] chrome object available:`, typeof chrome !== "undefined");
    console.log(
      `[TAB_CAPTURE] chrome.tabCapture available:`,
      typeof chrome !== "undefined" && typeof chrome.tabCapture !== "undefined",
    );

    // Preflight: stop any previous capture to avoid "Cannot capture a tab with an active stream"
    try {
      if (window.currentCaptureStream) {
        console.log("[TAB_CAPTURE] Found previous capture stream, stopping it...");
        window.currentCaptureStream.getTracks().forEach((t) => t.stop());
        window.currentCaptureStream = null;
      }
    } catch (e) {
      console.warn("[TAB_CAPTURE] Preflight stop error:", e?.message);
    }

    let stream;

    // Wait until no active capture is registered for this tab
    async function waitForNoActiveCapture(tabId, maxTries = 20, delayMs = 100) {
      for (let i = 0; i < maxTries; i++) {
        const { anyActive, tabsSnapshot } = await new Promise((res) => {
          chrome.tabCapture.getCapturedTabs((tabs) => {
            try {
              const list = (tabs || []).map((t) => ({
                tabId: t.tabId,
                status: t.status,
                fullscreen: t.fullscreen,
              }));
              const active = list.some((t) => t.status === "active" && t.tabId === tabId);
              console.log("[TAB_CAPTURE] Poll", i + 1, "/", maxTries, "captured tabs:", list);
              res({ anyActive: active, tabsSnapshot: list });
            } catch (e) {
              console.warn("[TAB_CAPTURE] getCapturedTabs inspect error:", e?.message);
              res({ anyActive: false, tabsSnapshot: [] });
            }
          });
        });
        if (!anyActive) return;
        await new Promise((r) => setTimeout(r, delayMs));
      }
      console.warn("[TAB_CAPTURE] Still active after wait; proceeding anyway");
    }

    await waitForNoActiveCapture(activeTab.id);

    // First try standard tabCapture.capture
    try {
      console.log("[TAB_CAPTURE] About to call chrome.tabCapture.capture synchronously");
      console.log(
        "[TAB_CAPTURE] Chrome tabCapture API available:",
        typeof chrome.tabCapture !== "undefined",
      );
      console.log("[TAB_CAPTURE] Extension context check:", {
        hasChrome: typeof chrome !== "undefined",
        hasTabCapture: typeof chrome !== "undefined" && typeof chrome.tabCapture !== "undefined",
        hasActiveTab: typeof chrome !== "undefined" && typeof chrome.activeTab !== "undefined",
        extensionId: chrome.runtime?.id || "unknown",
      });

      stream = await new Promise((resolve, reject) => {
        console.log(`[TAB_CAPTURE] Attempting tabCapture.capture on active tab...`);
        console.log(`[TAB_CAPTURE] Target tab ID: ${activeTab.id}, URL: ${activeTab.url}`);

        chrome.tabCapture.capture(
          {
            video: true,
            audio: true,
            videoConstraints: {
              mandatory: {
                minWidth: 1280,
                minHeight: 720,
                maxWidth: 1920,
                maxHeight: 1080,
                maxFrameRate: 30,
              },
            },
          },
          (capturedStream) => {
            if (capturedStream) {
              console.log(`[TAB_CAPTURE] ✅ capture() returned a stream`);
              console.log(`[TAB_CAPTURE] Stream details:`, {
                id: capturedStream.id,
                active: capturedStream.active,
                tracks: capturedStream.getTracks().length,
                videoTracks: capturedStream.getVideoTracks().length,
                audioTracks: capturedStream.getAudioTracks().length,
              });
              resolve(capturedStream);
            } else {
              const error = chrome.runtime.lastError;
              console.warn(`[TAB_CAPTURE] capture() failed:`, error?.message);
              console.warn(`[TAB_CAPTURE] Last error details:`, {
                message: error?.message,
                stack: error?.stack,
                toString: error?.toString(),
              });
              reject(new Error(error ? error.message : "Unknown capture error"));
            }
          },
        );
      });
    } catch (capErr) {
      console.warn(
        `[TAB_CAPTURE] capture() failed, falling back to getMediaStreamId + getUserMedia:`,
        capErr.message,
      );

      // Fallback: getMediaStreamId + getUserMedia with Chrome-specific constraints
      const streamId = await new Promise((resolve, reject) => {
        try {
          // targetTabId may not be supported on all channels; try with and without
          const opts = { targetTabId: activeTab.id };
          console.log(`[TAB_CAPTURE] Requesting media stream id for tab ${activeTab.id}...`);
          chrome.tabCapture.getMediaStreamId(opts, (id) => {
            if (chrome.runtime.lastError || !id) {
              const err1 = chrome.runtime.lastError?.message;
              console.warn(`[TAB_CAPTURE] getMediaStreamId with targetTabId failed:`, err1);
              chrome.tabCapture.getMediaStreamId((id2) => {
                if (chrome.runtime.lastError || !id2) {
                  const err2 = chrome.runtime.lastError?.message;
                  reject(new Error(err2 || "Failed to obtain mediaStreamId"));
                } else {
                  resolve(id2);
                }
              });
            } else {
              resolve(id);
            }
          });
        } catch (e) {
          reject(e);
        }
      });

      console.log(`[TAB_CAPTURE] Obtained mediaStreamId: ${streamId}`);

      try {
        // @ts-expect-error chrome-specific constraints
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            mandatory: {
              chromeMediaSource: "tab",
              chromeMediaSourceId: streamId,
            },
          },
          video: {
            mandatory: {
              chromeMediaSource: "tab",
              chromeMediaSourceId: streamId,
              maxWidth: 1920,
              maxHeight: 1080,
              maxFrameRate: 30,
            },
          },
        });
        console.log(`[TAB_CAPTURE] ✅ getUserMedia returned a stream`);
      } catch (gumErr) {
        console.error(`[TAB_CAPTURE] ❌ getUserMedia with tab source failed:`, gumErr);
        throw new Error(`Failed to capture the tab: ${gumErr.message}`);
      }
    }

    // At this point we have a valid stream
    console.log(`[TAB_CAPTURE] Stream has ${stream.getTracks().length} tracks`);

    // Enhanced stream debugging
    stream.getTracks().forEach((track, index) => {
      console.log(`[TAB_CAPTURE] Track ${index}:`, {
        kind: track.kind,
        label: track.label,
        enabled: track.enabled,
        readyState: track.readyState,
        muted: track.muted,
        constraints: track.getConstraints ? track.getConstraints() : "N/A",
        settings: track.getSettings ? track.getSettings() : "N/A",
      });
    });
    window.streamingDebug.captureDiagnostics = {
      streamId: stream.id,
      active: stream.active,
      trackCount: stream.getTracks().length,
      videoTrackCount: stream.getVideoTracks().length,
      audioTrackCount: stream.getAudioTracks().length,
      tracks: stream.getTracks().map((track) => ({
        kind: track.kind,
        label: track.label,
        enabled: track.enabled,
        readyState: track.readyState,
        muted: track.muted,
        settings: track.getSettings ? track.getSettings() : null,
      })),
    };
    recordDebugEvent("capture_stream_created", window.streamingDebug.captureDiagnostics);

    // Test if the stream is actually producing data
    if (stream.getVideoTracks().length > 0) {
      const videoTrack = stream.getVideoTracks()[0];
      const videoSettings = videoTrack.getSettings();
      const videoConstraints = videoTrack.getConstraints ? videoTrack.getConstraints() : null;

      console.log("[TAB_CAPTURE] Video track details:", {
        width: videoSettings.width,
        height: videoSettings.height,
        frameRate: videoSettings.frameRate,
        deviceId: videoSettings.deviceId,
        aspectRatio: videoSettings.aspectRatio,
        facingMode: videoSettings.facingMode,
        resizeMode: videoSettings.resizeMode,
        allSettings: videoSettings,
        constraints: videoConstraints,
      });

      // Check if dimensions are 0 which indicates capture failure
      if (videoSettings.width === 0 || videoSettings.height === 0) {
        console.error("[TAB_CAPTURE] ❌ Video track has zero dimensions - capture likely failed!");
        console.error("[TAB_CAPTURE] This usually means:");
        console.error(
          "[TAB_CAPTURE] 1. Tab content is not being rendered (headless browser issue)",
        );
        console.error("[TAB_CAPTURE] 2. Extension permissions not properly granted");
        console.error("[TAB_CAPTURE] 3. Chrome tab capture API not working in this environment");
      }
      window.streamingDebug.captureDiagnostics = {
        ...window.streamingDebug.captureDiagnostics,
        videoTrackDetails: {
          width: videoSettings.width || 0,
          height: videoSettings.height || 0,
          frameRate: videoSettings.frameRate || null,
          aspectRatio: videoSettings.aspectRatio || null,
          zeroDimensions: videoSettings.width === 0 || videoSettings.height === 0,
        },
      };
      recordDebugEvent(
        "capture_video_track_inspected",
        window.streamingDebug.captureDiagnostics.videoTrackDetails,
      );

      // Create a test video element to verify the stream works
      try {
        const testVideo = document.createElement("video");
        testVideo.srcObject = stream;
        testVideo.muted = true; // Required for autoplay
        window.streamingDebug.testVideoDiagnostics = {
          attached: true,
          playStarted: false,
          waiting: false,
          stalled: false,
          metadataLoaded: false,
          videoWidth: 0,
          videoHeight: 0,
          hasNonZeroPixels: null,
          samplePixels: null,
          error: null,
        };

        testVideo.onloadedmetadata = () => {
          const metadata = {
            videoWidth: testVideo.videoWidth,
            videoHeight: testVideo.videoHeight,
            duration: testVideo.duration,
            readyState: testVideo.readyState,
            networkState: testVideo.networkState,
          };
          console.log("[TAB_CAPTURE] Test video metadata loaded:", JSON.stringify(metadata));
          window.streamingDebug.testVideoDiagnostics = {
            ...window.streamingDebug.testVideoDiagnostics,
            metadataLoaded: true,
            ...metadata,
          };
          recordDebugEvent("test_video_metadata_loaded", metadata);

          // Try to play the video to see if it actually has content
          testVideo
            .play()
            .then(() => {
              console.log("[TAB_CAPTURE] ✅ Test video can play");
              window.streamingDebug.testVideoDiagnostics = {
                ...window.streamingDebug.testVideoDiagnostics,
                playStarted: true,
              };
              recordDebugEvent("test_video_play_started");

              // Check if video is actually updating by sampling pixels
              setTimeout(() => {
                try {
                  const canvas = document.createElement("canvas");
                  canvas.width = testVideo.videoWidth || 100;
                  canvas.height = testVideo.videoHeight || 100;
                  const ctx = canvas.getContext("2d");
                  ctx.drawImage(testVideo, 0, 0);
                  const imageData = ctx.getImageData(0, 0, 10, 10);
                  const hasNonZeroPixels = imageData.data.some((pixel) => pixel > 0);
                  const samplePixels = Array.from(imageData.data.slice(0, 20));
                  console.log("[TAB_CAPTURE] Video width:", testVideo.videoWidth);
                  console.log("[TAB_CAPTURE] Video height:", testVideo.videoHeight);
                  console.log("[TAB_CAPTURE] Video has non-zero pixels:", hasNonZeroPixels);
                  console.log("[TAB_CAPTURE] Sample pixel data:", samplePixels);
                  window.streamingDebug.testVideoDiagnostics = {
                    ...window.streamingDebug.testVideoDiagnostics,
                    videoWidth: testVideo.videoWidth,
                    videoHeight: testVideo.videoHeight,
                    hasNonZeroPixels,
                    samplePixels,
                  };
                  recordDebugEvent("test_video_pixels_sampled", {
                    videoWidth: testVideo.videoWidth,
                    videoHeight: testVideo.videoHeight,
                    hasNonZeroPixels,
                  });
                } catch (canvasErr) {
                  console.warn("[TAB_CAPTURE] Could not sample video pixels:", canvasErr);
                  window.streamingDebug.testVideoDiagnostics = {
                    ...window.streamingDebug.testVideoDiagnostics,
                    error: `Pixel sample failed: ${canvasErr.message}`,
                  };
                  recordDebugEvent("test_video_pixel_sample_failed", {
                    message: canvasErr.message,
                  });
                }
              }, 1000);
            })
            .catch((playErr) => {
              console.error("[TAB_CAPTURE] Test video play failed:", playErr);
              window.streamingDebug.testVideoDiagnostics = {
                ...window.streamingDebug.testVideoDiagnostics,
                error: `Play failed: ${playErr.message || String(playErr)}`,
              };
              recordDebugEvent("test_video_play_failed", {
                message: playErr.message || String(playErr),
              });
            });
        };

        testVideo.onerror = (e) => {
          console.error("[TAB_CAPTURE] Test video error:", e);
          console.error("[TAB_CAPTURE] Video error details:", testVideo.error);
          window.streamingDebug.testVideoDiagnostics = {
            ...window.streamingDebug.testVideoDiagnostics,
            error: testVideo.error
              ? `Video error code ${testVideo.error.code}`
              : "Unknown video error",
          };
          recordDebugEvent("test_video_error", {
            errorCode: testVideo.error ? testVideo.error.code : null,
          });
        };

        testVideo.onwaiting = () => {
          console.log("[TAB_CAPTURE] Test video waiting for data...");
          window.streamingDebug.testVideoDiagnostics = {
            ...window.streamingDebug.testVideoDiagnostics,
            waiting: true,
          };
          recordDebugEvent("test_video_waiting");
        };

        testVideo.onstalled = () => {
          console.log("[TAB_CAPTURE] Test video stalled");
          window.streamingDebug.testVideoDiagnostics = {
            ...window.streamingDebug.testVideoDiagnostics,
            stalled: true,
          };
          recordDebugEvent("test_video_stalled");
        };
      } catch (testErr) {
        console.warn("[TAB_CAPTURE] Could not create test video element:", testErr);
        window.streamingDebug.testVideoDiagnostics = {
          attached: false,
          error: `Test video creation failed: ${testErr.message}`,
        };
        recordDebugEvent("test_video_create_failed", { message: testErr.message });
      }
    } else {
      console.error("[TAB_CAPTURE] ❌ No video tracks in stream!");
      window.streamingDebug.captureDiagnostics = {
        ...window.streamingDebug.captureDiagnostics,
        error: "No video tracks in stream",
      };
      recordDebugEvent("capture_stream_missing_video_track");
    }

    // Store globally to detect active capture on subsequent init calls
    try {
      window.currentCaptureStream = stream;
      console.log("[TAB_CAPTURE] currentCaptureStream set");
      stream.getTracks().forEach((track, _index) => {
        track.onended = () => {
          console.log("[TAB_CAPTURE] Track ended:", track.kind, track.label);
          const allEnded =
            !window.currentCaptureStream ||
            window.currentCaptureStream.getTracks().every((t) => t.readyState === "ended");
          if (allEnded) {
            console.log("[TAB_CAPTURE] All tracks ended, clearing currentCaptureStream");
            window.currentCaptureStream = null;
          }
        };
      });
    } catch (e) {
      console.warn("[TAB_CAPTURE] Could not set global capture stream:", e?.message);
    }

    // Create PeerJS peer with our assigned ID
    console.log(`[PEERJS] Creating peer with ID: "${srcPeerId}"`);
    console.log(`[PEERJS] Peer constructor available:`, typeof Peer !== "undefined");

    const peerOptions = {
      debug: 3,
      config: {
        iceServers: Array.isArray(iceServers) ? iceServers : [],
      },
    };
    if (params.peerHost) {
      peerOptions.host = params.peerHost;
      peerOptions.port = params.peerPort || 9000;
      peerOptions.path = '/';
      peerOptions.secure = false;
    }
    const peer = new Peer(srcPeerId, peerOptions);
    console.log(`[PEERJS] Peer object created:`, peer);

    // Wait for peer to connect to PeerJS signaling server
    console.log(`[PEERJS] Waiting for peer to connect to signaling server...`);
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.error(`[PEERJS] ❌ Timeout waiting for peer to open`);
        reject(new Error("Timeout waiting for peer to connect"));
      }, 30000); // 30 second timeout

      peer.once("open", (id) => {
        clearTimeout(timeout);
        console.log(`[PEERJS] ✅ Connected to signaling server with ID: "${id}"`);
        console.log(`[PEERJS] Peer ID matches expected: ${id === srcPeerId}`);
        resolve();
      });

      peer.on("error", (error) => {
        clearTimeout(timeout);
        console.error(`[PEERJS] ❌ Peer error during connection:`, error);
        console.error(`[PEERJS] Error type: ${error.type}, message: ${error.message}`);
        reject(new Error(`Peer error: ${error.message}`));
      });
    });

    // Make the call to the destination peer and start connection tracking
    console.log(`[CALL] Starting call to destination peer: "${destPeerId}"`);
    console.log(`[CALL] Stream object for call:`, stream);
    console.log(
      `[CALL] Stream tracks for call:`,
      stream.getTracks().map((t) => `${t.kind}:${t.label}`),
    );

    const call = peer.call(destPeerId, stream);

    if (!call) {
      console.error(
        `[CALL] ❌ Failed to create call to ${destPeerId} - call object is null/undefined`,
      );
      window.streamingDebug.lastError = "Failed to create call object";
      return;
    }

    console.log(`[CALL] ✅ Call object created successfully:`, call);
    console.log(`[CALL] Call peer ID: "${call.peer}"`);
    console.log(`[CALL] Call type: "${call.type}"`);

    // Track the connection immediately since we're initiating the call
    console.log(`[CALL] Adding connection to tracking before call events...`);
    console.log(`[CALL] About to call addConnection with destPeerId: "${destPeerId}"`);
    console.log(
      `[CALL] activeConnections before addConnection:`,
      Array.from(window.activeConnections),
    );

    try {
      addConnection(destPeerId);
      console.log(`[CALL] ✅ addConnection completed successfully`);
      console.log(
        `[CALL] activeConnections after addConnection:`,
        Array.from(window.activeConnections),
      );
      console.log(
        `[CALL] activeConnections size after addConnection:`,
        window.activeConnections.size,
      );
    } catch (error) {
      console.error(`[CALL] ❌ addConnection failed:`, error);
      window.streamingDebug.lastError = `addConnection failed: ${error.message}`;
    }

    // Handle call lifecycle events
    call.on("stream", (remoteStream) => {
      console.log(`[CALL_EVENT] 'stream' event - Received remote stream from ${destPeerId}`);
      console.log(
        `[CALL_EVENT] Remote stream tracks:`,
        remoteStream.getTracks().map((t) => `${t.kind}:${t.label}`),
      );
      // Connection already tracked above, just log that it's bidirectional
    });

    // The 'open' event fires when the call is answered
    call.on("open", () => {
      console.log(`[CALL_EVENT] 'open' event - Call to ${destPeerId} opened successfully`);
      console.log(`[CALL_EVENT] Call is now active and streaming`);
      // Connection already tracked above, this is just confirmation
    });

    call.on("close", () => {
      console.log(`[CALL_EVENT] 'close' event - Call to ${destPeerId} ended`);
      removeConnection(destPeerId);
    });

    call.on("error", (error) => {
      console.error(`[CALL_EVENT] 'error' event - Call error with ${destPeerId}:`, error);
      console.error(`[CALL_EVENT] Error type: ${error.type}, message: ${error.message}`);
      removeConnection(destPeerId);
      window.streamingDebug.lastError = `Call error: ${error.message}`;
    });

    // Handle incoming calls (though this extension typically just calls out)
    console.log(`[PEER_EVENTS] Setting up peer event handlers...`);
    peer.on("call", (incomingCall) => {
      console.log(`[PEER_EVENT] 'call' event - Received incoming call from ${incomingCall.peer}`);
      addConnection(incomingCall.peer);

      // Auto-answer incoming calls with the same captured stream
      console.log(`[PEER_EVENT] Auto-answering incoming call with captured stream`);
      incomingCall.answer(stream);

      incomingCall.on("stream", (_remoteStream) => {
        console.log(
          `[PEER_EVENT] Incoming call 'stream' event - received remote stream from ${incomingCall.peer}`,
        );
      });

      incomingCall.on("close", () => {
        console.log(
          `[PEER_EVENT] Incoming call 'close' event - call from ${incomingCall.peer} ended`,
        );
        removeConnection(incomingCall.peer);
      });

      incomingCall.on("error", (error) => {
        console.error(
          `[PEER_EVENT] Incoming call 'error' event - error from ${incomingCall.peer}:`,
          error,
        );
        removeConnection(incomingCall.peer);
      });
    });

    // Handle peer-level events
    peer.on("disconnected", () => {
      console.log("[PEER_EVENT] Peer disconnected from signaling server");
      console.log("[PEER_EVENT] Note: existing calls may still be active");
    });

    peer.on("close", () => {
      console.log("[PEER_EVENT] Peer connection closed completely");
      console.log("[PEER_EVENT] Clearing all tracked connections");
      console.log(
        "[PEER_EVENT] activeConnections before clear:",
        Array.from(window.activeConnections),
      );
      window.activeConnections.clear();
      console.log(
        "[PEER_EVENT] activeConnections after clear:",
        Array.from(window.activeConnections),
      );
    });

    console.log(`[INITIALIZE] ✅ Initialization complete. Ready for streaming.`);
    console.log(`[INITIALIZE] Final activeConnections:`, Array.from(window.activeConnections));
    console.log(`[INITIALIZE] Final activeConnections size:`, window.activeConnections.size);
    console.log(`[INITIALIZE] ========== INITIALIZATION COMPLETE ==========`);
    recordDebugEvent("initialize_complete", {
      activeConnectionsSize: window.activeConnections.size,
    });
  } catch (error) {
    console.error(`[INITIALIZE] ❌ INITIALIZATION FAILED:`, error);
    console.error(`[INITIALIZE] Error stack:`, error.stack);
    window.streamingDebug.lastError = `Initialization failed: ${error.message}`;
    recordDebugEvent("initialize_failed", { message: error.message });
    throw error; // Re-throw so container server knows it failed
  }
}

// Log when the script finishes loading
console.log("[INIT] streaming.js script execution complete");
console.log("[INIT] INITIALIZE function available:", typeof INITIALIZE === "function");
console.log("[INIT] Global objects available:", {
  Peer: typeof Peer !== "undefined",
  chrome: typeof chrome !== "undefined",
  "chrome.tabCapture": typeof chrome !== "undefined" && typeof chrome.tabCapture !== "undefined",
});
