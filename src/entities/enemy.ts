import Phaser from "phaser";
import GameScene from "../scenes/game-scene";
import { HealthBar } from "../utils/health-bar";

export default class Enemy extends Phaser.Physics.Arcade.Sprite {
    private health: number;
    private maxHealth: number;
    private healthBar: HealthBar;
    private onDeath: () => void;
    private static nextId = 0;
    public id: number;
    private isBurning: boolean = false;
    private burnDamage: number = 0;
    private burnTimer: Phaser.Time.TimerEvent | null = null;
    private isSlowed: boolean = false;
    private slowTimer: Phaser.Time.TimerEvent | null = null;

    constructor(scene: GameScene, x: number, y: number, health: number, speed: number, onDeath: () => void) {
        super(scene, x, y, "enemy");
        this.health = health;
        this.maxHealth = health;
        this.setScale(0.5);
        this.onDeath = onDeath;

        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.healthBar = new HealthBar(scene, this, this.maxHealth);

        this.setData("speed", speed);
        this.setData("lastDamageTime", 0);

        this.id = Enemy.nextId++;
    }

    takeDamage(amount: number) {
        this.health -= amount;
        this.healthBar.updateHealth(this.health);
        if (this.health <= 0) {
            this.healthBar.cleanup();
            // Clear any existing status effect timers
            if (this.burnTimer) this.burnTimer.remove();
            if (this.slowTimer) this.slowTimer.remove();
            this.destroy();
            this.onDeath();
        }
    }

    applyBurnEffect(burnDamage: number) {
        if (!this.isBurning) { // Only apply if not already burning
            this.isBurning = true;
            this.burnDamage = burnDamage;
            const burnInterval = 1000; // Apply damage every second
            const burnDuration = 5000; // Burn for 5 seconds
            let ticks = 0;

            this.burnTimer = this.scene.time.addEvent({
                delay: burnInterval,
                callback: () => {
                    if (ticks < burnDuration / burnInterval) {
                        this.takeDamage(this.burnDamage); // Apply burn damage
                        ticks++;
                    } else {
                        this.isBurning = false;
                        if (this.burnTimer) this.burnTimer.remove(); // Clean up timer
                    }
                },
                loop: true // Keep applying damage until duration is reached
            });
        }
    }

    applySlowEffect(slowFactor: number, duration: number) {
        if (!this.isSlowed) { // Only apply if not already slowed
            this.isSlowed = true;
            this.setData("slowFactor", slowFactor); // Store slow factor
            this.slowTimer = this.scene.time.delayedCall(duration, () => {
                this.isSlowed = false;
                this.setData("slowFactor", 1); // Reset slow factor
            });
        }
    }

    update() {
        this.healthBar.updateHealth(this.health);
    }
}