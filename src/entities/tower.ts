import Phaser from "phaser";
import GameScene from "../scenes/game-scene";
import { GAME_SETTINGS, TowerType } from "../settings";
import { HealthBar } from "../utils/health-bar";
import TileMapManager from "../utils/tile-map-manager";
import Enemy from "./enemy";

export default class Tower extends Phaser.Physics.Arcade.Sprite {
    towerType: TowerType;
    private towerData: typeof GAME_SETTINGS.towers[TowerType];
    private lastShotTime: number = 0;
    // @ts-ignore
    private shootCooldown: number | null = null;
    private healthBar: HealthBar;
    private health: number;
    private maxHealth: number;
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
        // Get world position from tiles
        const tileMapManager = scene.getTileMapManager();
        const worldPos = tileMapManager.tileToWorld(tileX, tileY);

        super(scene, worldPos.x, worldPos.y, type);

        this.towerType = type;
        this.towerData = { ...GAME_SETTINGS.towers[type] };
        this.shootCooldown = this.towerData.shootCooldown;
        this.maxHealth = this.towerData.health;
        this.health = this.towerData.health;

        this.tileX = tileX;
        this.tileY = tileY;
        this.tileWidth = this.towerData.size.width;
        this.tileHeight = this.towerData.size.height;

        scene.add.existing(this);
        scene.physics.add.existing(this, true); // true = static body
        this.setOrigin(0.5, 0.5); // Center the sprite
        this.setScale(this.towerData.scale);

        // Make tower clickable
        this.setInteractive();
        this.on("pointerdown", () => (this.scene as GameScene).selectTower(this));

        this.healthBar = new HealthBar(scene, this, this.maxHealth);

        // Mark tiles as occupied
        tileMapManager.occupyTiles(tileX, tileY, this.tileWidth, this.tileHeight, 'tower', this.getId());
    }

    private getCurrentShootCooldown(): number {
        const baseCooldown = this.towerData.shootCooldown;
        // Increase speed improvement from 15% to 20% per level
        const reduction = 0.2 * this.speedLevel;
        // Apply tier multiplier (higher tier = faster shooting)
        return baseCooldown * (1 - reduction) / this.getTierMultiplier();
    }

    getCurrentRange(): number {
        const baseRange = this.towerData.range;
        // Increase range bonus from 30 to 40 pixels per level
        const upgradedRange = baseRange + 40 * this.rangeLevel;
        // Apply tier multiplier (higher tier = better range)
        return upgradedRange * this.getTierMultiplier();
    }

    getCurrentDamage(): number {
        const baseDamage = this.towerData.damage;
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
        return this.towerData.price * this.tier; // Base price * current tier
    }

    // Upgrade the tower to the next tier
    public upgradeTier(): boolean {
        if (this.tier >= this.maxTier) return false;
        
        this.tier++;
        
        // Visual indication of upgraded tier (e.g., tinting)
        this.updateTierAppearance();
        
        // Also increase health for higher tiers
        this.maxHealth = this.towerData.health * this.getTierMultiplier();
        this.health = this.maxHealth;
        this.healthBar.updateHealth(this.health);
        
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
        return this.health;
    }

    // Add this getter!
    public getTowerType(): TowerType {
        return this.towerType;
    }

    // Add these new getters
    public getMaxHealth(): number {
        return this.maxHealth;
    }

    public getShootCooldown(): number {
        return this.getCurrentShootCooldown();
    }

    public shoot(target: Phaser.Physics.Arcade.Sprite) {
        const gameScene = this.scene as GameScene;
        const damage = this.getCurrentDamage();

        gameScene.shootProjectile(this, target, damage);
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
        if (!this.scene || !this.active) {
            return;
        }
        const currentTime = this.scene.time.now;
        const gameScene = this.scene as GameScene;

        // Get projectile settings based on tower type
        const projectileType = GAME_SETTINGS.towers[this.towerType].projectileType;
        const projectileSettings = GAME_SETTINGS.projectiles[projectileType];

        if (this.towerType === 'area-tower') {
            // Area tower logic
            if (currentTime - this.lastShotTime >= this.getCurrentShootCooldown()) {
                const enemiesInRange = gameScene.getEnemies().filter(enemy => {
                    const distance = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
                    return distance < this.getCurrentRange(); // Use current range
                });
                enemiesInRange.forEach(enemy => {
                    // Use projectileSettings.damage instead of this.getCurrentDamage()
                    const damage = projectileSettings.damage;
                    // Pass special effect to shootProjectile
                    if (this.specialPower === "fire") {
                        gameScene.shootProjectile(this, enemy, damage, "fire"); // Example burn damage
                    } else if (this.specialPower === "ice") {
                        gameScene.shootProjectile(this, enemy, damage, "ice"); // Example slow
                    } else {
                        gameScene.shootProjectile(this, enemy, damage); // No special effect
                    }
                });
                this.lastShotTime = currentTime;
            }
        } else {
            // Logic for other tower types (normal-tower, sniper-tower)
            const nearestEnemy = gameScene.getEnemies().reduce((nearest: Phaser.Physics.Arcade.Sprite | null, enemy: Phaser.Physics.Arcade.Sprite) => {
                const distance = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
                if (distance < this.getCurrentRange() && (!nearest || distance < Phaser.Math.Distance.Between(this.x, this.y, nearest.x, nearest.y))) { // Use current range
                    return enemy;
                }
                return nearest;
            }, null);

            if (nearestEnemy && currentTime - this.lastShotTime >= this.getCurrentShootCooldown()) {
                // Use projectileSettings.damage instead of this.getCurrentDamage()
                const damage = projectileSettings.damage;

                // Pass special effect to shootProjectile
                if (this.specialPower === "fire") {
                    gameScene.shootProjectile(this, nearestEnemy, damage, "fire"); // Example burn damage
                } else if (this.specialPower === "ice") {
                    gameScene.shootProjectile(this, nearestEnemy, damage, "ice"); // Example slow
                } else if (this.specialPower === "critical") {
                    gameScene.shootProjectile(this, nearestEnemy, damage, "critical"); // Example critical hit
                }
                else {
                    gameScene.shootProjectile(this, nearestEnemy, damage); // No special effect
                }
                this.lastShotTime = currentTime;
            }
        }
        this.healthBar.updateHealth(this.health);
    }

    takeDamage(damage: number) {
        if (!this.active) return; // Exit if the tower is already destroyed
        this.health -= damage;
        console.log(`${this.towerType} health: ${this.health}`);
        this.healthBar.updateHealth(this.health);

        if (this.health <= 0) {
            const gameScene = this.scene as GameScene;

            // 1) Remove from group first using a public method
            gameScene.removeTower(this);

            // 2) Destroy the tower
            this.healthBar.cleanup();
            this.destroyTower();
            console.log(`${this.towerType} destroyed!`);

            // 3) Force recalc
            gameScene.recalculateEnemyTargets();

            // 4) (Optional) Force immediate re-update.
            gameScene.forceEnemyUpdate();
        }
    }

    // Override destroy to free up tiles
    destroyTower() {
        const tileMapManager = (this.scene as GameScene).getTileMapManager();
        tileMapManager.releaseTiles(this.tileX, this.tileY, this.tileWidth, this.tileHeight);
        this.destroy();
    }

    // Get a unique ID for this tower
    getId(): string {
        return `tower_${this.towerType}_${this.x}_${this.y}`;
    }

} 