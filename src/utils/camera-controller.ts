// src/utils/camera-controller.ts
import Phaser from "phaser";
import GameScene from "../scenes/game-scene";

export default class CameraController {
    private scene: GameScene;
    private player: Phaser.Physics.Arcade.Sprite;
    private camera: Phaser.Cameras.Scene2D.Camera;
    private lastPlayerX: number;
    private lastPlayerY: number;

    private zoomLevel: number = 1;
    private minZoom: number = 0.5;
    private maxZoom: number = 2;
    private zoomSpeed: number = 0.1;

    constructor(scene: GameScene, player: Phaser.Physics.Arcade.Sprite) {
        this.scene = scene;
        this.player = player;
        this.camera = scene.cameras.main;
        this.lastPlayerX = player.x;
        this.lastPlayerY = player.y;

        this.setupCameraControls();
    }

    private setupCameraControls() {
        // Set up camera to follow player
        this.camera.startFollow(this.player, true, 0.08, 0.08);

        // Add zoom controls
        this.scene.input.on('wheel', (pointer: Phaser.Input.Pointer, gameObjects: any, deltaX: number, deltaY: number) => {
            if (deltaY > 0) {
                this.zoomOut();
            } else {
                this.zoomIn();
            }
        });

        // Add keyboard zoom controls
        if (this.scene.input.keyboard) {
            const keys = this.scene.input.keyboard.addKeys({
                zoomIn: Phaser.Input.Keyboard.KeyCodes.PLUS,
                zoomOut: Phaser.Input.Keyboard.KeyCodes.MINUS
            }) as { zoomIn: Phaser.Input.Keyboard.Key; zoomOut: Phaser.Input.Keyboard.Key };

            keys.zoomIn.on('down', () => this.zoomIn());
            keys.zoomOut.on('down', () => this.zoomOut());
        }
    }

    private zoomIn() {
        this.zoomLevel = Math.min(this.maxZoom, this.zoomLevel + this.zoomSpeed);
        this.camera.setZoom(this.zoomLevel);
    }

    private zoomOut() {
        this.zoomLevel = Math.max(this.minZoom, this.zoomLevel - this.zoomSpeed);
        this.camera.setZoom(this.zoomLevel);
    }

    update() {
        // Track player movement
        const dx = this.player.x - this.lastPlayerX;
        const dy = this.player.y - this.lastPlayerY;

        // Store current position for next frame
        this.lastPlayerX = this.player.x;
        this.lastPlayerY = this.player.y;
    }
}