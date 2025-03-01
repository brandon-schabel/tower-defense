import Phaser from "phaser";
import { GameScene } from "../../scenes/game-scene";
import { HealthComponent } from "../components/health-component";
import { EnemyType } from "./enemy-type";
import { Player } from "../player/player";
import { Tower } from "../tower/tower";
import { Base }  from "../base/base";
import { EventBus } from "../../core/event-bus";
import { ItemDropManager } from "../../managers/item-drop-manager";
import { CollisionSystem }  from "../../systems/collision-system";
import { EntityManager } from "../../managers/entity-manager";
import { MovementComponent } from "../components/movement-component";
import { TileMapManager } from "../../managers/tile-map-manager";

export class Enemy extends Phaser.Physics.Arcade.Sprite {
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
    private itemDropManager: ItemDropManager;
    private combatSystem: CollisionSystem;
    private entityManager: EntityManager;
    private gameScene: GameScene;
    private movementComponent: MovementComponent | null = null;
    private tileMapManager: TileMapManager;
    private currentTarget: Phaser.GameObjects.GameObject | null = null;

    constructor(
        scene: GameScene, 
        x: number, 
        y: number, 
        health: number, 
        speed: number, 
        onDeath: () => void, 
        eventBus: EventBus,
        itemDropManager: ItemDropManager,
        combatSystem: CollisionSystem,
        entityManager: EntityManager,
        tileMapManager: TileMapManager,
        type: EnemyType = EnemyType.Basic, 
        tier: number = 1
    ) {
        super(scene, x, y, `${type}-enemy`);
        this.setScale(0.5);
        this.onDeath = onDeath;

        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.gameScene = scene;
        this.eventBus = eventBus;
        this.itemDropManager = itemDropManager;
        this.combatSystem = combatSystem;
        this.entityManager = entityManager;
        this.tileMapManager = tileMapManager;

        this.healthComponent = new HealthComponent(
            this,
            scene,
            health,
            health,
            () => {
                // Mark as being destroyed to prevent further interactions
                this.setData('markedForDestruction', true);
                
                console.log(`Enemy ${this.id} died, calling removeEnemy`);
                
                // Cleanup timers
                if (this.burnTimer) this.burnTimer.remove();
                if (this.slowTimer) this.slowTimer.remove();

                // Execute callback first
                this.onDeath();
                
                // Handle drops
                this.handleDropsOnDeath();
                
                // Emit events before destroying
                this.eventBus.emit('enemy-killed', {
                    position: { x: this.x, y: this.y },
                    type: this.enemyType,
                    tier: this.tier
                });
                
                // Now handle proper removal from entity manager
                // This will handle the actual destroy() call
                this.entityManager.removeEnemy(this);
            }
        );

        this.setData("speed", speed);
        this.setData("lastDamageTime", 0);

        this.id = Enemy.nextId++;
        this.enemyType = type;
        this.tier = tier;
        
        // Initialize movement component with the injected tileMapManager
        this.movementComponent = new MovementComponent(this, scene, tileMapManager, speed);
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
                break;
        }
    }

    private findTarget(range: number): Phaser.Physics.Arcade.Sprite | null {
        const player = this.entityManager.getUser();
        const base = this.entityManager.getBase();
        
        // Get towers from entity manager
        const towerGroup = this.entityManager.getTowers();
        const towers = towerGroup ? towerGroup.getChildren() : [];

        let closestTarget: Phaser.Physics.Arcade.Sprite | null = null;
        let closestDistance = range;

        // Check distance to player
        const distToPlayer = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
        if (distToPlayer < closestDistance) {
            closestTarget = player;
            closestDistance = distToPlayer;
        }

        // Check distance to base
        const distToBase = Phaser.Math.Distance.Between(this.x, this.y, base.x, base.y);
        if (distToBase < closestDistance) {
            closestTarget = base;
            closestDistance = distToBase;
        }

        // Check distance to each tower
        towers.forEach(towerObj => {
            const tower = towerObj as Phaser.Physics.Arcade.Sprite;
            const distToTower = Phaser.Math.Distance.Between(this.x, this.y, tower.x, tower.y);
            if (distToTower < closestDistance) {
                closestTarget = tower;
                closestDistance = distToTower;
            }
        });

        return closestTarget;
    }

    private findTargetsInRadius(radius: number): Phaser.Physics.Arcade.Sprite[] {
        const targets: Phaser.Physics.Arcade.Sprite[] = [];
        
        const player = this.entityManager.getUser();
        const base = this.entityManager.getBase();
        const towerGroup = this.entityManager.getTowers();
        const towers = towerGroup ? towerGroup.getChildren() : [];

        // Check if player is in radius
        if (player && Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y) <= radius) {
            targets.push(player);
        }

        // Check if base is in radius
        if (base && Phaser.Math.Distance.Between(this.x, this.y, base.x, base.y) <= radius) {
            targets.push(base);
        }

        // Check if any towers are in radius
        towers.forEach(towerObj => {
            const tower = towerObj as Phaser.Physics.Arcade.Sprite;
            if (Phaser.Math.Distance.Between(this.x, this.y, tower.x, tower.y) <= radius) {
                targets.push(tower);
            }
        });

        return targets;
    }

    takeDamage(damage: number) {
        // Enhanced check to ensure valid state before taking damage
        if (!this.active || !this.scene || !this.body || this.getData('markedForDestruction')) {
            console.log(`Enemy ${this.id} cannot take damage - active: ${this.active}, hasScene: ${!!this.scene}, hasBody: ${!!this.body}, markedForDestruction: ${this.getData('markedForDestruction')}`);
            return; // Skip if destroyed, scene is null, no body, or already marked for destruction
        }

        console.log(`Enemy ${this.id} taking damage: ${damage}, current health: ${this.healthComponent.getHealth()}`);
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
                        if (this.burnTimer) {
                            this.burnTimer.remove();
                            this.burnTimer = null;
                        }
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
        // First clean up health component
        this.healthComponent.cleanup();
        
        // Make sure we're not in the physics system anymore by disabling the body
        if (this.body) {
            this.disableBody(true, true);
        }
        
        // Make sure we're properly marked as inactive
        this.setActive(false);
        this.setVisible(false);
        
        // Finally do the actual destroy
        super.destroy(fromScene);
    }

    setTarget(target: Phaser.GameObjects.GameObject): void {
        this.currentTarget = target;
        
        if (this.movementComponent) {
            this.movementComponent.moveToObject(target);
        }
    }

    getTarget(): Phaser.GameObjects.GameObject | null {
        return this.currentTarget;
    }

    createMovementComponent(speed: number): void {
        if (!this.movementComponent) {
            this.movementComponent = new MovementComponent(
                this, 
                this.gameScene, 
                this.tileMapManager,
                speed
            );
        }
    }

    moveToTarget(targetX: number, targetY: number): void {
        if (this.movementComponent) {
            this.movementComponent.moveTo(targetX, targetY);
        }
    }

    onPathfindingComplete(success: boolean): void {
        if (!success) {
            // If pathfinding failed, try again with a random position around the target
            const jitter = 32 * 3; // 3 tiles worth of jitter
            if (this.currentTarget) {
                // Cast to any to access x and y properties
                const target = this.currentTarget as any;
                const targetX = target.x + (Math.random() * jitter * 2 - jitter);
                const targetY = target.y + (Math.random() * jitter * 2 - jitter);
                
                if (this.movementComponent) {
                    this.movementComponent.moveTo(targetX, targetY);
                }
            }
        }
    }
}