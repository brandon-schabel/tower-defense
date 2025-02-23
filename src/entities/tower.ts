import Phaser from "phaser";
import GameScene from "../scenes/game-scene";
import { TOWER_TYPES } from "../ui/hud";

export default class Tower extends Phaser.Physics.Arcade.Sprite {
    private towerType: string;
    private towerData: typeof TOWER_TYPES[keyof typeof TOWER_TYPES];
    private lastShotTime: number = 0;
    private shootCooldown: number = 500; // 500ms between shots
    private healthBar: Phaser.GameObjects.Graphics;
    private health: number = 100;
    private maxHealth: number = 100;

    constructor(scene: GameScene, x: number, y: number, type: string) {
        super(scene, x, y, type);
        
        this.towerType = type;
        this.towerData = TOWER_TYPES[type];
        
        scene.add.existing(this);
        scene.physics.add.existing(this, true); // true = static body
        this.setOrigin(0.5, 0.5); // Center the sprite

        // Create health bar
        this.healthBar = scene.add.graphics();
        this.healthBar.setDepth(100); // Ensure health bar is above other elements
        this.updateHealthBar();
    }

    update() {
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
    }

    takeDamage(amount: number) {
        this.health = Math.max(0, this.health - amount);
        this.updateHealthBar();
        
        if (this.health <= 0) {
            this.healthBar.destroy();
            this.destroy();
        }
    }

    getHealth(): number {
        return this.health;
    }

    private updateHealthBar() {
        this.healthBar.clear();

        // Background of health bar
        this.healthBar.fillStyle(0xff0000);
        this.healthBar.fillRect(this.x - 25, this.y - 40, 50, 5);

        // Health remaining
        this.healthBar.fillStyle(0x00ff00);
        this.healthBar.fillRect(
            this.x - 25,
            this.y - 40,
            Math.max(0, (this.health / this.maxHealth) * 50),
            5
        );
    }
} 