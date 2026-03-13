/**
 * End-to-End Stream Testing Script
 * 
 * This script helps coordinate testing between the container server
 * and the receiver page by providing the receiver ID.
 */

const crypto = require('crypto');

async function testEndToEnd() {
  console.log('🧪 Stream Kit End-to-End Test\n');

  // Generate a consistent receiver ID for this test
  const receiverId = 'test-receiver-' + Date.now();
  console.log('📱 Generated Receiver ID:', receiverId);

  // Test 1: Check if container server is running
  console.log('\n1️⃣ Checking Container Server...');
  try {
    const healthResponse = await fetch('http://localhost:8080/health');
    const health = await healthResponse.json();
    console.log('✅ Container Server:', health.status);
    
    if (!health.browserActive) {
      console.log('⚠️  Browser not active - will be started with stream request');
    }
  } catch (error) {
    console.log('❌ Container Server not running:', error.message);
    console.log('   Run: cd container && bun run src/server.ts');
    return;
  }

  // Test 2: Start streaming with our receiver ID
  console.log('\n2️⃣ Starting Stream...');
  try {
    const streamResponse = await fetch('http://localhost:8080/start-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://www.nytimes.com', // More interesting than example.com
        peerId: receiverId
      })
    });
    
    const result = await streamResponse.json();
    
    if (result.status === 'success') {
      console.log('✅ Stream started successfully!');
      console.log('   📡 Source Peer ID:', result.srcPeerId);
      console.log('   🎯 Target Peer ID:', receiverId);
      console.log('   📺 Streaming URL: https://www.nytimes.com');
      
      console.log('\n🎬 Ready for Testing!');
      console.log('=====================');
      console.log('1. Open receiver.html in Chrome');
      console.log('2. The receiver ID should auto-fill as:', receiverId);
      console.log('3. Copy this Source Peer ID:', result.srcPeerId);
      console.log('4. Paste it in the receiver page and click Connect');
      console.log('5. You should see the NY Times page streaming!');
      
      console.log('\n📊 Connection Monitoring:');
      console.log('• Container polls connections every 15 seconds');
      console.log('• When you connect, activeConnections will show: 1');
      console.log('• When you disconnect, browser shuts down after 60s grace period');
      
      console.log('\n🔧 Quick Commands:');
      console.log('• Open receiver: open receiver.html');
      console.log('• Check connections: curl http://localhost:8080/health');
      
    } else {
      console.log('❌ Stream failed:', result.message);
    }
  } catch (error) {
    console.log('❌ Stream request failed:', error.message);
  }
}

// Run the test
testEndToEnd().catch(console.error); 