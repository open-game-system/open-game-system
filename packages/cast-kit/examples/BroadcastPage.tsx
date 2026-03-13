/**
 * Cast Kit - Broadcast Page Example
 * 
 * This is an example of a broadcast page that would be displayed on the TV.
 */

import React, { useEffect, useState } from 'react';
import { getGameParams } from '../src/receiver';

interface GameState {
  gameId: string;
  roomCode: string;
  players: string[];
  currentRound: number;
  question?: string;
  answers?: string[];
  scores?: Record<string, number>;
}

export function BroadcastPage() {
  // Get game parameters from URL
  const params = getGameParams();
  
  // State for game data
  const [gameState, setGameState] = useState<GameState>({
    gameId: params.gameId || '',
    roomCode: params.roomCode || '',
    players: [],
    currentRound: 0
  });
  
  // In a real implementation, you would connect to your game state management system
  // This is a simple example that just updates the state every few seconds
  useEffect(() => {
    // Example function to simulate receiving game state updates
    const simulateGameUpdates = () => {
      // Simulate players joining
      setTimeout(() => {
        setGameState(prev => ({
          ...prev,
          players: ['Player 1', 'Player 2', 'Player 3']
        }));
      }, 2000);
      
      // Simulate starting the game
      setTimeout(() => {
        setGameState(prev => ({
          ...prev,
          currentRound: 1,
          question: 'What is the capital of France?',
          answers: ['Paris', 'London', 'Berlin', 'Madrid']
        }));
      }, 5000);
      
      // Simulate updating scores
      setTimeout(() => {
        setGameState(prev => ({
          ...prev,
          scores: {
            'Player 1': 10,
            'Player 2': 5,
            'Player 3': 15
          }
        }));
      }, 8000);
    };
    
    // Start the simulation
    simulateGameUpdates();
    
    // No cleanup needed for this example
  }, []);
  
  return (
    <div className="broadcast-page">
      <header className="tv-header">
        <h1>Trivia Game</h1>
        <div className="room-info">Room: {gameState.roomCode}</div>
      </header>
      
      <main className="tv-main">
        {gameState.currentRound === 0 ? (
          // Waiting for game to start
          <div className="tv-lobby">
            <h2>Waiting for players to join...</h2>
            
            <div className="tv-players">
              <h3>Players:</h3>
              {gameState.players.length === 0 ? (
                <p>No players yet</p>
              ) : (
                <ul>
                  {gameState.players.map((player, index) => (
                    <li key={index}>{player}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          // Game in progress
          <div className="tv-game">
            <div className="tv-round">
              <h2>Round {gameState.currentRound}</h2>
            </div>
            
            <div className="tv-question">
              <h3>{gameState.question}</h3>
              
              {gameState.answers && (
                <div className="tv-answers">
                  {gameState.answers.map((answer, index) => (
                    <div key={index} className="tv-answer">
                      {answer}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {gameState.scores && (
              <div className="tv-scores">
                <h3>Scores</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(gameState.scores).map(([player, score]) => (
                      <tr key={player}>
                        <td>{player}</td>
                        <td>{score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
      
      <footer className="tv-footer">
        <p>Cast using Open Game App</p>
      </footer>
    </div>
  );
} 