/**
 * Cast Kit - Basic Cast Button Example
 * 
 * This is a simple example of how to use Cast Kit in a React application.
 */

import React, { useEffect } from 'react';
import { createCastClient } from '../src/client';
import { CastKitContext, CastButton, CastStatus } from '../src/react';

// Example game data
const GAME_ID = 'trivia-game';
const ROOM_CODE = 'ABCD123';

// Create the cast client
const castClient = createCastClient({
  debug: true, // Enable debug logging
});

// Example component that demonstrates Cast Kit integration
export function ExampleApp() {
  // Initialize the client
  useEffect(() => {
    // Signal that the game is ready to cast
    // This is typically done when the game loads
    castClient.signalReady({
      gameId: GAME_ID,
      roomCode: ROOM_CODE,
    }).catch((error) => {
      console.error('Failed to initialize casting:', error);
    });
    
    // Return cleanup function
    return () => {
      // Stop casting when the component unmounts
      castClient.stopCasting().catch((error) => {
        console.error('Failed to stop casting:', error);
      });
    };
  }, []);
  
  // Generate the broadcast URL
  const getBroadcastUrl = () => {
    // This URL should point to your TV-optimized view
    const url = new URL('https://your-game-domain.com/tv');
    
    // Add game parameters
    url.searchParams.append('gameId', GAME_ID);
    url.searchParams.append('roomCode', ROOM_CODE);
    
    return url.toString();
  };
  
  return (
    <CastKitContext.Provider client={castClient}>
      <div className="example-app">
        <header>
          <h1>Trivia Game</h1>
        </header>
        
        <main>
          <div className="game-info">
            <p>Room Code: <strong>{ROOM_CODE}</strong></p>
          </div>
          
          <div className="cast-controls">
            {/* Cast status will show error messages and casting status */}
            <CastStatus />
            
            {/* Cast button will initiate casting when clicked */}
            <CastButton 
              label="Play on TV"
              gameUrl={getBroadcastUrl()}
              onCast={() => console.log('Started casting')}
              onEnd={() => console.log('Stopped casting')}
            />
          </div>
          
          {/* This section demonstrates conditional rendering based on cast state */}
          <CastKitContext.When casting={true}>
            <div className="controller-mode">
              <h2>Controller Mode</h2>
              <p>This UI is shown when casting to TV</p>
              
              <button className="game-button">Send Answer</button>
            </div>
          </CastKitContext.When>
          
          <CastKitContext.When casting={false}>
            <div className="full-game">
              <h2>Game Mode</h2>
              <p>This is the full game UI shown when not casting</p>
              
              <div className="game-board">
                {/* Your game UI here */}
                <p>Example game content</p>
              </div>
            </div>
          </CastKitContext.When>
        </main>
      </div>
    </CastKitContext.Provider>
  );
} 