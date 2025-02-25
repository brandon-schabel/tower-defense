import Phaser from "phaser";
import GameScene from "../scenes/game-scene";
import { HealthComponent } from "../utils/health-component"; // Import HealthComponent
import { GAME_SETTINGS } from "../settings"; // Import

export default class Base extends Phaser.Physics.Arcade.Sprite {
    private healthComponent: HealthComponent; // Replace healthBar and health properties

    constructor(scene: GameScene, x: number, y: number) {
        super(scene, x, y, "base");

        scene.add.existing(this);
        scene.physics.add.existing(this, true);

        // Set size, color, and position from settings
        this.setDisplaySize(GAME_SETTINGS.base.size.width, GAME_SETTINGS.base.size.height);
        this.setTint(GAME_SETTINGS.base.color);
        this.setPosition(GAME_SETTINGS.base.position.x, GAME_SETTINGS.base.position.y);

        // Initialize health component with base settings
        this.healthComponent = new HealthComponent(
            this,
            scene,
            GAME_SETTINGS.base.initialHealth,
            GAME_SETTINGS.base.initialHealth,
            () => {
                console.log("Base destroyed!");
                this.destroy();
                (this.scene as GameScene).gameOver();
            }
        );
    }

    takeDamage(damage: number) {
        if (!this.active) return;
        console.log(`Base took ${damage} damage. Health now: ${this.healthComponent.getHealth() - damage}`);
        this.healthComponent.takeDamage(damage);
    }

    getHealth(): number {
        return this.healthComponent.getHealth();
    }

    heal(amount: number) {
        this.healthComponent.heal(amount);
    }

    // Override destroy to ensure cleanup
    destroy(fromScene?: boolean) {
        this.healthComponent.cleanup();
        super.destroy(fromScene);
    }

    // Call in the scene's update method
    update() {
        this.healthComponent.update();
    }
}