import Phaser from "phaser";
import GameScene from "../scenes/game-scene";
import { HealthComponent } from "../utils/health-component";
import { gameConfig } from "../utils/app-config";
import { GAME_SETTINGS } from "../settings";
import ServiceLocator from "../utils/service-locator";
import { EventBus } from "../utils/event-bus";

export default class Base extends Phaser.Physics.Arcade.Sprite {
    private healthComponent: HealthComponent;
    private eventBus: EventBus;

    constructor(scene: GameScene, x: number, y: number) {
        super(scene, x, y, "base");

        scene.add.existing(this);
        scene.physics.add.existing(this, true);

        // Get config with fallback to GAME_SETTINGS
        const config = gameConfig.getConfig("base") || GAME_SETTINGS.base;
        
        this.setDisplaySize(config.size.width, config.size.height);
        this.setTint(config.color);
        this.setPosition(x, y);

        // Get event bus from service locator
        this.eventBus = ServiceLocator.getInstance().get<EventBus>('eventBus')!;

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
        
        // Register with service locator
        ServiceLocator.getInstance().register('base', this);
    }

    takeDamage(damage: number) {
        if (!this.active) return;
        console.log(`Base took ${damage} damage. Health now: ${this.healthComponent.getHealth() - damage}`);
        this.healthComponent.takeDamage(damage);
        
        // Emit damage event
        this.eventBus.emit('base-damaged', {
            damage: damage,
            remainingHealth: this.healthComponent.getHealth()
        });
    }

    getHealth(): number {
        return this.healthComponent.getHealth();
    }

    heal(amount: number) {
        this.healthComponent.heal(amount);
        
        // Emit heal event
        this.eventBus.emit('base-healed', {
            amount: amount,
            newHealth: this.healthComponent.getHealth()
        });
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