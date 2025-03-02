import './style.css';
import Phaser from 'phaser';
import { GameConfig, DEFAULT_WIDTH, DEFAULT_HEIGHT, MIN_WIDTH, MIN_HEIGHT } from './config/game-config';
import { GameScene } from './scenes/game-scene';
import { UIScene } from './scenes/ui-scene';
import { GameOverScene } from './scenes/game-over-scene';
import { PreloadScene } from './scenes/preload-scene';
import { MenuScene } from './scenes/menu-scene';

/**
 * Main entry point for the Tower Defense game
 * Initializes the Phaser game instance with all scenes and configuration
 * 
 * Most Recent Changes:
 * - Fixed GameConfig import from game-config.ts
 * - Removed imports for scenes that don't exist yet
 * - Fixed SceneManager method calls
 * - Removed unused variable warnings
 */

// Add debug logging
console.log("[main.ts] Starting game initialization");

// Function to calculate the game size based on the window size
function getGameSize(): { width: number; height: number } {
  const width = Math.max(window.innerWidth, MIN_WIDTH);
  const height = Math.max(window.innerHeight, MIN_HEIGHT);
  
  return {
    width,
    height
  };
}

// Create the game container if it doesn't exist
const container = document.getElementById('game-container') || (() => {
  const container = document.createElement('div');
  container.id = 'game-container';
  document.body.appendChild(container);
  return container;
})();

// Get the initial game size
const gameSize = getGameSize();
console.log(`[main.ts] Game size: ${gameSize.width}x${gameSize.height}`);

/**
 * Initialize the game with all scenes and configuration
 */
window.addEventListener('load', () => {
  // Create Phaser game instance with config
  const config = {
    type: Phaser.AUTO,
    width: GameConfig.width,
    height: GameConfig.height,
    backgroundColor: GameConfig.backgroundColor,
    pixelArt: GameConfig.pixelArt,
    physics: GameConfig.physics,
    scene: [
      // Include only scenes that are implemented
      PreloadScene,
      MenuScene,
      GameScene,
      UIScene,
      GameOverScene
    ],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    }
  };

  // Create and start the game
  const game = new Phaser.Game(config);
  
  // Add game to window for debugging (remove in production)
  (window as any).game = game;
  
  // Handle window resize events to maintain aspect ratio
  window.addEventListener('resize', () => {
    game.scale.refresh();
  });
  
  // Setup any global event listeners
  window.addEventListener('blur', () => {
    // Auto-pause game when window loses focus
    if (game.scene.isActive('game')) {
      game.scene.pause('game');
      // Show a message instead of trying to start a scene that doesn't exist
      console.log('Game paused due to loss of focus');
      // We can add a pause UI overlay here once the PauseScene is implemented
    }
  });
});

// Add global error handler to catch initialization errors
window.addEventListener('error', (e) => {
  console.error('Global error:', e.message);
});