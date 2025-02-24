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
            this.destroy();
            this.onDeath();
        }
    }

    update() {
        this.healthBar.updateHealth(this.health);
    }
}