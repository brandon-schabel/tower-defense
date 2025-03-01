import Phaser from "phaser";
import { GameScene } from "../scenes/game-scene";

export class CameraController {
    private scene: GameScene;
    private player: Phaser.Physics.Arcade.Sprite;
    private camera: Phaser.Cameras.Scene2D.Camera;
    private lastPlayerX: number;
    private lastPlayerY: number;
    private isDragging: boolean = false;
    private dragStartX: number = 0;
    private dragStartY: number = 0;

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
        this.scene.input.on('wheel', (_: Phaser.Input.Pointer, __: any, ___: number, deltaY: number) => {
            if (deltaY > 0) {
                this.zoomOut();
            } else {
                this.zoomIn();
            }
        });

        // Add middle mouse button dragging
        this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (pointer.middleButtonDown()) {
                this.isDragging = true;
                this.dragStartX = pointer.x;
                this.dragStartY = pointer.y;
                this.camera.stopFollow();
            }
        });

        this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (this.isDragging) {
                const deltaX = this.dragStartX - pointer.x;
                const deltaY = this.dragStartY - pointer.y;

                this.camera.scrollX += deltaX / this.camera.zoom;
                this.camera.scrollY += deltaY / this.camera.zoom;

                this.dragStartX = pointer.x;
                this.dragStartY = pointer.y;
            }
        });

        this.scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
            if (pointer.middleButtonReleased()) {
                this.isDragging = false;
            }
        });

        // Key to toggle camera follow
        this.scene.input.keyboard?.addKey('F').on('down', () => {
            if (this.isCameraFollowingPlayer()) {
                this.camera.stopFollow();
            } else {
                this.camera.startFollow(this.player, true, 0.08, 0.08);
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

    private isCameraFollowingPlayer(): boolean {
        // Check if the camera's current target is the player
        return this.camera.hasOwnProperty('_follow') && (this.camera as any)._follow === this.player;
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
        // Only track player movement if we're following them
        if (this.isCameraFollowingPlayer()) {
            // Store current position for next frame
            this.lastPlayerX = this.player.x;
            this.lastPlayerY = this.player.y;
        }
    }
}