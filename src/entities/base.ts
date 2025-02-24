import Phaser from "phaser";
import GameScene from "../scenes/game-scene";
import { HealthBar } from "../utils/health-bar";
import { GAME_SETTINGS } from "../settings"; // Import

export default class Base extends Phaser.Physics.Arcade.Sprite {
    private healthBar: HealthBar;
    private health: number = GAME_SETTINGS.base.initialHealth; // Use from settings
    private maxHealth: number = GAME_SETTINGS.base.initialHealth; // Use from settings

    constructor(scene: GameScene, x: number, y: number) {
        super(scene, x, y, "base");

        scene.add.existing(this);
        scene.physics.add.existing(this, true);

        // Set size, color, and position from settings
        this.setDisplaySize(GAME_SETTINGS.base.size.width, GAME_SETTINGS.base.size.height);
        this.setTint(GAME_SETTINGS.base.color);
        this.setPosition(GAME_SETTINGS.base.position.x, GAME_SETTINGS.base.position.y);

        // Create health bar
        this.healthBar = new HealthBar(scene, this, this.maxHealth);
    }

    takeDamage(damage: number) {
        if (!this.active) return;
        this.health -= damage;
        console.log(`Base took ${damage} damage. Health now: ${this.health}`);
        this.healthBar.updateHealth(this.health);
        if (this.health <= 0) {
            console.log("Base health <= 0, destroying base and calling gameOver");
            const gameScene = this.scene as GameScene;
            this.healthBar.cleanup();
            this.destroy();
            console.log("Base destroyed!");
            gameScene.gameOver();
        }
    }

    getHealth(): number {
        return this.health;
    }

    heal(amount: number) {
        this.health = Math.min(this.health + amount, this.maxHealth);
        this.healthBar.updateHealth(this.health);
    }
}