// src/entities/power-up.ts
import Phaser from "phaser";
import { GameScene } from "../../scenes/game-scene";
import { Player } from "../player/player";
import { GameState } from "../../utils/game-state";
import { EventBus } from "../../core/event-bus";

export enum PowerUpType {
    AttackSpeed = 'attack-speed',
    Damage = 'damage',
    Range = 'range',
    Health = 'health',
    Invincibility = 'invincibility',
    Resources = 'resources'
}

export class PowerUp extends Phaser.Physics.Arcade.Sprite {
    private powerUpType: PowerUpType;
    private duration: number; // in milliseconds
    private value: number;
    private eventBus: EventBus;
    private player: Player;
    private gameState: GameState;
    private static nextId: number = 0;
    private id: number;

    constructor(
        scene: GameScene,
        x: number,
        y: number,
        type: PowerUpType,
        eventBus: EventBus,
        player: Player,
        gameState: GameState
    ) {
        // Choose texture based on power-up type
        let texture = 'powerup-default';
        switch (type) {
            case PowerUpType.AttackSpeed: texture = 'powerup-speed'; break;
            case PowerUpType.Damage: texture = 'powerup-damage'; break;
            case PowerUpType.Range: texture = 'powerup-range'; break;
            case PowerUpType.Health: texture = 'powerup-health'; break;
            case PowerUpType.Invincibility: texture = 'powerup-invincibility'; break;
            case PowerUpType.Resources: texture = 'powerup-resources'; break;
        }

        super(scene, x, y, texture);

        this.powerUpType = type;
        this.id = PowerUp.nextId++;
        this.eventBus = eventBus;
        this.player = player;
        this.gameState = gameState;

        // Set duration and value based on type
        switch (type) {
            case PowerUpType.AttackSpeed:
                this.duration = 20000; // 20 seconds
                this.value = 2; // 2x attack speed
                break;
            case PowerUpType.Damage:
                this.duration = 15000; // 15 seconds
                this.value = 2; // 2x damage
                break;
            case PowerUpType.Range:
                this.duration = 30000; // 30 seconds
                this.value = 1.5; // 1.5x range
                break;
            case PowerUpType.Health:
                this.duration = 0; // instant
                this.value = 50; // +50 health
                break;
            case PowerUpType.Invincibility:
                this.duration = 10000; // 10 seconds
                this.value = 1; // just a flag
                break;
            case PowerUpType.Resources:
                this.duration = 0; // instant
                this.value = 100; // +100 resources
                break;
        }

        scene.add.existing(this);
        scene.physics.add.existing(this);

        // Floating animation
        scene.tweens.add({
            targets: this,
            y: y - 10,
            duration: 1000,
            yoyo: true,
            repeat: -1
        });

        // Pulsing effect
        scene.tweens.add({
            targets: this,
            scale: 1.2,
            duration: 800,
            yoyo: true,
            repeat: -1
        });

        // Make interactive
        this.setInteractive();
        this.on('pointerdown', this.onPickup, this);

        // Auto-destroy after a while
        scene.time.delayedCall(30000, () => {
            if (this.active) {
                this.destroy();
            }
        });
    }

    private onPickup() {
        if (!this.player) return;

        switch (this.powerUpType) {
            case PowerUpType.AttackSpeed:
                this.player.addTemporaryBuff('attackSpeed', this.value, this.duration);
                break;
            case PowerUpType.Damage:
                this.player.addTemporaryBuff('damage', this.value, this.duration);
                break;
            case PowerUpType.Range:
                this.player.addTemporaryBuff('range', this.value, this.duration);
                break;
            case PowerUpType.Health:
                this.player.heal(this.value);
                break;
            case PowerUpType.Invincibility:
                this.player.addTemporaryBuff('invincible', this.value, this.duration);
                break;
            case PowerUpType.Resources:
                if (this.gameState) {
                    this.gameState.earnResources(this.value);
                }
                break;
        }

        // Emit event
        this.eventBus.emit('powerup-collected', {
            type: this.powerUpType,
            value: this.value,
            duration: this.duration
        });

        // Visual feedback using simple particles
        const particles = this.scene.add.particles(this.x, this.y, 'projectile', {
            speed: 100,
            scale: { start: 1, end: 0 },
            blendMode: 'ADD',
            lifespan: 1000
        });

        // Auto-destroy the particles after animation completes
        this.scene.time.delayedCall(1000, () => {
            particles.destroy();
        });

        // Play sound
        // this.scene.sound.play('powerup-collect');

        // Destroy after pickup
        this.destroy();
    }

    public getPowerUpType(): PowerUpType {
        return this.powerUpType;
    }

    public getId(): number {
        return this.id;
    }
}