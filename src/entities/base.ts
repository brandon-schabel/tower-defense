import Phaser from "phaser";
import GameScene from "../scenes/game-scene";

export default class Base extends Phaser.Physics.Arcade.Sprite {
    private health: number = 100;
    private maxHealth: number = 100;
    private healthBar: Phaser.GameObjects.Graphics;

    constructor(scene: GameScene, x: number, y: number) {
        super(scene, x, y, "base");
        scene.add.existing(this);
        scene.physics.add.existing(this, true); // true = static body
        
        // Create health bar
        this.healthBar = scene.add.graphics();
        this.updateHealthBar();
    }

    takeDamage(amount: number) {
        this.health = Math.max(0, this.health - amount);
        this.updateHealthBar();
        
        if (this.health <= 0) {
            (this.scene as GameScene).scene.start("MainMenuScene");
        }
    }

    getHealth(): number {
        return this.health;
    }

    heal(amount: number) {
        this.health = Math.min(this.health + amount, this.maxHealth);
        this.updateHealthBar();
    }

    private updateHealthBar() {
        this.healthBar.clear();

        // Background of health bar
        this.healthBar.fillStyle(0xff0000);
        this.healthBar.fillRect(this.x - 25, this.y - 40, 50, 5);

        // Health remaining
        this.healthBar.fillStyle(0x00ff00);
        this.healthBar.fillRect(
            this.x - 25,
            this.y - 40,
            Math.max(0, (this.health / this.maxHealth) * 50),
            5
        );
    }
}