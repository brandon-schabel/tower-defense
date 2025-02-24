import MainMenuScene from "../src/scenes/main-menu-scene";
import Phaser from "phaser";

describe("MainMenuScene", () => {
  let scene: MainMenuScene;

  beforeEach(() => {
    // Create a mock game instance to avoid errors related to the game not being initialized.
    if (!Phaser.Game.instance) {
      new Phaser.Game({
        type: Phaser.HEADLESS, // Use HEADLESS mode to avoid rendering
        scene: [MainMenuScene],
      });
    }
    scene = new MainMenuScene();
    // Manually call the create method since the scene isn't added to the game.
    scene.create();
  });

  it("should display the title", () => {
    const title = scene.children.getByName("title") as Phaser.GameObjects.Text;
    expect(title).toBeDefined();
    expect(title.text).toBe("Tower Defense");
  });

  it("should have a start new game button", () => {
    const startButton = scene.children.getByName(
      "startNewGameButton",
    ) as Phaser.GameObjects.Text;
    expect(startButton).toBeDefined();
    expect(startButton.text).toBe("Start New Game");
    expect(startButton.input).toBeDefined();
    expect(startButton.input.enabled).toBe(true);
  });

  it("should have a load game button", () => {
    const loadButton = scene.children.getByName(
      "loadGameButton",
    ) as Phaser.GameObjects.Text;
    expect(loadButton).toBeDefined();
    expect(loadButton.text).toBe("Load Game");
    expect(loadButton.input).toBeDefined();
    expect(loadButton.input.enabled).toBe(true);
  });

  it("should start a new game when start new game button is clicked", () => {
    const startButton = scene.children.getByName(
      "startNewGameButton",
    ) as Phaser.GameObjects.Text;
    const sceneStartSpy = jest.spyOn(scene.scene, "start");

    startButton.emit("pointerdown");

    expect(sceneStartSpy).toHaveBeenCalledWith("GameScene", { isNewGame: true });
  });

  it("should load a game when load game button is clicked", () => {
    const loadButton = scene.children.getByName(
      "loadGameButton",
    ) as Phaser.GameObjects.Text;
    const sceneStartSpy = jest.spyOn(scene.scene, "start");

    loadButton.emit("pointerdown");

    expect(sceneStartSpy).toHaveBeenCalledWith("GameScene", { isNewGame: false });
  });
}); 