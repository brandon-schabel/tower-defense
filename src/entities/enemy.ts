// src/entities/enemy.ts
import Phaser from "phaser";
import GameScene from "../scenes/game-scene";

export default class Enemy extends Phaser.Physics.Arcade.Sprite {
    private health: number;
    private maxHealth: number;
    private healthBar: Phaser.GameObjects.Graphics;

    constructor(scene: GameScene, x: number, y: number, health: number, speed: number) {
        super(scene, x, y, "enemy");
        this.health = health;
        this.maxHealth = health;
        this.setScale(0.5);

        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.healthBar = scene.add.graphics();
        this.healthBar.setDepth(100);
        this.updateHealthBar();

        this.setData("speed", speed);
    }

    takeDamage(amount: number) {
        this.health -= amount;
        this.updateHealthBar();
        if (this.health <= 0) {
            this.destroy();
        }
    }

    private updateHealthBar() {
        this.healthBar.clear();
        this.healthBar.fillStyle(0xff0000);
        this.healthBar.fillRect(this.x - 15, this.y - 20, 30, 3);
        this.healthBar.fillStyle(0x00ff00);
        this.healthBar.fillRect(this.x - 15, this.y - 20, (this.health / this.maxHealth) * 30, 3);
    }

    update() {
        this.updateHealthBar(); // Update position with enemy movement
    }
}