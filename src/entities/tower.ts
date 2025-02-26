import Phaser from "phaser";
import GameScene from "../scenes/game-scene";
import { TowerType, TowerSettings } from "../settings";
import Enemy from "./enemy";
import { HealthComponent } from "../utils/health-component";
import { gameConfig } from "../utils/app-config";

export default class Tower extends Phaser.Physics.Arcade.Sprite {
    towerType: TowerType;
    private towerData: TowerSettings;
    private lastShotTime: number = 0;
    // @ts-ignore
    private shootCooldown: number | null = null;
    private healthComponent: HealthComponent;
    private speedLevel: number = 0;
    private rangeLevel: number = 0;
    private damageLevel: number = 0;
    private specialPower: "fire" | "ice" | "critical" | null = null;
    private maxUpgradeLevel: number = 5;
    private shotsFired: number = 0;
    private enemiesKilled: number = 0;
    private damageDealt: number = 0;
    private tileX: number; // Tile coordinates
    private tileY: number;
    private tileWidth: number; // Size in tiles
    private tileHeight: number;
    private tier: number = 1; // Tower tier, starts at 1
    private maxTier: number = 5; // Maximum tier a tower can reach
    private tierMultipliers = {
        2: 1.25, // 25% improvement
        3: 1.5,  // 50% improvement
        4: 2.0,  // 100% improvement
        5: 2.5   // 150% improvement
    };



    constructor(scene: GameScene, tileX: number, tileY: number, type: TowerType) {
        const tileMapManager = scene.getTileMapManager();
        const worldPos = tileMapManager.tileToWorld(tileX, tileY);
        super(scene, worldPos.x, worldPos.y, type);
        this.towerType = type;

        const towerConfig = gameConfig.getConfig("towers")?.[type];
        if (!towerConfig) throw new Error(`Invalid tower configuration for type: ${type}`);
        this.towerData = towerConfig;

        // NOW we can access towerData
        this.shootCooldown = this.towerData.shootCooldown;
        this.tileX = tileX;
        this.tileY = tileY;
        this.tileWidth = this.towerData.size.width;
        this.tileHeight = this.towerData.size.height;

        scene.add.existing(this);
        scene.physics.add.existing(this, true);
        this.setOrigin(0.5, 0.5);
        this.setScale(this.towerData.scale);

        this.healthComponent = new HealthComponent(this, scene, this.towerData.health, this.towerData.health, () => {
            scene.removeTower(this);
            this.destroyTower();
        });
    }

    private getCurrentShootCooldown(): number {
        const baseCooldown = gameConfig.getConfig("towers")?.[this.towerType].shootCooldown || -1;
        // Increase speed improvement from 15% to 20% per level
        const reduction = 0.2 * this.speedLevel;
        // Apply tier multiplier (higher tier = faster shooting)
        if (baseCooldown === -1) {
            console.error(`Base cooldown not found for tower type: ${this.towerType}`);
            return -1;
        }
        return baseCooldown * (1 - reduction) / this.getTierMultiplier();
    }

    getCurrentRange(): number {
        const baseRange = (gameConfig.getConfig("towers")?.[this.towerType].range) || -1;


        if (baseRange === -1) {
            console.error(`Base range not found for tower type: ${this.towerType}`);
            return -1;
        }

        // Increase range bonus from 30 to 40 pixels per level
        const upgradedRange = baseRange + 40 * this.rangeLevel;
        // Apply tier multiplier (higher tier = better range)
        return upgradedRange * this.getTierMultiplier();
    }

    getCurrentDamage(): number {
        const baseDamage = (gameConfig.getConfig("towers")?.[this.towerType].damage) || -1;

        if (baseDamage === -1) {
            console.error(`Base damage not found for tower type: ${this.towerType}`);
            return -1;
        }

        // Increase damage bonus from 25% to 30% per level
        let damage = baseDamage * (1 + 0.3 * this.damageLevel);

        if (this.specialPower === "critical") {
            // Increase critical bonus from 30% to 50%
            damage += baseDamage * 0.5;
        }

        // Apply tier multiplier (higher tier = more damage)
        return damage * this.getTierMultiplier();
    }

    // Get a multiplier based on current tier
    private getTierMultiplier(): number {
        if (this.tier === 1) return 1;
        return this.tierMultipliers[this.tier as 2 | 3 | 4 | 5];
    }

    // Get the cost to upgrade to the next tier
    public getTierUpgradeCost(): number {
        if (this.tier >= this.maxTier) return Infinity;
        const basePrice = (gameConfig.getConfig("towers")?.[this.towerType].price) || -1;
        if (basePrice === -1) {
            console.error(`Base price not found for tower type: ${this.towerType}`);
            return -1;
        }
        return basePrice * this.tier; // Base price * current tier
    }

    // Upgrade the tower to the next tier
    public upgradeTier(): boolean {
        if (this.tier >= this.maxTier) return false;

        this.tier++;

        // Visual indication of upgraded tier (e.g., tinting)
        this.updateTierAppearance();

        // Also increase health for higher tiers
        const newMaxHealth = this.towerData.health * this.getTierMultiplier();
        this.healthComponent.setMaxHealth(newMaxHealth, true);

        return true;
    }

    // Update tower appearance based on tier
    private updateTierAppearance(): void {
        // Different tint colors for different tiers
        const tierColors = {
            1: 0xffffff, // No tint for tier 1
            2: 0x00ff00, // Green for tier 2
            3: 0x0000ff, // Blue for tier 3
            4: 0xff00ff, // Purple for tier 4
            5: 0xff0000  // Red for tier 5
        };

        this.setTint(tierColors[this.tier as 1 | 2 | 3 | 4 | 5]);

        // Scale slightly larger with each tier
        this.setScale(this.towerData.scale * (1 + (this.tier - 1) * 0.1));
    }

    // Getters for the tier system
    public getTier(): number {
        return this.tier;
    }

    public getMaxTier(): number {
        return this.maxTier;
    }

    public getUpgradeCost(type: "speed" | "range" | "damage"): number {
        const level = this[type + "Level" as keyof Tower] as number;
        if (level >= this.maxUpgradeLevel) return Infinity; // Or some other indicator
        return 100 * (level + 1); // Example cost calculation
    }

    public upgrade(type: "speed" | "range" | "damage") {
        if ((this[type + "Level" as keyof Tower] as number) < this.maxUpgradeLevel) {
            (this[type + "Level" as keyof Tower] as number)++;
        }
    }

    public getSpecialPowerCost(): number {
        return 500; // Fixed cost for special powers
    }

    public setSpecialPower(power: "fire" | "ice" | "critical") {
        if (!this.specialPower) {  // Only allow one special power
            this.specialPower = power;
        }
    }

    // Getters for UI
    public getSpeedLevel(): number {
        return this.speedLevel;
    }
    public getRangeLevel(): number {
        return this.rangeLevel;
    }
    public getDamageLevel(): number {
        return this.damageLevel;
    }
    public getSpecialPower(): string | null {
        return this.specialPower;
    }
    public getMaxUpgradeLevel(): number {
        return this.maxUpgradeLevel;
    }
    public getHealth(): number {
        return this.healthComponent.getHealth();
    }

    // Add this getter!
    public getTowerType(): TowerType {
        return this.towerType;
    }

    // Add these new getters
    public getMaxHealth(): number {
        return this.healthComponent.getMaxHealth();
    }

    public getShootCooldown(): number {
        return this.getCurrentShootCooldown();
    }

    public shoot(target: Phaser.Physics.Arcade.Sprite) {
        const gameScene = this.scene as GameScene;
        const damage = this.getCurrentDamage();

        gameScene.shootProjectile(this, target.x, target.y, damage, this.towerData.projectileType);
        this.shotsFired++;
    }

    public registerKill(enemy: Enemy, damage: number) {
        this.enemiesKilled++;
        this.damageDealt += damage;
    }

    public getShotsFired(): number {
        return this.shotsFired;
    }

    public getEnemiesKilled(): number {
        return this.enemiesKilled;
    }

    public getDamageDealt(): number {
        return this.damageDealt;
    }

    update() {
        if (!this.scene || !this.active) return;
        this.healthComponent.update();
        this.handleShooting();
    }

    private handleShooting() {
        const currentTime = this.scene.time.now;
        const gameScene = this.scene as GameScene;
        const projectileType = gameConfig.getConfig("towers")?.[this.towerType].projectileType || 'normal';
        // const projectileSettings = gameConfig.getConfig("projectiles")?.[projectileType] || {}; // No longer used
        if (this.towerType === 'area-tower') {
            this.handleAreaTowerShooting(currentTime, gameScene);
        } else {
            this.handleSingleTargetTowerShooting(currentTime, gameScene, projectileType);
        }
    }

    private handleAreaTowerShooting(currentTime: number, gameScene: GameScene) {
        if (currentTime - this.lastShotTime >= this.getCurrentShootCooldown()) {
            // Filter to ensure we only get actual enemies within range
            const enemiesInRange = gameScene.getEnemies().filter(enemy => {
                // Make sure it's an Enemy instance
                if (!(enemy instanceof Enemy)) return false;

                // Check if it's in range
                const distance = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
                return distance < this.getCurrentRange();
            });

            // Only shoot if there are enemies in range
            if (enemiesInRange.length > 0) {
                enemiesInRange.forEach(enemy => {
                    const damage = this.getCurrentDamage();
                    if (this.specialPower === "fire") {
                        // Pass the special power as the projectile type
                        gameScene.shootProjectile(this, enemy.x, enemy.y, damage, "fire");
                    } else if (this.specialPower === "ice") {
                        gameScene.shootProjectile(this, enemy.x, enemy.y, damage, "ice");
                    } else {
                        gameScene.shootProjectile(this, enemy.x, enemy.y, damage, this.towerData.projectileType); // Use tower's projectile type
                    }
                });
                this.lastShotTime = currentTime;
            }
        }
    }


    private handleSingleTargetTowerShooting(currentTime: number, gameScene: GameScene, projectileType: string) {
        const nearestEnemy = this.findNearestEnemy(gameScene);
        if (nearestEnemy && currentTime - this.lastShotTime >= this.getCurrentShootCooldown()) {
            const distance = Phaser.Math.Distance.Between(this.x, this.y, nearestEnemy.x, nearestEnemy.y);
            const projectileSpeed = 400; // Must match shootProjectile speed
            const timeToReach = distance / projectileSpeed;

            // Null check for nearestEnemy.body
            const enemyVelocity = nearestEnemy.body ? nearestEnemy.body.velocity : { x: 0, y: 0 };
            const targetX = nearestEnemy.x + enemyVelocity.x * timeToReach;
            const targetY = nearestEnemy.y + enemyVelocity.y * timeToReach;
            const damage = this.getCurrentDamage();

            // Use special power if available, otherwise use tower's default, otherwise use 'normal'
            const finalProjectileType = this.specialPower || projectileType;
            gameScene.shootProjectile(this, targetX, targetY, damage, finalProjectileType);
            this.lastShotTime = currentTime;
        }
    }

    private findNearestEnemy(gameScene: GameScene): Phaser.Physics.Arcade.Sprite | null {
        const enemies = gameScene.getEnemies().filter(enemy => enemy.active && enemy instanceof Enemy);
        if (enemies.length === 0) return null;
        return enemies.reduce((nearest: Phaser.Physics.Arcade.Sprite | null, enemy) => {
            const distance = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
            if (distance < this.getCurrentRange() && (!nearest || distance < Phaser.Math.Distance.Between(this.x, this.y, nearest.x, nearest.y))) {
                return enemy;
            }
            return nearest;
        }, null);
    }

    takeDamage(damage: number) {
        if (!this.active) return; // Exit if the tower is already destroyed
        console.log(`${this.towerType} taking ${damage} damage`);
        this.healthComponent.takeDamage(damage);
    }

    // Override destroy to free up tiles
    destroyTower() {
        const tileMapManager = (this.scene as GameScene).getTileMapManager();
        tileMapManager.releaseTiles(this.tileX, this.tileY, this.tileWidth, this.tileHeight);
        this.destroy();
    }

    // Override destroy to ensure cleanup
    destroy(fromScene?: boolean) {
        this.healthComponent.cleanup();
        super.destroy(fromScene);
    }

    // Get a unique ID for this tower
    getId(): string {
        return `tower_${this.towerType}_${this.x}_${this.y}`;
    }
} 