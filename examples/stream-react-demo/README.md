# Stream Kit React Demo

A minimal React application demonstrating how to integrate cloud-rendered streams into a web application using the Stream Kit libraries.

## Overview

This demo showcases:
- Setting up the Stream Kit client in a React application
- Rendering WebRTC video streams with `StreamCanvas`
- Managing stream state and quality options
- Handling user interactions with streamed content

## Getting Started

### Prerequisites

- Node.js 16+
- npm or pnpm

### Installation

From the project root directory:

```bash
# Install dependencies
pnpm install

# Start the development server
pnpm --filter basic-react-demo dev
```

Visit http://localhost:5173 to see the demo in action.

## Key Features

- **Stream Provider Setup**: Demonstrates how to initialize and provide the Stream Kit client throughout your React application
- **Video Stream Component**: Shows how to embed the cloud-rendered stream using the `StreamCanvas` component
- **State Management**: Displays connection status, quality metrics, and error handling
- **Interaction Handling**: Example of sending user inputs to the streamed application

## How It Works

The demo connects to a Stream Kit server endpoint that hosts a rendered application. The video output is streamed to the client via WebRTC while user interactions are sent back to the server.

### Key Components

```jsx
// Initialize the client
const streamClient = createStreamClient({
  brokerUrl: 'api.example.com'
});

// Provide the client to your app
function App() {
  return (
    <StreamProvider client={streamClient}>
      <DemoContent />
    </StreamProvider>
  );
}

// Use the StreamCanvas component to display the stream
function DemoContent() {
  const [streamState, setStreamState] = useState({ status: 'initializing' });
  
  return (
    <div className="stream-container">
      <StreamCanvas
        url="https://demo.example.com/render-app"
        renderOptions={{
          resolution: '1080p',
          quality: 'high'
        }}
        onStateChange={setStreamState}
      />
      
      <div className="status-overlay">
        Connection status: {streamState.status}
      </div>
    </div>
  );
}
```

## Configuration

The demo can be configured by editing the following files:

- `src/App.tsx`: Main application component with Stream Kit integration
- `src/main.tsx`: Entry point that renders the App component
- `vite.config.ts`: Build and development server configuration

## Testing

The demo includes tests demonstrating how to test Stream Kit components:

```bash
# Run tests
pnpm --filter basic-react-demo test
```

## Using with the Bun Stream Server

This demo can be connected to the `bun-stream-server` example in this repo to create a full end-to-end streaming demo:

1. Start the Bun Stream Server:
   ```bash
   cd ../bun-stream-server/container
   docker build -t stream-server-test .
   docker run -p 8080:8080 --rm stream-server-test
   ```

2. Configure the React demo to connect to this server by setting the appropriate broker URL in `App.tsx`. You don't need to configure a custom PeerJS server as the extension uses the default PeerJS server automatically.

3. Start the React app with `pnpm dev`

The WebRTC connection will be established through the default PeerJS server, so no additional configuration is needed for signaling or peer discovery.

## Customization

To adapt this demo for your own projects:

1. Update the broker URL to point to your Stream Kit server
2. Modify the stream URL to target your own cloud-rendered application
3. Adjust render options based on your performance requirements
4. Implement custom interaction handlers specific to your application

## Related Resources

- [Stream Kit Documentation](../../README.md)
- [React Component API](../../packages/stream-kit-react/README.md)
- [Client Library API](../../packages/stream-kit-web/README.md)

## License

MIT License 