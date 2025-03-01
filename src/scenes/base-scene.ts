// src/scenes/base-scene.ts
import Phaser from "phaser";
import { GAME_SETTINGS } from "../settings";

export abstract class BaseScene extends Phaser.Scene {
    protected setupPhysics(): void {
        this.physics.world.setBounds(
            0,
            0,
            GAME_SETTINGS.map.width * GAME_SETTINGS.map.tileSize,
            GAME_SETTINGS.map.height * GAME_SETTINGS.map.tileSize
        );
        this.physics.world.setBoundsCollision(true, true, true, true);
    }

    protected setupCamera(): void {
        this.cameras.main.setBackgroundColor(0x333333);
    }
}