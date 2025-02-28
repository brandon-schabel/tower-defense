import Phaser from "phaser";
import GameScene from "../scenes/game-scene";
import { HealthComponent } from "./components/health-component";
import { EnemyType } from "./enemy/enemy-type";
import Player from "./player/player";
import Tower from "./tower/tower";
import Base from "./base/base";
import { EventBus } from "../core/event-bus";
import ItemDropManager from "../managers/item-drop-manager";
import CombatSystem from "../systems/combat-system";

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
    private eventBus: EventBus;
    private combatSystem: CombatSystem;
    private itemDropManager: ItemDropManager;
    private player: Player | null = null;
    private base: Base | null = null;

    constructor(
        scene: GameScene, 
        x: number, 
        y: number, 
        health: number, 
        speed: number, 
        onDeath: () => void, 
        eventBus: EventBus,
        combatSystem: CombatSystem,
        itemDropManager: ItemDropManager,
        player: Player | null = null,
        base: Base | null = null,
        type: EnemyType = EnemyType.Basic, 
        tier: number = 1
    ) {
        super(scene, x, y, `${type}-enemy`);
        this.setScale(0.5);
        this.onDeath = onDeath;

        scene.add.existing(this);
        scene.physics.add.existing(this);

        // Inject dependencies directly instead of using ServiceLocator
        this.eventBus = eventBus;
        this.combatSystem = combatSystem;
        this.itemDropManager = itemDropManager;
        this.player = player;
        this.base = base;

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
                
                // Emit enemy killed event
                this.eventBus.emit('enemy-killed', {
                    position: { x: this.x, y: this.y },
                    type: this.enemyType,
                    tier: this.tier
                });
            }
        );

        this.setData("speed", speed);
        this.setData("lastDamageTime", 0);

        this.id = Enemy.nextId++;
        this.enemyType = type;
        this.tier = tier;
        
        // Service locator registration removed
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
        // Use injected combatSystem directly
        switch (type) {
            case 'ranged':
                const target = this.findTarget(data.range);
                if (target && this.combatSystem) {
                    this.combatSystem.shootProjectile(this, target.x, target.y, data.damage);
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
        // Use injected player and base directly
        const towers: Phaser.Physics.Arcade.Sprite[] = [];

        let closestTarget: Phaser.Physics.Arcade.Sprite | null = null;
        let closestDistance = range;

        if (this.player) {
            const distToPlayer = Phaser.Math.Distance.Between(this.x, this.y, this.player.x, this.player.y);
            if (distToPlayer < closestDistance) {
                closestTarget = this.player;
                closestDistance = distToPlayer;
            }
        }

        towers.forEach((tower: Phaser.Physics.Arcade.Sprite) => {
            const dist = Phaser.Math.Distance.Between(this.x, this.y, tower.x, tower.y);
            if (dist < closestDistance) {
                closestTarget = tower;
                closestDistance = dist;
            }
        });

        if (this.base) {
            const distToBase = Phaser.Math.Distance.Between(this.x, this.y, this.base.x, this.base.y);
            if (distToBase < closestDistance) {
                closestTarget = this.base;
                closestDistance = distToBase;
            }
        }

        return closestTarget;
    }

    private findTargetsInRadius(radius: number): Phaser.Physics.Arcade.Sprite[] {
        const targets: Phaser.Physics.Arcade.Sprite[] = [];
        
        // Use injected player and base directly
        if (this.player && Phaser.Math.Distance.Between(this.x, this.y, this.player.x, this.player.y) <= radius) {
            targets.push(this.player);
        }

        if (this.base && Phaser.Math.Distance.Between(this.x, this.y, this.base.x, this.base.y) <= radius) {
            targets.push(this.base);
        }

        return targets;
    }

    takeDamage(damage: number) {
        if (!this.active || !this.scene) return; // Skip if destroyed or scene is null

        this.healthComponent.takeDamage(damage);
        
        // Emit damage event
        this.eventBus.emit('enemy-damaged', {
            id: this.id,
            damage: damage,
            remainingHealth: this.healthComponent.getHealth(),
            position: { x: this.x, y: this.y }
        });

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
        // Use injected itemDropManager directly
        if (!this.itemDropManager) return;

        this.itemDropManager.dropRandomItem(this.x, this.y);
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

    // Method to update player and base references if they change
    public updateReferences(player: Player | null, base: Base | null): void {
        this.player = player;
        this.base = base;
    }
}