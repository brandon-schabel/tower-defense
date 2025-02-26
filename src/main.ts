import './style.css';
import Phaser from 'phaser';
import GameScene from "./scenes/game-scene";
import MainMenuScene from "./scenes/main-menu-scene";
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

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: gameSize.width,
  height: gameSize.height,
  parent: "game-container",
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false
    },
  },
  scene: [MainMenuScene, GameScene],
  backgroundColor: '#242424',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};


// Initialize game
const game = new Phaser.Game(config);

// Initialize UI
document.addEventListener('DOMContentLoaded', () => {
  const toolbar = document.getElementById('ui-toolbar');

  // Show toolbar when game scene starts
  game.events.on('start-game', () => {
    toolbar?.classList.remove('hidden');
  });

  // Hide toolbar when returning to menu
  game.events.on('return-to-menu', () => {
    toolbar?.classList.add('hidden');
  });
});