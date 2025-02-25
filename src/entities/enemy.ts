import Phaser from "phaser";
import GameScene from "../scenes/game-scene";
import { HealthBar } from "../utils/health-bar";
import { EnemyType } from "../types/enemy-type";
import Player from "./player";
import Tower from "./tower";
import Base from "./base";

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
    private enemyType: EnemyType;
    private tier: number;
    private specialAbilities: Map<string, any> = new Map();
    private lastAbilityUse: Map<string, number> = new Map();

    constructor(scene: GameScene, x: number, y: number, health: number, speed: number, onDeath: () => void, type: EnemyType = EnemyType.Basic, tier: number = 1) {
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
        this.enemyType = type;
        this.tier = tier;
    }

    public addSpecialAbility(type: string, data: any) {
        this.specialAbilities.set(type, data);
        this.lastAbilityUse.set(type, 0);
    }

    update() {
        // Always update health bar position first to ensure it stays with the enemy
        this.healthBar.updateHealth(this.health);

        // Use special abilities if available
        const currentTime = this.scene.time.now;

        this.specialAbilities.forEach((data, type) => {
            const lastUse = this.lastAbilityUse.get(type) || 0;

            if (currentTime - lastUse >= data.cooldown) {
                this.useAbility(type, data);
                this.lastAbilityUse.set(type, currentTime);
            }
        });
    }

    private useAbility(type: string, data: any) {
        const gameScene = this.scene as GameScene;

        switch (type) {
            case 'ranged':
                // Find closest target - could be player, tower, or base
                const target = this.findTarget(data.range);
                if (target) {
                    gameScene.shootProjectile(this, target, data.damage);
                }
                break;

            case 'aoe':
                // Deal AoE damage to nearby targets
                const targets = this.findTargetsInRadius(data.range);
                targets.forEach(target => {
                    if (target instanceof Player) {
                        target.takeDamage(data.damage);
                    } else if (target instanceof Tower) {
                        target.takeDamage(data.damage);
                    } else if (target instanceof Base) {
                        target.takeDamage(data.damage);
                    }
                });

                // Visual effect for AoE
                const circle = this.scene.add.circle(this.x, this.y, data.range, 0xff0000, 0.3);
                this.scene.tweens.add({
                    targets: circle,
                    alpha: 0,
                    duration: 500,
                    onComplete: () => circle.destroy()
                });
                break;

            case 'summon':
                // Since getEnemyFactory doesn't exist in GameScene, let's use a different approach
                // We can modify how this is handled or implement a proper solution based on game architecture
                console.warn('Enemy summon ability not implemented - getEnemyFactory missing');
                // For now, we'll comment out the non-working code
                /*
                const enemyFactory = gameScene.getEnemyFactory();
                for (let i = 0; i < data.count; i++) {
                    const angle = (Math.PI * 2 / data.count) * i;
                    const spawnX = this.x + Math.cos(angle) * 50;
                    const spawnY = this.y + Math.sin(angle) * 50;

                    enemyFactory.createEnemy(
                        EnemyType.Basic,
                        spawnX,
                        spawnY,
                        Math.max(1, this.tier - 1),
                        () => gameScene.onEnemyKilled()
                    );
                }
                */
                break;
        }
    }

    private findTarget(range: number): Phaser.Physics.Arcade.Sprite | null {
        const gameScene = this.scene as GameScene;

        // Get all potential targets
        const player = gameScene.getUser();
        // Since getTowers doesn't exist, we need to use a different approach
        // For now, we'll use getEnemies as a reference and adapt
        const towers: Phaser.Physics.Arcade.Sprite[] = [];
        // Ideally, we would implement a getTowers method in GameScene or use a different pattern
        
        const base = gameScene.getBase();

        let closestTarget: Phaser.Physics.Arcade.Sprite | null = null;
        let closestDistance = range;

        // Check distance to player
        const distToPlayer = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
        if (distToPlayer < closestDistance) {
            closestTarget = player;
            closestDistance = distToPlayer;
        }

        // Check distance to towers
        towers.forEach((tower: Phaser.Physics.Arcade.Sprite) => {
            const dist = Phaser.Math.Distance.Between(this.x, this.y, tower.x, tower.y);
            if (dist < closestDistance) {
                closestTarget = tower;
                closestDistance = dist;
            }
        });

        // Check distance to base
        const distToBase = Phaser.Math.Distance.Between(this.x, this.y, base.x, base.y);
        if (distToBase < closestDistance) {
            closestTarget = base;
            closestDistance = distToBase;
        }

        return closestTarget;
    }

    private findTargetsInRadius(radius: number): Phaser.Physics.Arcade.Sprite[] {
        const gameScene = this.scene as GameScene;
        const targets: Phaser.Physics.Arcade.Sprite[] = [];

        // Add player if in range
        const player = gameScene.getUser();
        if (Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y) <= radius) {
            targets.push(player);
        }

        // Instead of using getTowers which doesn't exist, we'll use a different approach
        // For now we'll skip the towers check since we don't have access to them
        // This will need to be updated when a proper towers access method is added
        
        // Add base if in range
        const base = gameScene.getBase();
        if (Phaser.Math.Distance.Between(this.x, this.y, base.x, base.y) <= radius) {
            targets.push(base);
        }

        return targets;
    }

    /**
     * Function called when enemy dies to handle cleanup and rewards
     */
    takeDamage(amount: number) {
        this.health -= amount;
        this.healthBar.updateHealth(this.health);
        if (this.health <= 0) {
            this.healthBar.cleanup();
            // Clear any existing status effect timers
            if (this.burnTimer) this.burnTimer.remove();
            if (this.slowTimer) this.slowTimer.remove();
            
            // Roll for drops using the new item system
            this.handleDropsOnDeath();
            
            // Destroy the enemy
            this.destroy();
            
            // Call the onDeath callback (typically updates game state)
            this.onDeath();
        }
    }
    
    /**
     * Handle item drops when enemy dies
     */
    private handleDropsOnDeath(): void {
        const gameScene = this.scene as GameScene;
        const itemDropManager = gameScene.getItemDropManager();
        
        if (!itemDropManager) return;
        
        // Use the enemy tier as the level for drop calculation
        itemDropManager.dropRandomItem(this.x, this.y);
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

    // Add this method to update the onDeath callback
    public setOnDeath(callback: () => void): void {
        this.onDeath = callback;
    }
}