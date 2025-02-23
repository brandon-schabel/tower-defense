import Phaser from "phaser";

export default class MainMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: "MainMenuScene" });
  }

  create() {
    this.add
      .text(400, 200, "Tower Defense", {
        fontSize: "32px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    const startNewGameButton = this.add
      .text(400, 300, "Start New Game", {
        fontSize: "24px",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setInteractive();

    const loadGameButton = this.add
      .text(400, 350, "Load Game", {
        fontSize: "24px",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setInteractive();

    startNewGameButton.on("pointerdown", () => {
      this.scene.start("GameScene", { isNewGame: true });
    });

    loadGameButton.on("pointerdown", () => {
      this.scene.start("GameScene", { isNewGame: false });
    });
  }
}