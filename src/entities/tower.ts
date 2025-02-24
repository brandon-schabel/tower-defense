import Phaser from "phaser";
import GameScene from "../scenes/game-scene";
import { TOWER_TYPES } from "../ui/hud";
import { HealthBar } from "../utils/health-bar";

export default class Tower extends Phaser.Physics.Arcade.Sprite {
    private towerType: string;
    private towerData: typeof TOWER_TYPES[keyof typeof TOWER_TYPES];
    private lastShotTime: number = 0;
    private shootCooldown: number = 500; // 500ms between shots
    private healthBar: HealthBar;
    private health: number;
    private maxHealth: number = 100;

    constructor(scene: GameScene, x: number, y: number, type: string) {
        super(scene, x, y, type);
        
        this.towerType = type;
        this.towerData = TOWER_TYPES[type];
        
        scene.add.existing(this);
        scene.physics.add.existing(this, true); // true = static body
        this.setOrigin(0.5, 0.5); // Center the sprite

        this.maxHealth = this.towerData.health;
        this.health = this.towerData.health;
        this.healthBar = new HealthBar(scene, this, this.maxHealth);
    }

    update() {
        if (!this.scene || !this.active) {
            return;
        }
        const currentTime = this.scene.time.now;

        if (this.towerType === 'area-tower') {
            // Area tower logic
            if (currentTime - this.lastShotTime >= this.shootCooldown) {
                const enemiesInRange = (this.scene as GameScene).getEnemies().filter(enemy => {
                    const distance = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
                    return distance < this.towerData.range;
                });
                enemiesInRange.forEach(enemy => {
                    (this.scene as GameScene).shootProjectile(this, enemy, this.towerData);
                });
                this.lastShotTime = currentTime;
            }
        } else {
            // Logic for other tower types (normal-tower, sniper-tower)
            const nearestEnemy = (this.scene as GameScene).getEnemies().reduce((nearest: Phaser.Physics.Arcade.Sprite | null, enemy: Phaser.Physics.Arcade.Sprite) => {
                const distance = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
                if (distance < this.towerData.range && (!nearest || distance < Phaser.Math.Distance.Between(this.x, this.y, nearest.x, nearest.y))) {
                    return enemy;
                }
                return nearest;
            }, null);

            if (nearestEnemy && currentTime - this.lastShotTime >= this.shootCooldown) {
                (this.scene as GameScene).shootProjectile(this, nearestEnemy, this.towerData);
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

    getHealth(): number {
        return this.health;
    }
} 