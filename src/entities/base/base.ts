import Phaser from "phaser";
import GameScene from "../../scenes/game-scene";
import { HealthComponent } from "../components/health-component";
import { EventBus } from "../../core/event-bus";

export default class Base extends Phaser.Physics.Arcade.Sprite {
    private healthComponent: HealthComponent;
    private eventBus: EventBus;

    constructor(scene: GameScene, x: number, y: number, eventBus: EventBus) {
        super(scene, x, y, 'base');
        
        this.eventBus = eventBus;
        
        scene.add.existing(this);
        scene.physics.add.existing(this, true); // true = static body
        
        this.setScale(0.75);
        
        // Initialize health component
        const initialHealth = 1000;
        this.healthComponent = new HealthComponent(
            this,
            scene,
            initialHealth,
            initialHealth,
            () => {
                this.onBaseDestroyed();
            }
        );
    }
    
    update() {
        this.healthComponent.update();
    }
    
    takeDamage(amount: number) {
        this.healthComponent.takeDamage(amount);
        
        // Visual feedback
        this.scene.tweens.add({
            targets: this,
            alpha: 0.6,
            duration: 100,
            yoyo: true
        });
        
        // Emit event
        this.eventBus.emit('base-damaged', {
            damage: amount,
            remainingHealth: this.healthComponent.getHealth(),
            maxHealth: this.healthComponent.getMaxHealth()
        });
    }
    
    heal(amount: number) {
        this.healthComponent.heal(amount);
        
        // Emit event
        this.eventBus.emit('base-healed', {
            amount: amount,
            newHealth: this.healthComponent.getHealth(),
            maxHealth: this.healthComponent.getMaxHealth()
        });
    }
    
    getHealth() {
        return this.healthComponent.getHealth();
    }
    
    getMaxHealth() {
        return this.healthComponent.getMaxHealth();
    }
    
    private onBaseDestroyed() {
        // Emit game over event
        this.eventBus.emit('game-over', {
            reason: 'base-destroyed'
        });
        
        // Visual destruction effect
        const particles = this.scene.add.particles(this.x, this.y, 'projectile', {
            speed: { min: 100, max: 200 },
            angle: { min: 0, max: 360 },
            scale: { start: 1, end: 0 },
            blendMode: 'ADD',
            lifespan: 1000,
            quantity: 50
        });
        
        this.scene.time.delayedCall(1000, () => {
            particles.destroy();
        });
        
        // Call game over in the scene
        (this.scene as GameScene).gameOver();
    }
}