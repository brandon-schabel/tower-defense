import Phaser from "phaser";

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: "MainMenuScene" });
    console.log("[MainMenuScene] Constructor called");
  }

  preload() {
    console.log("[MainMenuScene] Preload started");
    // Preload basic UI assets
    this.load.image('button', 'assets/ui/button.svg');
  }

  create() {
    console.log("[MainMenuScene] Create started");

    // Set background
    this.cameras.main.setBackgroundColor('#424242');

    this.add
      .text(400, 200, "Tower Defense", {
        fontSize: "32px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    // Create buttons with proper styling
    const buttonStyle = { 
      fontSize: "24px", 
      color: "#ffffff",
      backgroundColor: "#666666",
      padding: {
        left: 20,
        right: 20,
        top: 10,
        bottom: 10
      }
    };

    const startNewGameButton = this.add
      .text(400, 300, "Start New Game", buttonStyle)
      .setOrigin(0.5)
      .setInteractive();

    const loadGameButton = this.add
      .text(400, 350, "Load Game", buttonStyle)
      .setOrigin(0.5)
      .setInteractive();

    // Add hover effects
    startNewGameButton.on("pointerover", () => {
      startNewGameButton.setStyle({ backgroundColor: "#888888" });
    });
    startNewGameButton.on("pointerout", () => {
      startNewGameButton.setStyle({ backgroundColor: "#666666" });
    });

    loadGameButton.on("pointerover", () => {
      loadGameButton.setStyle({ backgroundColor: "#888888" });
    });
    loadGameButton.on("pointerout", () => {
      loadGameButton.setStyle({ backgroundColor: "#666666" });
    });

    // Handle button clicks
    startNewGameButton.on("pointerdown", () => {
      console.log("[MainMenuScene] Starting new game");
      this.game.events.emit('start-game');
      this.scene.start("GameScene", { isNewGame: true });
    });

    loadGameButton.on("pointerdown", () => {
      console.log("[MainMenuScene] Loading game");
      this.game.events.emit('start-game');
      this.scene.start("GameScene", { isNewGame: false });
    });
  }
}