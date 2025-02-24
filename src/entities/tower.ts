import Phaser from "phaser";
import GameScene from "../scenes/game-scene";
import { GAME_SETTINGS, TowerType } from "../settings";
import { HealthBar } from "../utils/health-bar";

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

    constructor(scene: GameScene, x: number, y: number, type: TowerType) {
        super(scene, x, y, type);

        this.towerType = type;
        this.towerData = { ...GAME_SETTINGS.towers[type] };
        this.shootCooldown = this.towerData.shootCooldown;
        this.maxHealth = this.towerData.health;
        this.health = this.towerData.health;

        scene.add.existing(this);
        scene.physics.add.existing(this, true); // true = static body
        this.setOrigin(0.5, 0.5); // Center the sprite
        this.setScale(this.towerData.scale);

        // Make tower clickable
        this.setInteractive();
        this.on("pointerdown", () => (this.scene as GameScene).selectTower(this));

        this.healthBar = new HealthBar(scene, this, this.maxHealth);
    }

    private getCurrentShootCooldown(): number {
        const baseCooldown = this.towerData.shootCooldown;
        const reduction = 0.1 * this.speedLevel; // 10% reduction per level
        return baseCooldown * (1 - reduction);
    }

    getCurrentRange(): number {
        const baseRange = this.towerData.range;
        return baseRange + 20 * this.rangeLevel;  // Increase range by 20 per level
    }

    getCurrentDamage(): number {
        let damage = this.towerData.damage + 5 * this.damageLevel;
        if (this.specialPower === "critical") {
            damage += 10; // Permanent damage increase for critical
        }
        return damage;
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
                        gameScene.shootProjectile(this, enemy, damage, { type: "fire", params: { burnDamage: 5 } }); // Example burn damage
                    } else if (this.specialPower === "ice") {
                        gameScene.shootProjectile(this, enemy, damage, { type: "ice", params: { slowFactor: 0.5, duration: 5000 } }); // Example slow
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
                    gameScene.shootProjectile(this, nearestEnemy, damage, { type: "fire", params: { burnDamage: 5 } }); // Example burn damage
                } else if (this.specialPower === "ice") {
                    gameScene.shootProjectile(this, nearestEnemy, damage, { type: "ice", params: { slowFactor: 0.5, duration: 5000 } }); // Example slow
                } else if (this.specialPower === "critical") {
                    gameScene.shootProjectile(this, nearestEnemy, damage, { type: "critical", params: {} }); // Example critical hit
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
            this.destroy();
            console.log(`${this.towerType} destroyed!`);

            // 3) Force recalc
            gameScene.recalculateEnemyTargets();

            // 4) (Optional) Force immediate re-update.
            gameScene.forceEnemyUpdate();
        }
    }

} 