import Phaser from "phaser";
import GameScene from "../../scenes/game-scene";
import { TowerType, type TowerSettings, type TowerConfig, GAME_SETTINGS } from "../../settings";
import Enemy from "../enemy/enemy";
import { HealthComponent } from "../components/health-component";
import TileMapManager from "../../managers/tile-map-manager";
import EntityManager from "../../managers/entity-manager";
import CombatSystem from "../../systems/combat-system";
import { EventBus } from "../../core/event-bus";

export default class Tower extends Phaser.Physics.Arcade.Sprite {
    towerType: TowerType;
    private towerData: TowerConfig;
    private lastShotTime: number = 0;
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
        damage: [1, 1.2, 1.5, 2, 3],
        range: [1, 1.1, 1.2, 1.3, 1.5],
        speed: [1, 1.1, 1.25, 1.5, 2]
    };
    private eventBus: EventBus;
    private entityManager: EntityManager;
    private combatSystem: CombatSystem;
    private tileMapManager: TileMapManager;
    protected gameScene: GameScene;

    constructor(
        scene: GameScene,
        tileX: number,
        tileY: number,
        type: TowerType,
        tileMapManager: TileMapManager,
        eventBus: EventBus,
        entityManager: EntityManager,
        combatSystem: CombatSystem
    ) {
        const worldPos = tileMapManager.tileToWorld(tileX, tileY);
        super(scene, worldPos.x, worldPos.y, type);
        this.towerType = type;
        this.gameScene = scene;
        this.tileMapManager = tileMapManager;
        this.eventBus = eventBus;
        this.entityManager = entityManager;
        this.combatSystem = combatSystem;

        this.towerData = GAME_SETTINGS.towers[type];
        this.tileX = tileX;
        this.tileY = tileY;
        this.tileWidth = this.towerData.size.width;
        this.tileHeight = this.towerData.size.height;

        scene.add.existing(this);
        scene.physics.add.existing(this, true);
        this.setOrigin(0.5, 0.5);
        this.setScale(this.towerData.scale);

        this.healthComponent = new HealthComponent(this, scene, this.towerData.health, this.towerData.health, () => {
            this.gameScene.removeTower(this);
            this.destroyTower();
        });

        // Occupy tiles in the tile map
        tileMapManager.occupyTiles(
            tileX, tileY,
            this.tileWidth, this.tileHeight,
            'tower',
            this.getId()
        );
    }

    private getCurrentShootCooldown(): number {
        if (this.shootCooldown !== null) {
            return this.shootCooldown;
        }

        // Apply speed level and tier bonuses
        const baseSpeed = this.towerData.shootCooldown;
        const speedMultiplier = 1 - (this.speedLevel * 0.1); // 10% reduction per level
        const tierMultiplier = this.tierMultipliers.speed[this.tier - 1];

        return baseSpeed * speedMultiplier / tierMultiplier;
    }

    getCurrentRange(): number {
        // Apply range level and tier bonuses
        const baseRange = this.towerData.range;
        const rangeMultiplier = 1 + (this.rangeLevel * 0.15); // 15% increase per level
        const tierMultiplier = this.tierMultipliers.range[this.tier - 1];

        // Apply special power bonus if applicable
        let specialBonus = 1;
        if (this.specialPower === "ice") {
            specialBonus = 1.2; // Ice towers get 20% more range
        }

        return baseRange * rangeMultiplier * tierMultiplier * specialBonus;
    }

    getCurrentDamage(): number {
        // Apply damage level and tier bonuses
        const baseDamage = this.towerData.damage;
        const damageMultiplier = 1 + (this.damageLevel * 0.2); // 20% increase per level
        const tierMultiplier = this.tierMultipliers.damage[this.tier - 1];

        // Apply special power bonus if applicable
        let specialBonus = 1;
        if (this.specialPower === "fire") {
            specialBonus = 1.3; // Fire towers get 30% more damage
        } else if (this.specialPower === "critical") {
            // Critical towers have a chance to do double damage
            // This is handled in the shoot method
            specialBonus = 1.2; // Base damage increase
        }

        return Math.round(baseDamage * damageMultiplier * tierMultiplier * specialBonus);
    }

    // Get a multiplier based on current tier
    private getTierMultiplier(): number {
        if (this.tier === 1) return 1;
        return 1 + ((this.tier - 1) * 0.25); // 25% increase per tier
    }

    // Get the cost to upgrade to the next tier
    public getTierUpgradeCost(): number {
        if (this.tier >= this.maxTier) return Infinity;
        const baseCost = this.towerData.price;
        const tierFactor = Math.pow(2, this.tier); // Exponential increase

        return Math.round(baseCost * 0.75 * tierFactor);
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

        // Emit event for tier upgrade
        this.eventBus.emit('tower-tier-upgraded', {
            towerId: this.getId(),
            newTier: this.tier,
            type: this.towerType
        });

        return true;
    }

    // Update tower appearance based on tier
    private updateTierAppearance(): void {
        // Different tint colors for different tiers
        const tierColors = {
            1: 0xffffff, // No tint for tier 1
            2: 0xcccccc, // Silver for tier 2
            3: 0xffcc00, // Gold for tier 3
            4: 0x00ccff,  // Diamond blue for tier 4
            5: 0xff00ff   // Mythic purple for tier 5
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
        const baseCost = Math.round(this.towerData.price * 0.4);
        const levelFactor = Math.pow(1.5, level);
        return Math.round(baseCost * levelFactor);
    }

    public upgrade(type: "speed" | "range" | "damage") {
        if ((this[type + "Level" as keyof Tower] as number) < this.maxUpgradeLevel) {
            (this[type + "Level" as keyof Tower] as number)++;
        }
    }

    public getSpecialPowerCost(): number {
        return Math.round(this.towerData.price * 1.5);
    }

    public setSpecialPower(power: "fire" | "ice" | "critical") {
        if (!this.specialPower) {  // Only allow one special power
            this.specialPower = power;
        }

        // Visual effect based on power
        if (power === "fire") this.setTint(0xff6600);
        else if (power === "ice") this.setTint(0x66ffff);
        else if (power === "critical") this.setTint(0xffff00);
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
        let damage = this.getCurrentDamage();

        // Handle critical hits
        if (this.specialPower === "critical" && Math.random() < 0.25) {
            damage *= 2;
        }

        let projectileType = 'normal';

        // Set projectile type based on special power
        if (this.specialPower === "fire") {
            projectileType = 'fire';
        } else if (this.specialPower === "ice") {
            projectileType = 'ice';
        } else if (this.specialPower === "critical" && Math.random() < 0.25) {
            projectileType = 'critical';
        }

        this.combatSystem.shootProjectile(this, target.x, target.y, damage, projectileType);
        this.shotsFired++;
    }

    public registerKill(enemy: Enemy, damage: number) {
        console.log(`Tower ${this.towerType} killed enemy at (${enemy.x}, ${enemy.y})`);
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
        if (!this.gameScene || !this.active) return;
        this.healthComponent.update();
        this.handleShooting();
    }

    private handleShooting() {
        const currentTime = this.gameScene.time.now;

        if (currentTime - this.lastShotTime < this.getCurrentShootCooldown()) {
            return;
        }

        if (this.towerType === TowerType.Area) {
            this.handleAreaTowerShooting(currentTime, this.gameScene as GameScene);
        } else {
            this.handleSingleTargetTowerShooting(currentTime, this.gameScene as GameScene, this.towerType);
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
                        this.combatSystem.shootProjectile(this, enemy.x, enemy.y, damage, "fire");
                    } else if (this.specialPower === "ice") {
                        this.combatSystem.shootProjectile(this, enemy.x, enemy.y, damage, "ice");
                    } else {
                        this.combatSystem.shootProjectile(this, enemy.x, enemy.y, damage, this.towerData.projectileType); // Use tower's projectile type
                    }
                });
                this.lastShotTime = currentTime;
            }
        }
    }

    private handleSingleTargetTowerShooting(currentTime: number, gameScene: GameScene, projectileType: string) {
        // Use projectileType for logging or customizing behavior if needed
        console.log(`Handling ${projectileType} shooting`);
        
        const target = this.findNearestEnemy(gameScene);

        if (target) {
            this.lastShotTime = currentTime;
            this.shoot(target);
        }
    }

    private findNearestEnemy(gameScene: GameScene): Phaser.Physics.Arcade.Sprite | null {
        const enemies = this.entityManager.getEnemies().filter(enemy => enemy.active && enemy instanceof Enemy);
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

        // Emit damage event
        this.eventBus.emit('tower-damaged', {
            towerId: this.getId(),
            damage: damage,
            remainingHealth: this.healthComponent.getHealth()
        });
    }

    // Override destroy to free up tiles
    destroyTower() {
        this.tileMapManager.releaseTiles(this.tileX, this.tileY, this.tileWidth, this.tileHeight);
        this.destroy();
    }

    // Override destroy to ensure cleanup
    destroy(fromScene?: boolean) {
        this.healthComponent.cleanup();
        super.destroy(fromScene);
    }

    // Get a unique ID for this tower
    getId(): string {
        return `tower_${this.tileX}_${this.tileY}_${this.towerType}`;
    }
} 