import React from 'react';
import { ArrowRight, Users, Bell, Tv, PlayCircle, User, Shield, Zap, Image as ImageIcon, ExternalLink, Github, Cloud, Server, Globe, Map, ArrowLeft, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import NavBar from '@/components/NavBar';
import OGSLogo from '@/components/OGSLogo';
import OGSSmallLogo from '@/components/OGSSmallLogo';
import SectionHeader from '@/components/SectionHeader';
import FeatureCard from '@/components/FeatureCard';
import SDKCard from '@/components/SDKCard';
import FAQAccordion from '@/components/FAQAccordion';
import CodeSnippet from '@/components/CodeSnippet';
import ImageGallery from '@/components/ImageGallery';
import Footer from '@/components/Footer';
import { Mermaid } from '@/components/ui/mermaid';
import SimpleSequenceDiagram from '@/components/ui/SimpleSequenceDiagram';
import SDKVisual from '@/components/SDKVisual';
import * as Tabs from '@radix-ui/react-tabs';

const Index = () => {
  // Sample code snippets
  const installCode = `# Install all kits
npm install \\
  @open-game-system/auth-kit \\
  @open-game-system/notification-kit \\
  @open-game-system/cast-kit

# Or install individually as needed
npm install @open-game-system/auth-kit`;
  
  const authKitCode = `import { createAuthClient } from '@open-game-system/auth-kit/client';

// Initialize the auth client
const authClient = createAuthClient({
  apiKey: 'your-api-key'
});

// Link user account
authClient.linkAccount()
  .then((response) => {
    console.log('User linked successfully', response.user);
  })
  .catch((error) => {
    console.error('Error linking account', error);
  });`;

  const notificationKitCode = `import { createNotificationClient } from '@open-game-system/notification-kit/client';

// Initialize the notification client
const notificationClient = createNotificationClient({
  apiKey: 'your-api-key'
});

// Send a notification
notificationClient.sendNotification({
  recipient: { gameUserId: 'user-123' },
  notification: {
    type: 'your_turn',
    title: 'Your Turn',
    body: "Player 2 has made their move. It's your turn now!",
    data: { gameId: 'game-456' },
    deepLink: 'https://triviajam.tv/games/3f7a6d8c-1e9b-4f82-a7d5-8e91c6b4d712'
  }
})
.then((result) => {
  console.log('Notification sent:', result.id);
})
.catch((error) => {
  console.error('Error sending notification:', error);
});`;

  const castKitCode = `import { createCastClient } from '@open-game-system/cast-kit/client';

// Initialize the cast client
const castClient = createCastClient();

// Signal that the game is ready to cast
castClient.signalReady({
  roomCode: 'room-123',
  broadcastUrl: 'https://yourgame.com/tv?roomCode=room-123'
});

// Listen for cast state changes
castClient.subscribe((state) => {
  if (state.isCasting) {
    console.log('Casting to:', state.deviceName);
    // Switch to controller UI
  }
});`;
  
  // FAQ items
  const faqItems = [
    {
      question: "What is the Open Game System app?",
      answer: "The Open Game System app is a unified platform that serves both players and developers. For players, it provides access to web games with native features like push notifications and TV casting. For developers, it offers built-in tools to test and distribute their games with native capabilities while keeping them web-first."
    },
    {
      question: "How does the sandbox work?",
      answer: "The app includes a built-in sandbox feature accessible from the Settings menu. Developers can enter any web game URL to create a sandboxed environment with access to native capabilities. This enables developers to test their web games with native features during development without needing to publish them first. The app is driven by a configuration that can be modified to include your own games for testing and distribution."
    },
    {
      question: "How do I implement push notifications for my web game?",
      answer: "OGS simplifies push notifications for web games through our notification-kit SDK. First, integrate the SDK into your game. Then, users who play your game through the OGS app can receive push notifications without installing a dedicated app. The notification-kit handles device tokens, delivery, and tracking across platforms. You can trigger notifications from your backend with just a few lines of code, and they'll be delivered even when users aren't actively playing."
    },
    {
      question: "What kind of native features can I access with OGS?",
      answer: "OGS provides access to native features like push notifications, TV casting, camera access, local storage, device sensors, and more while keeping your game as a web application."
    },
    {
      question: "Does my game need to be rewritten to use OGS?",
      answer: "No. OGS is designed to work with existing web games through simple SDK integration. You keep your web-first approach and add native capabilities progressively without any major code changes."
    },
    {
      question: "Is OGS available for all platforms?",
      answer: "OGS supports iOS, Android, desktop browsers, smart TVs, and game consoles that have web browsers. The SDK automatically detects the platform and provides appropriate APIs."
    },
    {
      question: "How much does OGS cost?",
      answer: "OGS components are open-source and free to use. The Open Game System app is available for free download. For casted games, we provide a free tier, then meter bandwidth and charge based on usage with no hidden markups. We maintain clear, transparent pricing based purely on actual usage."
    },
    {
      question: "What is OGS Cloud Rendering?",
      answer: "It's an optional feature allowing you to render your game on powerful cloud servers and stream the visuals via WebRTC to users. This provides high-fidelity graphics even on low-end devices, ideal for turn-based games."
    },
    {
      question: "When should I use Cloud Rendering?",
      answer: "Consider it for graphically intensive games, especially turn-based ones, where client hardware might be a bottleneck, or when you want to ensure a consistent high-quality visual experience across all devices."
    },
    {
      question: "Is latency an issue with Cloud Rendering?",
      answer: "Latency exists, making it less suitable for fast-paced action games. However, for turn-based games, strategy games, or experiences where reaction time isn't critical, the latency is generally acceptable and outweighed by the visual fidelity benefits."
    },
    {
      question: "What are the costs associated with Cloud Rendering?",
      answer: "Cloud rendering utilizes cloud GPU resources, which incur costs based on usage. OGS aims to provide transparent pricing structures. Costs are expected to decrease as GPU availability increases."
    },
    {
      question: "Can I cloud render only part of my game?",
      answer: "Yes! Cloud rendering doesn't have to be all or nothing. You can use the stream-kit to render a specific, graphically-intensive part of your game (like the main 3D view) and stream the resulting video *and audio* into a designated area of your existing web UI. This allows you to keep performance-critical UI elements like menus, HUDs, or buttons rendered natively while still leveraging cloud power for demanding visuals."
    },
    {
      question: "How do I separate layers for partial cloud rendering?",
      answer: "You structure your game routes accordingly. Your main game URL (e.g., `/game`) would load your standard web UI, including menus, HUDs, and the container for the stream. You would then create a specific route (e.g., `/game/stream-layer`) designed *only* to render the graphically intensive scene meant for cloud rendering. When you want to enable the feature, your main UI uses the `stream-kit` to request the `/game/stream-layer` URL be rendered in the cloud. The kit then places the resulting video *and audio* stream into the designated container in your main UI, effectively compositing the cloud-rendered layer with your native UI layer."
    }
  ];

  // Account linking sequence diagram entities and messages
  const accountLinkingEntities = [
    { id: 'user', label: 'User' },
    { id: 'gameClient', label: 'Game Client' },
    { id: 'gameServer', label: 'Game Server' },
    { id: 'ogsProvider', label: 'OGS Provider API' },
    { id: 'ogsWeb', label: 'OGS Web UI' }
  ];

  const accountLinkingMessages = [
    { from: 'user', to: 'gameClient', label: 'Initiates account linking' },
    { from: 'gameClient', to: 'gameServer', label: 'Request link token' },
    { from: 'gameServer', to: 'ogsProvider', label: 'POST /api/v1/auth/account-link-token' },
    { from: 'ogsProvider', to: 'ogsProvider', label: 'Validates request & generates token' },
    { from: 'ogsProvider', to: 'gameServer', label: 'Returns link token', direction: 'backward' as const },
    { from: 'gameServer', to: 'gameClient', label: 'Returns link token', direction: 'backward' as const },
    { from: 'gameClient', to: 'ogsWeb', label: 'Redirects to link account page' },
    { from: 'ogsWeb', to: 'ogsProvider', label: 'Validates token' },
    { from: 'ogsWeb', to: 'user', label: 'Displays authentication UI' },
    { from: 'user', to: 'ogsWeb', label: 'Authenticates with OGS' },
    { from: 'ogsWeb', to: 'user', label: 'Displays confirmation UI' },
    { from: 'user', to: 'ogsWeb', label: 'Confirms account linking' },
    { from: 'ogsWeb', to: 'ogsProvider', label: 'Processes account linking' },
    { from: 'ogsProvider', to: 'ogsProvider', label: 'Links accounts' },
    { from: 'ogsWeb', to: 'gameClient', label: 'Redirects back to game', direction: 'backward' as const },
    { from: 'gameClient', to: 'gameServer', label: 'Verifies link success' },
    { from: 'gameServer', to: 'ogsProvider', label: 'POST /api/v1/auth/verify-link-token' },
    { from: 'ogsProvider', to: 'gameServer', label: 'Confirms link status', direction: 'backward' as const },
    { from: 'gameServer', to: 'gameClient', label: 'Updates UI to show linked status', direction: 'backward' as const }
  ];

  // Web auth token diagram entities and messages
  const webAuthTokenEntities = [
    { id: 'user', label: 'User' },
    { id: 'ogsApp', label: 'OGS Mobile App' },
    { id: 'gameWeb', label: 'Game Web Client' },
    { id: 'gameServer', label: 'Game Server' },
    { id: 'ogsProvider', label: 'OGS Provider API' }
  ];

  const webAuthTokenMessages = [
    { from: 'user', to: 'ogsApp', label: 'Opens game in app' },
    { from: 'ogsApp', to: 'ogsProvider', label: 'POST /api/v1/auth/web-code' },
    { from: 'ogsProvider', to: 'ogsProvider', label: 'Creates JWT with userId' },
    { from: 'ogsProvider', to: 'ogsApp', label: 'Returns web auth code', direction: 'backward' as const },
    { from: 'ogsApp', to: 'gameWeb', label: 'Open WebView with URL?code=xyz123' },
    { from: 'gameWeb', to: 'gameServer', label: 'Request with code parameter' },
    { from: 'gameServer', to: 'ogsProvider', label: 'POST /api/v1/auth/verify-token' },
    { from: 'ogsProvider', to: 'ogsProvider', label: 'Verifies token & extracts user info' },
    { from: 'ogsProvider', to: 'gameServer', label: 'Returns user info', direction: 'backward' as const },
    { from: 'gameServer', to: 'gameServer', label: 'Creates session for user' },
    { from: 'gameServer', to: 'gameWeb', label: 'Set auth cookies & redirect', direction: 'backward' as const },
    { from: 'gameWeb', to: 'gameServer', label: 'Subsequent requests with cookies' },
    { from: 'gameServer', to: 'gameWeb', label: 'Return authenticated responses', direction: 'backward' as const },
    { from: 'gameWeb', to: 'user', label: 'Display authenticated game content' }
  ];

  // Casting diagram entities and messages
  const castingEntities = [
    { id: 'user', label: 'User' },
    { id: 'game', label: 'Game Client' },
    { id: 'gameServer', label: 'Game Server' },
    { id: 'ogsCast', label: 'OGS Cast API' },
    { id: 'tv', label: 'Chromecast Device' }
  ];

  const castingMessages = [
    { from: 'user', to: 'game', label: 'Initiates cast' },
    { from: 'game', to: 'gameServer', label: 'Request cast session' },
    { from: 'gameServer', to: 'ogsCast', label: 'POST /api/v1/cast/session' },
    { from: 'ogsCast', to: 'ogsCast', label: 'Creates cast session' },
    { from: 'ogsCast', to: 'tv', label: 'Initializes receiver app' },
    { from: 'ogsCast', to: 'gameServer', label: 'Returns session details', direction: 'backward' as const },
    { from: 'gameServer', to: 'game', label: 'Returns cast session ID', direction: 'backward' as const },
    { from: 'game', to: 'game', label: 'Switches to controller mode' },
    // Gameplay loop
    { from: 'user', to: 'game', label: 'Controller input' },
    { from: 'game', to: 'ogsCast', label: 'POST /api/v1/cast/input' },
    { from: 'ogsCast', to: 'tv', label: 'Forwards input' },
    { from: 'tv', to: 'tv', label: 'Updates game state' },
    { from: 'tv', to: 'user', label: 'Renders updated state' }
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <NavBar />
      
      {/* Hero Section */}
      <section className="pt-32 pb-20 relative overflow-hidden">
        <div className="container mx-auto px-4 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left">
              <div className="flex items-center justify-center lg:justify-start mb-4">
                <OGSSmallLogo className="w-12 h-12 mr-3" />
                <span className="font-orbitron text-lg font-bold">Open Game System</span>
              </div>
              <h1 className="text-4xl md:text-6xl font-bold font-orbitron mb-4 bg-clip-text text-transparent bg-gradient-to-r from-ogs-purple to-primary">
                Bridge Web Games to Native Features
              </h1>
              <p className="text-xl text-muted-foreground mb-8 max-w-xl mx-auto lg:mx-0">
                Enable your web games to access native capabilities like push notifications, TV casting, and achieve high-fidelity graphics on any device through cloud streaming.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Button asChild size="lg" className="bg-primary hover:bg-primary/90">
                  <a href="#get-started">
                    Get Started <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <a href="https://github.com/open-game-system" target="_blank" rel="noopener noreferrer">
                    <Github className="mr-2 h-4 w-4" />
                    View on GitHub
                  </a>
                </Button>
              </div>
            </div>
            <div className="flex justify-center lg:justify-end">
              <div className="w-full max-w-md">
                <OGSLogo className="w-full h-auto" />
              </div>
            </div>
          </div>
        </div>
        
        {/* Gradient background */}
        <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-ogs-purple/10 to-transparent -z-10" />
      </section>

      {/* What is OGS Section */}
      <section id="about" className="section-padding">
        <div className="container mx-auto">
          <SectionHeader 
            title="What is OGS?"
            subtitle="Open Game System enables web games to access native device features without sacrificing their web-first nature."
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
            <FeatureCard 
              title="Web-First"
              description="Keep your game as a web application with all the benefits of web distribution and instant play."
              icon={<PlayCircle className="h-6 w-6 text-primary" />}
              delay={0}
            />
            <FeatureCard 
              title="Native Access"
              description="Seamlessly integrate with native device features like push notifications, camera, and more."
              icon={<Zap className="h-6 w-6 text-primary" />}
              delay={100}
            />
            <FeatureCard 
              title="Cross Platform"
              description="Works across mobile, desktop, smart TVs, and game consoles with browser support."
              icon={<Users className="h-6 w-6 text-primary" />}
              delay={200}
            />
            <FeatureCard
              title="Cloud Rendering"
              description="Deliver high-fidelity graphics for your web game by rendering it in the cloud and streaming it to any device via WebRTC. Ideal for turn-based games requiring significant GPU power."
              icon={<Cloud className="h-6 w-6 text-primary" />}
              delay={400}
            />
          </div>
        </div>
      </section>

      {/* Core Components Section */}
      <section id="components" className="section-padding bg-secondary/50">
        <div className="container mx-auto">
          <SectionHeader 
            title="Core Components"
            subtitle="OGS provides a suite of SDKs that enable different native capabilities for your web games."
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
            <SDKCard 
              title="auth-kit"
              description="Link user accounts between games and OGS platform for seamless identity management."
              icon={<User className="h-6 w-6 text-primary" />}
              delay={0}
              href="#auth-kit-integration"
            />
            <SDKCard 
              title="notification-kit"
              description="Send and receive push notifications to keep players engaged, even when they're not actively playing."
              icon={<Bell className="h-6 w-6 text-primary" />}
              delay={200}
              href="#notification-kit-integration"
            />
            <SDKCard 
              title="cast-kit"
              description="Enable TV casting capabilities, allowing players to display their games on larger screens."
              icon={<Tv className="h-6 w-6 text-primary" />}
              delay={400}
              href="#cast-kit-integration"
            />
            <SDKCard
              title="stream-kit"
              description="Integrate cloud rendering capabilities. Stream graphics-intensive games from the server to provide a premium visual experience on low-power devices."
              icon={<Cloud className="h-6 w-6 text-primary" />}
              delay={600}
              href="#stream-kit-integration"
            />
          </div>
        </div>
      </section>

      {/* OGS App Section */}
      <section id="ogs-app" className="section-padding">
        <div className="container mx-auto">
          <SectionHeader 
            title="Open Game System App"
            subtitle="One app for both players and developers"
          />
          
          <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* App description */}
            <div className="bg-card p-6 rounded-xl border border-border">
              <h3 className="text-xl font-bold mb-4">Open Game System</h3>
              <p className="text-lg mb-4">
                A unified platform that lets players enjoy web games with native features, while giving developers an easy way to test their own games and leverage optional cloud rendering.
              </p>
              
              <div className="space-y-4">
                <div className="bg-primary/10 p-4 rounded-lg">
                  <h4 className="text-lg font-medium mb-2">Player Features</h4>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <div className="rounded-full bg-primary/10 p-1 mt-0.5">
                        <Zap className="h-4 w-4 text-primary" />
                      </div>
                      <span>Game discovery & quick launch</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="rounded-full bg-primary/10 p-1 mt-0.5">
                        <Bell className="h-4 w-4 text-primary" />
                      </div>
                      <span>Push notifications</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="rounded-full bg-primary/10 p-1 mt-0.5">
                        <Tv className="h-4 w-4 text-primary" />
                      </div>
                      <span>TV casting</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="rounded-full bg-primary/10 p-1 mt-0.5">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <span>Account linking</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="rounded-full bg-primary/10 p-1 mt-0.5">
                        <Cloud className="h-4 w-4 text-primary" />
                      </div>
                      <span>Stream high-fidelity graphics</span>
                    </li>
                  </ul>
                </div>
                
                <div className="bg-primary/10 p-4 rounded-lg">
                  <h4 className="text-lg font-medium mb-2">Developer Features</h4>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <div className="rounded-full bg-primary/10 p-1 mt-0.5">
                        <Zap className="h-4 w-4 text-primary" />
                      </div>
                      <span>Test any web game in sandbox</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="rounded-full bg-primary/10 p-1 mt-0.5">
                        <Bell className="h-4 w-4 text-primary" />
                      </div>
                      <span>Test push notifications</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="rounded-full bg-primary/10 p-1 mt-0.5">
                        <Tv className="h-4 w-4 text-primary" />
                      </div>
                      <span>Preview TV casting</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="rounded-full bg-primary/10 p-1 mt-0.5">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <span>Access native features</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="rounded-full bg-primary/10 p-1 mt-0.5">
                        <Cloud className="h-4 w-4 text-primary" />
                      </div>
                      <span>Test cloud rendering & streaming</span>
                    </li>
                  </ul>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button asChild className="bg-primary hover:bg-primary/90">
                    <a href="https://github.com/open-game-system/opengame-app" target="_blank" rel="noopener noreferrer">
                      <Github className="mr-2 h-4 w-4" />
                      View on GitHub
                    </a>
                  </Button>
                  <Button asChild variant="outline">
                    <a href="#" target="_blank" rel="noopener noreferrer">
                      Download for Android
                    </a>
                  </Button>
                  <Button asChild variant="outline">
                    <a href="#" target="_blank" rel="noopener noreferrer">
                      Download for iOS
                    </a>
                  </Button>
                </div>
              </div>
            </div>
            
            {/* Development workflow */}
            <div className="bg-card p-6 rounded-xl border border-border">
              <h3 className="text-xl font-bold mb-4">Testing Your Games</h3>
              <p className="text-lg mb-4">
                Any URL you enter in the app creates a sandboxed environment for that specific game with access to native features.
              </p>
              
              <div className="mt-4">
                <h4 className="text-lg font-medium mb-2">How to Test Your Game</h4>
                <ol className="space-y-4 ml-4 list-decimal">
                  <li>
                    <p className="text-muted-foreground">Tap the "Settings" icon in the app's navigation</p>
                  </li>
                  <li>
                    <p className="text-muted-foreground">Select "Sandbox" from the settings menu</p>
                  </li>
                  <li>
                    <p className="text-muted-foreground">Enter your web game's URL and tap "Load Game"</p>
                  </li>
                  <li>
                    <p className="text-muted-foreground">Your game loads in a WebView with access to all native features</p>
                  </li>
                </ol>
              </div>

              <div className="mt-6">
                <p className="text-sm text-muted-foreground mb-2">URL examples:</p>
                <CodeSnippet code={`# Enter any web game URL:
# Production sites
https://yourgame.com
https://mygame.example.com

# Development environments
https://dev.yourgame.com
https://staging.mygame.example.com

# Local network testing (if you have a web server)
http://192.168.1.15:3000   # Replace with your computer's IP`} title="URL Input" />
              </div>
            </div>
          </div>
          
          <h3 className="text-xl font-bold mt-12 mb-4 text-center">App Tour</h3>
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
            {/* Main App Visual */}
            <div className="flex justify-center">
              <div className="relative w-full max-w-sm">
                <div className="bg-card border border-border rounded-[32px] shadow-lg aspect-[9/19] overflow-hidden">
                  <div className="w-full h-full bg-gradient-to-br from-ogs-purple/30 to-primary/20 flex flex-col">
                    {/* Header with App name */}
                    <div className="px-4 py-3 flex items-center">
                      <div className="flex-1"></div>
                      <div className="flex items-center justify-center">
                        <OGSSmallLogo className="w-6 h-6 mr-2" />
                        <span className="font-bold font-orbitron">OGS</span>
                      </div>
                      <div className="flex-1 flex justify-end">
                        <div className="w-8 h-8 bg-background/40 backdrop-blur-sm rounded-full flex items-center justify-center">
                          <User className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                    
                    {/* Content area */}
                    <div className="flex-1 p-4 flex flex-col">
                      <div className="mb-6">
                        <h2 className="text-xl font-bold mb-2">Featured Games</h2>
                        <div className="rounded-lg overflow-hidden bg-background/40 backdrop-blur-sm border border-border aspect-video mb-2">
                          <div className="h-full w-full bg-gradient-to-br from-ogs-purple/20 to-primary/10 flex items-center justify-center">
                            <span className="font-medium">Trivia Jam</span>
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <h2 className="text-xl font-bold mb-3">Your Games</h2>
                        <div className="space-y-3">
                          <div className="flex items-center p-3 bg-background/40 backdrop-blur-sm rounded-lg border border-border">
                            <div className="w-10 h-10 bg-primary/20 rounded-md flex items-center justify-center mr-3">
                              <ImageIcon className="w-5 h-5 text-primary" />
                            </div>
                            <div className="flex-1">
                              <div className="font-medium">Trivia Jam</div>
                              <div className="text-xs text-muted-foreground">Recently played</div>
                            </div>
                            <Button variant="outline" size="sm" className="h-8">Play</Button>
                          </div>
                          
                          <div className="flex items-center p-3 bg-background/40 backdrop-blur-sm rounded-lg border border-border">
                            <div className="w-10 h-10 bg-primary/20 rounded-md flex items-center justify-center mr-3">
                              <ImageIcon className="w-5 h-5 text-primary" />
                            </div>
                            <div className="flex-1">
                              <div className="font-medium">Another Game</div>
                              <div className="text-xs text-muted-foreground">2 days ago</div>
                            </div>
                            <Button variant="outline" size="sm" className="h-8">Play</Button>
                          </div>
                        </div>
                      </div>
                      
                      {/* Bottom navigation with Settings button */}
                      <div className="mt-auto">
                        <div className="grid grid-cols-3 pt-3 border-t border-border">
                          <div className="flex flex-col items-center">
                            <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
                              <div className="w-5 h-5 text-primary">🏠</div>
                            </div>
                            <span className="text-xs mt-1">Home</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <div className="h-10 w-10 rounded-full flex items-center justify-center">
                              <div className="w-5 h-5 text-muted-foreground">🔍</div>
                            </div>
                            <span className="text-xs mt-1 text-muted-foreground">Discover</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center animate-pulse">
                              <div className="w-5 h-5 text-primary">⚙️</div>
                            </div>
                            <span className="text-xs mt-1">Settings</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="absolute -bottom-6 text-center w-full">
                  <div className="inline-block font-medium bg-card text-foreground px-4 py-2 rounded-lg shadow-md text-sm">
                    Home Screen
                  </div>
                </div>
              </div>
            </div>
            
            {/* URL Input Screen Visual */}
            <div className="flex justify-center">
              <div className="relative w-full max-w-sm">
                <div className="bg-card border border-border rounded-[32px] shadow-lg aspect-[9/19] overflow-hidden">
                  <div className="w-full h-full bg-gradient-to-br from-ogs-purple/30 to-primary/20 flex flex-col">
                    {/* Header matching the image with back button */}
                    <div className="px-4 py-3 flex items-center">
                      <div className="flex items-center">
                        <div className="h-8 w-8 bg-background/40 backdrop-blur-sm rounded-full flex items-center justify-center mr-3 cursor-pointer">
                          <div className="text-primary font-bold">←</div>
                        </div>
                        <OGSSmallLogo className="w-5 h-5 mr-2" />
                        <span className="font-bold font-orbitron">OGS</span>
                        <span className="text-xs bg-primary/20 px-2 py-0.5 rounded-full ml-2">SANDBOX</span>
                      </div>
                    </div>
                    
                    {/* Content area matching the image */}
                    <div className="flex-1 p-4 flex flex-col">
                      <h4 className="text-sm font-medium mb-4">Enter a URL</h4>
                      
                      <div className="bg-background/80 backdrop-blur-sm p-3 rounded-md mb-4">
                        <div className="bg-muted/80 p-2 rounded text-xs font-mono">https://yourgame.com</div>
                      </div>
                      
                      <p className="text-xs mb-4">This URL will load in a sandbox with access to native features</p>
                      
                      <Button size="sm" className="w-full justify-center mb-6 bg-primary hover:bg-primary/90">
                        Load Game
                      </Button>
                      
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="text-sm font-medium">Recently tested</h4>
                          <span className="text-xs">CLEAR</span>
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex items-center p-2 rounded-md">
                            <div className="w-8 h-8 bg-primary/20 rounded-md flex items-center justify-center mr-3">
                              <ImageIcon className="w-4 h-4 text-primary" />
                            </div>
                            <div className="flex-1">
                              <div className="text-sm">Trivia Jam</div>
                              <div className="text-xs text-muted-foreground">https://triviajam.tv</div>
                            </div>
                            <div>›</div>
                          </div>
                          
                          <div className="flex items-center p-2 rounded-md">
                            <div className="w-8 h-8 bg-primary/20 rounded-md flex items-center justify-center mr-3">
                              <ImageIcon className="w-4 h-4 text-primary" />
                            </div>
                            <div className="flex-1">
                              <div className="text-sm">Local Game</div>
                              <div className="text-xs text-muted-foreground">http://192.168.1.15:3000</div>
                            </div>
                            <div>›</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="absolute -bottom-6 text-center w-full">
                  <div className="inline-block font-medium bg-card text-foreground px-4 py-2 rounded-lg shadow-md text-sm">
                    Sandbox Screen
                  </div>
                </div>
              </div>
            </div>
            
            {/* Game Loaded in WebView Visual */}
            <div className="flex justify-center">
              <div className="relative w-full max-w-sm">
                <div className="bg-card border border-border rounded-[32px] shadow-lg aspect-[9/19] overflow-hidden">
                  <div className="w-full h-full flex flex-col">
                    {/* Header with URL and controls */}
                    <div className="px-4 py-3 bg-gradient-to-r from-ogs-purple/30 to-primary/20 border-b border-border flex items-center">
                      <div className="flex items-center mr-2">
                        <div className="h-6 w-6 bg-background/40 backdrop-blur-sm rounded-full flex items-center justify-center cursor-pointer">
                          <div className="text-primary font-bold text-sm">←</div>
                        </div>
                      </div>
                      <div className="flex-1 flex items-center">
                        <span className="text-xs font-mono truncate">triviajam.tv</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-primary/20 px-2 py-0.5 rounded-full">Sandbox</span>
                        <span className="w-6 h-6 flex items-center justify-center">×</span>
                      </div>
                    </div>
                    
                    {/* WebView content - game loaded */}
                    <div className="flex-1 bg-background">
                      {/* Trivia Game UI Mockup */}
                      <div className="h-full w-full bg-purple-900 flex flex-col">
                        <div className="p-4 flex items-center justify-between">
                          <span className="font-bold text-white">Trivia Jam</span>
                          <span className="text-xs text-white bg-white/20 px-2 py-1 rounded">Score: 250</span>
                        </div>
                        
                        <div className="flex-1 flex flex-col items-center justify-center p-6">
                          <div className="w-full bg-white/10 backdrop-blur-sm p-4 rounded-lg mb-6">
                            <h3 className="text-white text-lg font-medium mb-3">Which planet has the most moons?</h3>
                            <div className="space-y-2">
                              <div className="bg-white/20 p-2 rounded-lg text-white">Mars</div>
                              <div className="bg-white/20 p-2 rounded-lg text-white">Earth</div>
                              <div className="bg-primary/60 p-2 rounded-lg text-white font-medium">Saturn</div>
                              <div className="bg-white/20 p-2 rounded-lg text-white">Jupiter</div>
                            </div>
                          </div>
                          <div className="w-full">
                            <Button size="sm" className="w-full justify-center bg-primary hover:bg-primary/90">
                              Next Question
                            </Button>
                          </div>
                        </div>
                        
                        <div className="p-3 border-t border-white/10">
                          <div className="flex justify-between items-center text-xs text-white">
                            <span>Question 3/10</span>
                            <span>Time: 0:45</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="absolute -top-6 right-1/4 w-32 h-12 bg-white text-black p-2 rounded-lg shadow-md text-xs text-center transform rotate-6">
                  With native features!
                </div>
                <div className="absolute -bottom-6 text-center w-full">
                  <div className="inline-block font-medium bg-card text-foreground px-4 py-2 rounded-lg shadow-md text-sm">
                    Game Running
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="section-padding bg-secondary/50">
        <div className="container mx-auto px-4">
          <SectionHeader 
            title="How It Works"
            subtitle="OGS is designed as a comprehensive ecosystem with a web-first approach and native capabilities."
          />
          
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-xl font-bold text-primary">1</span>
                </div>
                <div>
                  <h3 className="text-lg font-medium mb-2">Web-First Development</h3>
                  <p className="text-muted-foreground">Start with your web game. OGS integrates with existing web games through simple SDK packages that maintain your game's identity.</p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-xl font-bold text-primary">2</span>
                </div>
                <div>
                  <h3 className="text-lg font-medium mb-2">OGS App Integration</h3>
                  <p className="text-muted-foreground">Your web game runs inside the Open Game System app's WebView or receives a high-fidelity stream rendered in the cloud, accessing native capabilities like push notifications and TV casting.</p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-xl font-bold text-primary">3</span>
                </div>
                <div>
                  <h3 className="text-lg font-medium mb-2">SDK Integration</h3>
                  <p className="text-muted-foreground">Utilize the OGS SDKs for notifications, authentication, and casting—powerful tools that connect your game to native functionality.</p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-xl font-bold text-primary">4</span>
                </div>
                <div>
                  <h3 className="text-lg font-medium mb-2">Progressive Enhancement</h3>
                  <p className="text-muted-foreground">Your game still works in regular browsers with appropriate fallbacks, providing a seamless experience across all platforms.</p>
                </div>
              </div>
            </div>
            
            {/* Simplified Visual Representation */}
            <div className="bg-card p-6 rounded-xl border border-border flex items-center justify-center min-h-[300px]">
              <Mermaid 
                chart={`
graph LR
    A["Your Web Game"] --> B{"Open Game System"};
    B -- SDKs --> C["Native Features (Notifications, Cast, etc.)"];
    B -- Optional --> D["Cloud Rendering Service"];
    D --> E["High-Fidelity Stream"];
    C --> F["Enhanced Experience"];
    E --> F;

    style B fill:#331b47,stroke:#9333EA,stroke-width:2px,color:#eee
    style D fill:#1e40af,stroke:#60a5fa,stroke-width:1.5px,color:#eee
    style C fill:#2d2d3f,stroke:#777,color:#ccc
    style E fill:#2d2d3f,stroke:#777,color:#ccc
    style F fill:#166534,stroke:#22c55e,color:#eee
                `}
                className="w-full h-full"
              />
            </div>

          </div>
        </div>
      </section>

      {/* Stream Kit Section */}
      <section id="stream-kit" className="section-padding">
        <div className="container mx-auto">
          <SectionHeader 
            title="Stream Kit"
            subtitle="Compose multiple StreamCanvas instances to create rich, interactive game experiences with cloud-rendered graphics."
          />
          
          <div className="flex items-center justify-center gap-12 overflow-x-auto pb-8 mt-16">
            {/* World Scene */}
            <div className="relative w-[280px] h-[560px] rounded-[32px] overflow-hidden bg-[#1e1e2e] border border-border flex-shrink-0">
              <div className="absolute inset-0 bg-gradient-to-b from-[#2d1b47] to-[#1e1e2e]">
                <div className="absolute inset-x-0 bottom-0 h-1/3 bg-[#2a1f3d]" />
                <div className="absolute left-1/2 bottom-[40%] w-3 h-3 bg-[#f056c7] rounded-full" />
              </div>
              {/* Header with back button and title */}
              <div className="absolute top-0 left-0 right-0 p-4">
                <div className="flex items-center gap-3">
                  <button className="w-8 h-8 rounded-full bg-black/30 flex items-center justify-center">
                    <ArrowLeft className="w-4 h-4 text-primary" />
                  </button>
                  <span className="text-sm font-medium text-white">World View</span>
                </div>
              </div>
              {/* iOS-style Tab Bar */}
              <div className="absolute bottom-0 inset-x-0 h-20 bg-black/50 backdrop-blur-sm border-t border-white/10">
                <div className="grid grid-cols-3 h-full">
                  <div className="flex flex-col items-center justify-center gap-1">
                    <div className="w-6 h-6 rounded-lg bg-primary"></div>
                    <span className="text-xs text-primary">World</span>
                  </div>
                  <div className="flex flex-col items-center justify-center gap-1">
                    <div className="w-6 h-6 rounded-lg bg-white/20"></div>
                    <span className="text-xs text-white/60">Map</span>
                  </div>
                  <div className="flex flex-col items-center justify-center gap-1">
                    <div className="w-6 h-6 rounded-lg bg-white/20"></div>
                    <span className="text-xs text-white/60">Character</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Map Scene */}
            <div className="relative w-[280px] h-[560px] rounded-[32px] overflow-hidden bg-[#1e1e2e] border border-border flex-shrink-0">
              <div className="absolute inset-0 bg-gradient-to-b from-[#2d1b47] to-[#1e1e2e]">
                <div className="absolute inset-0 bg-[#2d1b47]/50">
                  {/* Full screen map visualization */}
                  <div className="absolute inset-4 grid grid-cols-4 grid-rows-4 gap-2">
                    {Array.from({ length: 16 }).map((_, i) => (
                      <div key={i} className="bg-[#1e1e2e]/30 rounded-lg border border-white/10" />
                    ))}
                    <div className="absolute left-1/2 top-1/2 w-3 h-3 bg-[#f056c7] rounded-full -translate-x-1/2 -translate-y-1/2" />
                  </div>
                </div>
              </div>
              {/* Header with back button and title */}
              <div className="absolute top-0 left-0 right-0 p-4">
                <div className="flex items-center gap-3">
                  <button className="w-8 h-8 rounded-full bg-black/30 flex items-center justify-center">
                    <ArrowLeft className="w-4 h-4 text-primary" />
                  </button>
                  <span className="text-sm font-medium text-white">Map View</span>
                </div>
              </div>
              {/* iOS-style Tab Bar */}
              <div className="absolute bottom-0 inset-x-0 h-20 bg-black/50 backdrop-blur-sm border-t border-white/10">
                <div className="grid grid-cols-3 h-full">
                  <div className="flex flex-col items-center justify-center gap-1">
                    <div className="w-6 h-6 rounded-lg bg-white/20"></div>
                    <span className="text-xs text-white/60">World</span>
                  </div>
                  <div className="flex flex-col items-center justify-center gap-1">
                    <div className="w-6 h-6 rounded-lg bg-primary"></div>
                    <span className="text-xs text-primary">Map</span>
                  </div>
                  <div className="flex flex-col items-center justify-center gap-1">
                    <div className="w-6 h-6 rounded-lg bg-white/20"></div>
                    <span className="text-xs text-white/60">Character</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Character Scene */}
            <div className="relative w-[280px] h-[560px] rounded-[32px] overflow-hidden bg-[#1e1e2e] border border-border flex-shrink-0">
              <div className="absolute inset-0 bg-gradient-to-b from-[#2d1b47] to-[#1e1e2e]">
                <div className="absolute inset-x-0 bottom-0 h-1/3 bg-[#2a1f3d]" />
                <div className="absolute left-1/2 bottom-[40%] w-3 h-3 bg-[#f056c7] rounded-full" />
              </div>
              {/* Header with back button and title */}
              <div className="absolute top-0 left-0 right-0 p-4">
                <div className="flex items-center gap-3">
                  <button className="w-8 h-8 rounded-full bg-black/30 flex items-center justify-center">
                    <ArrowLeft className="w-4 h-4 text-primary" />
                  </button>
                  <span className="text-sm font-medium text-white">Character View</span>
                </div>
              </div>
              {/* Action Buttons */}
              <div className="absolute bottom-24 left-1/2 -translate-x-1/2">
                <div className="flex gap-2">
                  <button className="px-4 py-2 bg-primary rounded text-sm">Inventory</button>
                  <button className="px-4 py-2 bg-primary rounded text-sm">Menu</button>
                </div>
              </div>
              {/* iOS-style Tab Bar */}
              <div className="absolute bottom-0 inset-x-0 h-20 bg-black/50 backdrop-blur-sm border-t border-white/10">
                <div className="grid grid-cols-3 h-full">
                  <div className="flex flex-col items-center justify-center gap-1">
                    <div className="w-6 h-6 rounded-lg bg-white/20"></div>
                    <span className="text-xs text-white/60">World</span>
                  </div>
                  <div className="flex flex-col items-center justify-center gap-1">
                    <div className="w-6 h-6 rounded-lg bg-white/20"></div>
                    <span className="text-xs text-white/60">Map</span>
                  </div>
                  <div className="flex flex-col items-center justify-center gap-1">
                    <div className="w-6 h-6 rounded-lg bg-primary"></div>
                    <span className="text-xs text-primary">Character</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Protocol Examples Section */}
      <section id="protocol-examples" className="section-padding">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 gap-16">
            {/* 1. Stream Kit */}
            <div id="stream-kit-integration">
              <div className="text-center mb-8">
                <span className="text-4xl mb-4 inline-block">☁️</span>
                <h3 className="text-2xl font-bold mb-2 font-orbitron bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-sky-500">Stream Kit Integration</h3>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  Leverage cloud rendering to deliver high-fidelity graphics for specific game scenes, streamed seamlessly to any device. Ideal for composing complex visuals within your standard web UI.
                </p>
              </div>
              <div className="max-w-3xl mx-auto space-y-6">
                <div className="bg-card p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Step 1: Create your render routes</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Create standalone pages that render your 3D scenes. These will be cloud-rendered and streamed to your main UI.
                  </p>
                  <CodeSnippet 
                    code={`// app/world/page.js - Three.js world scene
import { Canvas } from '@react-three/fiber'
import { World } from '@/components/World'

export default function WorldPage() {
  return (
    <Canvas>
      <World />
      <ambientLight />
    </Canvas>
  )
}

// app/map/page.js - Google Maps + React Three Fiber scene
import { Canvas } from '@react-three/fiber'
import { MapView } from '@/components/MapView'

export default function MapPage() {
  return (
    <Canvas>
      <MapView />
      <directionalLight position={[10, 10, 5]} />
    </Canvas>
  )
}

// app/character/page.js - Three.js character scene
import { Canvas } from '@react-three/fiber'
import { Character } from '@/components/Character'

export default function CharacterPage() {
  return (
    <Canvas>
      <Character />
      <ambientLight />
    </Canvas>
  )
}`} 
                    title="Render Routes" 
                  />
                </div>
                <div className="bg-card p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Step 2: Install the stream-kit SDK</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Add the stream-kit package to your project.
                  </p>
                  <CodeSnippet 
                    code={`npm install @open-game-system/stream-kit`} 
                    title="Installation" 
                  />
                </div>
                <div className="bg-card p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Step 3: Use StreamCanvas in your main UI</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Integrate the StreamCanvas component to display the cloud-rendered scenes pointed to by their URLs.
                  </p>
                  <CodeSnippet 
                    code={`// app/page.js - Main game UI
import { StreamCanvas } from '@open-game-system/stream-kit'

export default function GamePage() {
  return (
    <div>
      <Tabs>
        {/* Each StreamCanvas points to a standalone render route */}
        <Tab value="world">
          <StreamCanvas 
            url={process.env.NEXT_PUBLIC_WEB_HOST + '/world'} 
            className="w-full h-full"
          />
        </Tab>
        
        <Tab value="map">
          <StreamCanvas 
            url={process.env.NEXT_PUBLIC_WEB_HOST + '/map'} 
            className="w-full h-full"
          />
        </Tab>
        
        <Tab value="character">
          <StreamCanvas 
            url={process.env.NEXT_PUBLIC_WEB_HOST + '/character'} 
            className="w-full h-full"
          />
        </Tab>
      </Tabs>

      {/* Your game UI controls */}
      <button>Inventory</button>
      <button>Menu</button>
    </div>
  )
}`} 
                    title="Main UI Integration" 
                  />
                </div>
              </div>
            </div>

            {/* 2. Cast Kit */}
            <div id="cast-kit-integration">
              <div className="text-center mb-8 mt-16">
                <span className="text-4xl mb-4 inline-block">📺</span>
                <h3 className="text-2xl font-bold mb-2 font-orbitron bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-emerald-500">Cast Kit Integration</h3>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  Enable players to cast your game to larger screens like TVs using Chromecast, transforming their mobile device into a dedicated controller for a shared experience.
                </p>
              </div>
              <div className="max-w-3xl mx-auto space-y-6">
                <div className="bg-card p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Step 1: Install the Package</h4>
                  <CodeSnippet code={`npm install @open-game-system/cast-kit`} title="Terminal" />
                </div>
                
                <div className="bg-card p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Step 2: Initialize the Client</h4>
                  <CodeSnippet code={castKitCode} title="Client-side code" />
                </div>
                
                <div className="bg-card p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Step 3: Implement Casting</h4>
                  <CodeSnippet code={`// Button to start casting\ndocument.getElementById('cast-button').addEventListener('click', () => {\n  // Signal that the game is ready to cast\n  castClient.startCasting({\n    roomCode: 'game-123',\n    gameUrl: 'https://yourgame.com/tv?mode=cast&roomCode=game-123'\n  });\n});\n\n// Send controller input when casting\nfunction sendControllerInput(action, data) {\n  if (castClient.getState().isCasting) {\n    castClient.sendInput({\n      action: action,\n      data: data\n    });\n  }\n}`} title="Casting implementation" />
                </div>
                
                <div className="mt-2">
                  <SDKVisual type="cast" />
                </div>
              </div>
            </div>
            
            {/* 3. Notification Kit */}
            <div id="notification-kit-integration">
              <div className="text-center mb-8 mt-16">
                <span className="text-4xl mb-4 inline-block">🔔</span>
                <h3 className="text-2xl font-bold mb-2 font-orbitron bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-orange-500">Notification Kit Integration</h3>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  Re-engage players with timely push notifications delivered directly to their devices via the OGS app, even when they aren't actively playing your game.
                </p>
              </div>
              <div className="max-w-3xl mx-auto space-y-6">
                <div className="bg-card p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Step 1: Install the Package</h4>
                  <CodeSnippet code={`npm install @open-game-system/notification-kit`} title="Terminal" />
                </div>
                
                <div className="bg-card p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Step 2: Initialize the Client</h4>
                  <CodeSnippet code={notificationKitCode} title="Server-side code" />
                </div>
                
                <div className="bg-card p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Step 3: Send Notifications</h4>
                  <CodeSnippet code={`// Backend route to send a notification\napp.post('/api/send-notification', async (req, res) => {\n  const { userId, title, message, data } = req.body;\n  \n  try {\n    const result = await notificationClient.sendNotification({\n      recipient: { gameUserId: userId },\n      notification: {\n        type: 'your_turn',\n        title: 'Your Turn',\n        body: "Player 2 has made their move. It's your turn now!",\n        data: data,\n        deepLink: \`https://yourgame.com/games/\${data.gameId}\`\n      }\n    });\n    \n    res.json({ id: result.id, status: result.status });\n  } catch (error) {\n    res.status(500).json({ error: error.message });\n  }\n});`} title="Notification sending implementation" />
                </div>
                
                <div className="mt-2">
                  <SDKVisual type="notification" />
                </div>
              </div>
            </div>

            {/* 4. Auth Kit */}
            <div id="auth-kit-integration">
              <div className="text-center mb-8 mt-16">
                <span className="text-4xl mb-4 inline-block">🔐</span>
                <h3 className="text-2xl font-bold mb-2 font-orbitron bg-clip-text text-transparent bg-gradient-to-r from-red-400 to-rose-500">Auth Kit Integration</h3>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  Securely link player accounts between your game and the OGS platform, enabling persistent identity and unlocking features like targeted notifications.
                </p>
              </div>
              <div className="max-w-3xl mx-auto space-y-6">
                <div className="bg-card p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Step 1: Install the Package</h4>
                  <CodeSnippet code={`npm install @open-game-system/auth-kit`} title="Terminal" />
                </div>
                
                <div className="bg-card p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Step 2: Initialize the Client</h4>
                  <CodeSnippet code={authKitCode} title="Server-side code" />
                </div>
                
                <div className="bg-card p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Step 3: Implement Account Linking</h4>
                  <CodeSnippet code={`// Backend route to generate link token\napp.post('/api/link-account', async (req, res) => {\n  // Get the user ID from the authenticated session\n  const gameUserId = req.session.userId;\n  \n  // Make sure the user is logged in\n  if (!gameUserId) {\n    return res.status(401).json({ error: 'User not authenticated' });\n  }\n  \n  try {\n    const linkData = await authClient.createLinkToken({\n      gameUserId,\n      redirectUrl: 'https://yourgame.com/auth/callback'\n    });\n    \n    res.json({ linkUrl: linkData.linkUrl });\n  } catch (error) {\n    res.status(500).json({ error: error.message });\n  }\n});\n\n// Frontend code to redirect user\nfunction linkAccount() {\n  fetch('/api/link-account', {\n    method: 'POST',\n    headers: { 'Content-Type': 'application/json' },\n    credentials: 'include' // Important: sends cookies/session info\n  })\n  .then(res => res.json())\n  .then(data => {\n    if (data.linkUrl) {\n      window.location.href = data.linkUrl;\n    }\n  })\n  .catch(error => {\n    console.error('Error initiating account linking:', error);\n  });\n}`} title="Account linking implementation" />
                </div>
                
                <div className="mt-2">
                  <SDKVisual type="auth" />
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-16 text-center">
            <p className="text-lg text-muted-foreground mb-6">Each kit can be used independently, so you can implement only the features your game needs.</p>
            <Button asChild className="bg-primary hover:bg-primary/90">
              <a href="https://github.com/open-game-system/specification" target="_blank" rel="noopener noreferrer">
                View Full API Reference <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Get Started Section */}
      <section id="get-started" className="section-padding bg-secondary/50">
        <div className="container mx-auto px-4">
          <SectionHeader 
            title="Get Started"
            subtitle="Build web games that leverage native features through the OGS app"
          />
          
          <div className="mt-12">
            <div className="bg-card p-6 rounded-xl border border-border max-w-4xl mx-auto">
              <h3 className="text-xl font-bold mb-6 text-center">How to Use OGS with Your Web Game</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                <div className="bg-primary/10 p-6 rounded-lg relative overflow-hidden group transition-all hover:shadow-lg">
                  <div className="absolute -top-10 -right-10 w-24 h-24 bg-primary/20 rounded-full"></div>
                  <div className="relative">
                    <div className="w-14 h-14 bg-primary/20 rounded-xl flex items-center justify-center mb-4">
                      <span className="text-xl font-bold text-primary">1</span>
                    </div>
                    <h4 className="text-lg font-bold mb-3">Read the Specification</h4>
                    <p className="text-muted-foreground text-sm mb-4">
                      Learn how the OGS app enables web games to access native features.
                    </p>
                    <Button asChild variant="outline" size="sm" className="w-full justify-start">
                      <a href="https://github.com/open-game-system/specification" target="_blank" rel="noopener noreferrer">
                        <ArrowRight className="mr-2 h-4 w-4" />
                        Read the Specification
                      </a>
                    </Button>
                  </div>
                </div>
                
                <div className="bg-primary/10 p-6 rounded-lg relative overflow-hidden group transition-all hover:shadow-lg">
                  <div className="absolute -top-10 -right-10 w-24 h-24 bg-primary/20 rounded-full"></div>
                  <div className="relative">
                    <div className="w-14 h-14 bg-primary/20 rounded-xl flex items-center justify-center mb-4">
                      <span className="text-xl font-bold text-primary">2</span>
                    </div>
                    <h4 className="text-lg font-bold mb-3">Study the Example</h4>
                    <p className="text-muted-foreground text-sm mb-4">
                      See Trivia Jam in action – our reference implementation with all OGS features.
                    </p>
                    <div className="space-y-2">
                      <Button asChild variant="outline" size="sm" className="w-full justify-start">
                        <a href="https://github.com/open-game-system/trivia-jam" target="_blank" rel="noopener noreferrer">
                          <Github className="mr-2 h-4 w-4" />
                          Source Code
                        </a>
                      </Button>
                      <Button asChild variant="outline" size="sm" className="w-full justify-start">
                        <a href="https://triviajam.tv" target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Try Live Demo
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
                
                <div className="bg-primary/10 p-6 rounded-lg relative overflow-hidden group transition-all hover:shadow-lg">
                  <div className="absolute -top-10 -right-10 w-24 h-24 bg-primary/20 rounded-full"></div>
                  <div className="relative">
                    <div className="w-14 h-14 bg-primary/20 rounded-xl flex items-center justify-center mb-4">
                      <span className="text-xl font-bold text-primary">3</span>
                    </div>
                    <h4 className="text-lg font-bold mb-3">Integrate the SDK</h4>
                    <p className="text-muted-foreground text-sm mb-4">
                      Add these powerful SDKs to your web game for native capabilities.
                    </p>
                    <div className="grid grid-cols-1 gap-2">
                      <Button asChild variant="outline" size="sm" className="justify-start">
                        <a href="https://github.com/open-game-system/auth-kit" target="_blank" rel="noopener noreferrer">
                          <User className="mr-2 h-4 w-4" />
                          auth-kit
                        </a>
                      </Button>
                      <Button asChild variant="outline" size="sm" className="justify-start">
                        <a href="https://github.com/open-game-system/notification-kit" target="_blank" rel="noopener noreferrer">
                          <Bell className="mr-2 h-4 w-4" />
                          notification-kit
                        </a>
                      </Button>
                      <Button asChild variant="outline" size="sm" className="justify-start">
                        <a href="https://github.com/open-game-system/cast-kit" target="_blank" rel="noopener noreferrer">
                          <Tv className="mr-2 h-4 w-4" />
                          cast-kit
                        </a>
                      </Button>
                       <Button asChild variant="outline" size="sm" className="justify-start">
                         {/* TODO: Update href when stream-kit repo exists */}
                        <a href="#stream-kit-integration" >
                          <Cloud className="mr-2 h-4 w-4" /> 
                          stream-kit
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-gray-100 to-primary/10 p-6 rounded-lg mt-10 border border-primary/20 shadow-lg">
                <h4 className="text-xl font-bold mb-8 text-center">How Your Web Game Loads in the OGS App</h4>
                
                <div className="flex flex-col gap-8">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-y-12 gap-x-8 text-center">
                    <div className="flex flex-col items-center justify-start">
                      <div className="flex items-center justify-center mb-5 w-full">
                        <div className="flex items-center justify-center mb-5 w-full">
                          <div className="bg-[#22303c]/80 border border-[#4a6baf] shadow-md inline-block transform transition-transform hover:scale-105 p-4 rounded-xl">
                            <span className="text-4xl mr-2">🎮</span>
                            <span className="text-white text-2xl mx-2">→</span>
                            <span className="text-4xl ml-2">📱</span>
                          </div>
                        </div>
                      </div>
                      <p className="text-base font-medium text-white mt-2">Your web game runs in the OGS app</p>
                    </div>
                    
                    <div className="flex flex-col items-center justify-start">
                      <div className="flex items-center justify-center mb-5 w-full">
                        <div className="bg-[#331b47]/80 border border-[#9333EA] shadow-md inline-block transform transition-transform hover:scale-105 p-4 rounded-xl">
                          <span className="text-4xl mr-2">📱</span>
                          <span className="text-white text-2xl mx-1">→</span>
                          <span className="text-4xl mx-1">🔔</span>
                          <span className="text-4xl mx-1">📺</span>
                          <span className="text-4xl ml-1">🔐</span>
                        </div>
                      </div>
                      <p className="text-base font-medium text-white mt-2">Access native features</p>
                    </div>
                    
                    <div className="flex flex-col items-center justify-start">
                      <div className="flex items-center justify-center mb-5 w-full">
                        <div className="bg-[#2d2d3f]/80 border border-[#777] shadow-md inline-block transform transition-transform hover:scale-105 p-4 rounded-xl">
                          <span className="text-4xl mr-2">🌐</span>
                          <span className="text-white text-2xl mx-2">→</span>
                          <span className="text-4xl ml-2">🎮</span>
                        </div>
                      </div>
                      <p className="text-base font-medium text-white mt-2">Still works in browsers</p>
                    </div>
                  </div>
                  
                  <div className="text-center mt-5 pt-6 border-t border-primary/20">
                    <p className="text-lg font-medium text-primary">Web-first games with native superpowers! <span className="text-2xl">✨</span></p>
                  </div>
                </div>
              </div>
              
              <div className="mt-10 text-center">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
                  <Button asChild className="bg-primary hover:bg-primary/90 shadow-lg px-6 py-6 h-auto">
                    <a href="https://github.com/open-game-system" target="_blank" rel="noopener noreferrer" className="flex items-center">
                      <Github className="mr-3 h-5 w-5" />
                      <span className="font-bold">GitHub Organization</span>
                    </a>
                  </Button>
                  <Button asChild variant="outline" className="shadow-lg px-6 py-6 h-auto">
                    <a href="#" target="_blank" rel="noopener noreferrer">
                      <span className="font-bold">Download OGS App</span>
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="section-padding bg-secondary/50">
        <div className="container mx-auto">
          <SectionHeader 
            title="Frequently Asked Questions"
            subtitle="Get answers to common questions about implementing OGS."
          />
          
          <div className="mt-12 max-w-3xl mx-auto">
            <FAQAccordion items={faqItems} />
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default Index;

