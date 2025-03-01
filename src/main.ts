import './style.css';
import Phaser from 'phaser';
import { GameScene } from "./scenes/game-scene";
import { MainMenuScene } from "./scenes/main-menu-scene";

// Add debug logging
console.log("[main.ts] Starting game initialization");

function getGameSize() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  // Subtract some pixels for margins and UI elements
  return {
    width: Math.max(1920, width - 40),
    height: Math.max(1080, height - 100)
  };
}

// Get initial size
const gameSize = getGameSize();
console.log(`[main.ts] Game size: ${gameSize.width}x${gameSize.height}`);

// Check if container exists
const containerElement = document.getElementById("game-container");
if (!containerElement) {
  console.error("[main.ts] Game container element not found! Creating one...");
  const newContainer = document.createElement("div");
  newContainer.id = "game-container";
  document.body.appendChild(newContainer);
  console.log("[main.ts] Created new game container element");
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: gameSize.width,
  height: gameSize.height,
  parent: "game-container",
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: true // Enable physics debugging to see entity boundaries
    },
  },
  scene: [MainMenuScene, GameScene],
  backgroundColor: '#242424',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

// Log when we're about to create the game
console.log("[main.ts] Creating Phaser game instance with config:", config);

// Initialize game
const game = new Phaser.Game(config);

// Log game creation result
console.log("[main.ts] Phaser game created:", game);

// Initialize UI
document.addEventListener('DOMContentLoaded', () => {
  console.log("[main.ts] DOM loaded, setting up UI");
  const toolbar = document.getElementById('ui-toolbar');
  
  if (!toolbar) {
    console.warn("[main.ts] UI toolbar element not found!");
  }

  // Show toolbar when game scene starts
  game.events.on('start-game', () => {
    console.log("[main.ts] Game started event received");
    toolbar?.classList.remove('hidden');
  });

  // Hide toolbar when returning to menu
  game.events.on('return-to-menu', () => {
    console.log("[main.ts] Return to menu event received");
    toolbar?.classList.add('hidden');
  });
});

// Add global error handler to catch initialization errors
window.addEventListener('error', (event) => {
  console.error("[main.ts] Global error:", event.error);
});