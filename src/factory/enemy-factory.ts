// src/factories/enemy-factory.ts
import Phaser from "phaser";
import GameScene from "../scenes/game-scene";
import Enemy from "../entities/enemy";
import { EnemyType } from "../types/enemy-type";
import { GAME_SETTINGS } from "../settings";
import { DIFFICULTY_SETTINGS } from "../settings";

/**
 * Factory class responsible for creating enemy instances
 */
export default class EnemyFactory {
    private scene: GameScene;
    
    constructor(scene: GameScene) {
        this.scene = scene;
    }
    
    /**
     * Create an enemy based on type and modifiers
     * @param type The type of enemy to create
     * @param x The X position to spawn the enemy
     * @param y The Y position to spawn the enemy
     * @param healthMultiplier Multiplier for enemy health
     * @param speedMultiplier Multiplier for enemy speed
     * @returns The created enemy instance
     */
    public createEnemy(
        type: EnemyType,
        x: number,
        y: number,
        healthMultiplier: number = 1.0,
        speedMultiplier: number = 1.0
    ): Enemy {
        // Get base stats from settings
        const baseHealth = GAME_SETTINGS.enemies.baseHealth;
        const baseSpeed = GAME_SETTINGS.enemies.speed;
        const baseDamage = GAME_SETTINGS.enemies.damageToPlayer;

        // Default values
        let health = baseHealth;
        let speed = baseSpeed;
        let damage = baseDamage;
        let texture = 'enemy';
        let scale = 1.0;
        let dropChance = 0.1;
        let experienceValue = 10;
        
        // Customize based on enemy type
        switch (type) {
            case EnemyType.Normal:
                // Normal enemy uses base stats
                break;
                
            case EnemyType.Fast:
                health = baseHealth * 0.7;
                speed = baseSpeed * 1.5;
                scale = 0.8;
                dropChance = 0.15;
                experienceValue = 15;
                texture = 'enemy-fast';
                break;
                
            case EnemyType.Heavy:
                health = baseHealth * 2;
                speed = baseSpeed * 0.7;
                damage = baseDamage * 1.5;
                scale = 1.3;
                dropChance = 0.2;
                experienceValue = 20;
                texture = 'enemy-heavy';
                break;
                
            case EnemyType.Boss:
                health = baseHealth * 5;
                speed = baseSpeed * 0.6;
                damage = baseDamage * 3;
                scale = 2.0;
                dropChance = 0.8;
                experienceValue = 50;
                texture = 'enemy-boss';
                break;
                
            case EnemyType.Flying:
                health = baseHealth * 0.8;
                speed = baseSpeed * 1.2;
                scale = 0.9;
                dropChance = 0.25;
                experienceValue = 25;
                texture = 'enemy-flying';
                break;
        }
        
        // Apply multipliers
        health *= healthMultiplier;
        speed *= speedMultiplier;
        
        // First create the enemy
        const enemy = new Enemy(
            this.scene,
            x,
            y,
            health,
            speed,
            () => {} // Empty callback for now
        );
        
        // Now update the onDeath reference safely
        const onDeathFn = () => {
            // Handle enemy death
            // Drop loot based on dropChance
            if (Math.random() < dropChance) {
                this.scene.getItemDropManager().dropRandomItem(enemy.x, enemy.y);
            }
        };
        enemy.setOnDeath(onDeathFn);
        
        // Set texture if different from default
        if (texture !== 'enemy') {
            enemy.setTexture(texture);
        }
        
        // Set additional properties
        enemy.setData('damage', damage);
        enemy.setData('experienceValue', experienceValue);
        
        // Set scale
        enemy.setScale(scale);
        
        // Set up any special properties or behaviors
        if (type === EnemyType.Flying) {
            enemy.setData('flying', true);
            enemy.setData('ignoreObstacles', true);
            
            // Add flying animation
            this.scene.tweens.add({
                targets: enemy,
                y: y - 10,
                duration: 1000,
                yoyo: true,
                repeat: -1
            });
        }
        
        if (type === EnemyType.Boss) {
            // Boss has special ability to summon minions
            enemy.setData('canSummonMinions', true);
            enemy.setData('summonCooldown', 10000); // 10 seconds
            enemy.setData('lastSummonTime', 0);
            
            // Add glow effect for boss
            // This is a commented example - would require additional setup:
            // this.scene.plugins.get('rexGlowFilter').add(enemy, {
            //     distance: 15,
            //     outerStrength: 3,
            //     color: 0xff0000
            // });
        }
        
        return enemy;
    }
}