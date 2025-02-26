import Phaser from "phaser";
import GameScene from "../scenes/game-scene";
import { HealthComponent } from "../utils/health-component";
import { gameConfig } from "../utils/app-config";
import { GAME_SETTINGS } from "../settings";

export default class Base extends Phaser.Physics.Arcade.Sprite {
    private healthComponent: HealthComponent;

    constructor(scene: GameScene, x: number, y: number) {
        super(scene, x, y, "base");

        scene.add.existing(this);
        scene.physics.add.existing(this, true);

        // Get config with fallback to GAME_SETTINGS
        const config = gameConfig.getConfig("base") || GAME_SETTINGS.base;
        
        this.setDisplaySize(config.size.width, config.size.height);
        this.setTint(config.color);
        this.setPosition(x, y);

        // Initialize health component
        this.healthComponent = new HealthComponent(
            this,
            scene,
            config.initialHealth,
            config.initialHealth,
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