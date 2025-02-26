import Phaser from "phaser";
import GameScene from "../scenes/game-scene";
import { HealthComponent } from "../utils/health-component";
import { EnemyType } from "../types/enemy-type";
import Player from "./player";
import Tower from "./tower";
import Base from "./base";

export default class Enemy extends Phaser.Physics.Arcade.Sprite {
    private healthComponent: HealthComponent;
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
        super(scene, x, y, `${type}-enemy`);
        this.setScale(0.5);
        this.onDeath = onDeath;

        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.healthComponent = new HealthComponent(
            this,
            scene,
            health,
            health,
            () => {
                if (this.burnTimer) this.burnTimer.remove();
                if (this.slowTimer) this.slowTimer.remove();

                this.handleDropsOnDeath();

                this.destroy();

                this.onDeath();
            }
        );

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
        this.healthComponent.update();

        const currentTime = this.scene.time.now;
        this.setData('type', this.enemyType);

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
                const target = this.findTarget(data.range);
                if (target) {
                    gameScene.shootProjectile(this, target, data.damage);
                }
                break;

            case 'aoe':
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

                const circle = this.scene.add.circle(this.x, this.y, data.range, 0xff0000, 0.3);
                this.scene.tweens.add({
                    targets: circle,
                    alpha: 0,
                    duration: 500,
                    onComplete: () => circle.destroy()
                });
                break;

            case 'summon':
                console.warn('Enemy summon ability not implemented - getEnemyFactory missing');
                break;
        }
    }

    private findTarget(range: number): Phaser.Physics.Arcade.Sprite | null {
        const gameScene = this.scene as GameScene;

        const player = gameScene.getUser();
        const towers: Phaser.Physics.Arcade.Sprite[] = [];

        const base = gameScene.getBase();

        let closestTarget: Phaser.Physics.Arcade.Sprite | null = null;
        let closestDistance = range;

        const distToPlayer = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
        if (distToPlayer < closestDistance) {
            closestTarget = player;
            closestDistance = distToPlayer;
        }

        towers.forEach((tower: Phaser.Physics.Arcade.Sprite) => {
            const dist = Phaser.Math.Distance.Between(this.x, this.y, tower.x, tower.y);
            if (dist < closestDistance) {
                closestTarget = tower;
                closestDistance = dist;
            }
        });

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

        const player = gameScene.getUser();
        if (Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y) <= radius) {
            targets.push(player);
        }

        const base = gameScene.getBase();
        if (Phaser.Math.Distance.Between(this.x, this.y, base.x, base.y) <= radius) {
            targets.push(base);
        }

        return targets;
    }

    takeDamage(damage: number) {
        if (!this.active || !this.scene) return; // Skip if destroyed or scene is null

        this.healthComponent.takeDamage(damage);

        // Visual feedback only if scene is available
        if (this.scene && this.scene.add) {
            const damageText = this.scene.add.text(
                this.x,
                this.y - 20,
                `-${damage}`,
                {
                    fontSize: '16px',
                    color: '#ff0000',
                    stroke: '#000000',
                    strokeThickness: 3
                }
            ).setOrigin(0.5);

            this.scene.tweens.add({
                targets: damageText,
                y: this.y - 40,
                alpha: 0,
                duration: 800,
                onComplete: () => damageText.destroy()
            });

            this.setTint(0xff0000);
            this.scene.time.delayedCall(100, () => {
                if (this.active) this.clearTint();
            });
        }
    }

    private handleDropsOnDeath(): void {
        const gameScene = this.scene as GameScene;
        const itemDropManager = gameScene.getItemDropManager();

        if (!itemDropManager) return;

        itemDropManager.dropRandomItem(this.x, this.y);
    }

    applyBurnEffect(burnDamage: number) {
        if (!this.isBurning) {
            this.isBurning = true;
            this.burnDamage = burnDamage;
            const burnInterval = 1000;
            const burnDuration = 5000;
            let ticks = 0;

            this.burnTimer = this.scene.time.addEvent({
                delay: burnInterval,
                callback: () => {
                    if (ticks < burnDuration / burnInterval) {
                        this.takeDamage(this.burnDamage);
                        ticks++;
                    } else {
                        this.isBurning = false;
                        if (this.burnTimer) this.burnTimer.remove();
                    }
                },
                loop: true
            });
        }
    }

    applySlowEffect(slowFactor: number, duration: number) {
        if (!this.isSlowed) {
            this.isSlowed = true;
            this.setData("slowFactor", slowFactor);
            this.slowTimer = this.scene.time.delayedCall(duration, () => {
                this.isSlowed = false;
                this.setData("slowFactor", 1);
            });
        }
    }

    public setOnDeath(callback: () => void): void {
        this.onDeath = callback;
    }

    getHealth(): number {
        return this.healthComponent.getHealth();
    }

    getMaxHealth(): number {
        return this.healthComponent.getMaxHealth();
    }

    getHealthPercentage(): number {
        return this.healthComponent.getHealthPercentage();
    }

    destroy(fromScene?: boolean) {
        this.healthComponent.cleanup();
        super.destroy(fromScene);
    }
}