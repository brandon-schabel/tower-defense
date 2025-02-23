import './style.css';
import Phaser from 'phaser';
import GameScene from "./scenes/game-scene";
import MainMenuScene from "./scenes/main-menu-scene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
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