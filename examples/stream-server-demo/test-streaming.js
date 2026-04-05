/**
 * Stream Kit Testing Script
 *
 * Tests the complete streaming pipeline:
 * 1. Container server browser lifecycle
 * 2. Stream server routing (dev mode uses localhost:8080)
 * 3. Connection tracking and automatic shutdown
 */

const _sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function test() {
  console.log("🧪 Testing Stream Kit Components...\n");

  // Test 1: Container Server Health
  console.log("1️⃣ Testing Container Server Health...");
  try {
    const response = await fetch("http://localhost:8080/health");
    const health = await response.json();
    console.log("✅ Container Server:", health.status);
    console.log(`   Browser Active: ${health.browserActive || false}`);
    console.log(`   Monitoring Active: ${health.monitoringActive || false}\n`);
  } catch (error) {
    console.log("❌ Container Server not running:", error.message);
    console.log("   Run: cd container && bun run src/server.ts\n");
    return;
  }

  // Test 2: Stream Server Health
  console.log("2️⃣ Testing Stream Server Health...");
  try {
    const response = await fetch("http://localhost:8787/health");
    const health = await response.json();
    console.log("✅ Stream Server:", health.status);
    console.log("   Mode: Development (routing to localhost:8080)\n");
  } catch (error) {
    console.log("❌ Stream Server not running:", error.message);
    console.log("   Run: wrangler dev --env dev\n");
    return;
  }

  // Test 3: Browser Lifecycle Test
  console.log("3️⃣ Testing Browser Lifecycle Management...");
  console.log("   Starting streaming request...");

  try {
    const streamResponse = await fetch("http://localhost:8080/start-stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://www.example.com",
        peerId: `test-receiver-${Date.now()}`,
      }),
    });

    const result = await streamResponse.json();

    if (result.status === "success") {
      console.log("✅ Streaming started successfully");
      console.log(`   Source Peer ID: ${result.srcPeerId}`);
      console.log(`   Monitoring Active: ${result.monitoringActive}`);
      console.log("\n🔍 Connection monitoring will now check every 15 seconds...");
      console.log("   Since there's no real receiver, connections will be 0");
      console.log("   Browser should shut down in ~60 seconds of grace period");
    } else {
      console.log("❌ Streaming failed:", result.error || result.message);
    }
  } catch (error) {
    console.log("❌ Streaming request failed:", error.message);
  }

  console.log("\n📋 Manual Testing Options:");
  console.log("   • Check logs in both terminal windows");
  console.log("   • Browser should start, navigate to example.com");
  console.log("   • After ~75 seconds, browser should auto-shutdown");
  console.log("   • Container server polls window.activeConnections every 15s");

  console.log("\n🔧 Advanced Testing:");
  console.log("   • Create a real PeerJS receiver to test actual streaming");
  console.log("   • Monitor connection count: window.activeConnections.size");
  console.log("   • Test multiple concurrent streams");
}

// Run the tests
test().catch(console.error);
