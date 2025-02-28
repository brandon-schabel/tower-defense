import Phaser from "phaser";
import GameScene from "../scenes/game-scene";
import Player from "../entities/player/player";
import Base from "../entities/base/base";
import Tower from "../entities/tower/tower";
import Enemy from "../entities/enemy/enemy";
import { GAME_SETTINGS } from "../settings";
import { EnemyType } from "../entities/enemy/enemy-type";
import EntityFactory from "../factories/entity-factory";
import TileMapManager from "./tile-map-manager";
import { EventBus } from "../core/event-bus";
import GameState from "../utils/game-state";
import ItemDropManager from "./item-drop-manager";
import CombatSystem from "../systems/combat-system";

export default class EntityManager {
    private scene: GameScene;
    private user!: Player;
    private base!: Base;
    private enemies?: Phaser.Physics.Arcade.Group;
    private towers?: Phaser.Physics.Arcade.Group;
    private projectiles?: Phaser.Physics.Arcade.Group;
    private entityFactory!: EntityFactory;
    private gameOverHandled = false;
    private tileMapManager: TileMapManager;
    private eventBus: EventBus;
    private gameState: GameState;
    private itemDropManager: ItemDropManager | null = null;
    private combatSystem: CombatSystem | null = null;

    constructor(
        scene: GameScene,
        tileMapManager: TileMapManager,
        eventBus: EventBus,
        gameState: GameState
    ) {
        this.scene = scene;
        this.tileMapManager = tileMapManager;
        this.eventBus = eventBus;
        this.gameState = gameState;
        this.initialize();
    }

    private initialize(): void {
        // Initialize entity factory and groups
        this.entityFactory = new EntityFactory(this.scene, this.tileMapManager, this.eventBus);
        this.enemies = this.scene.physics.add.group();
        this.towers = this.scene.physics.add.group();
        this.projectiles = this.scene.physics.add.group({
            classType: Phaser.Physics.Arcade.Sprite,
            runChildUpdate: true
        });

        // Set entity manager in factory (to avoid circular dependency)
        this.entityFactory.setEntityManager(this);

        // Create base
        const basePos = this.tileMapManager.tileToWorld(
            Math.floor(GAME_SETTINGS.map.width / 2),
            Math.floor(GAME_SETTINGS.map.height / 2)
        );
        
        // Note: We'll fully initialize the factory after we've set all dependencies
    }
    
    /**
     * Sets the item drop manager reference
     */
    public setItemDropManager(itemDropManager: ItemDropManager): void {
        this.itemDropManager = itemDropManager;
        if (this.entityFactory) {
            this.entityFactory.setItemDropManager(itemDropManager);
        }
    }
    
    /**
     * Sets the combat system reference
     */
    public setCombatSystem(combatSystem: CombatSystem): void {
        this.combatSystem = combatSystem;
        if (this.entityFactory) {
            this.entityFactory.setCombatSystem(combatSystem);
        }
    }
    
    /**
     * Completes initialization after all dependencies are set
     */
    public completeInitialization(): void {
        if (!this.itemDropManager || !this.combatSystem) {
            console.error("Cannot complete initialization - missing dependencies");
            return;
        }
        
        // Set game state in factory
        this.entityFactory.setGameState(this.gameState);
        
        // Create base
        const basePos = this.tileMapManager.tileToWorld(
            Math.floor(GAME_SETTINGS.map.width / 2),
            Math.floor(GAME_SETTINGS.map.height / 2)
        );
        this.base = this.entityFactory.createBase(basePos.x, basePos.y);

        // Create player
        const playerStart = this.findValidStartPosition();
        this.user = this.entityFactory.createPlayer(playerStart.x, playerStart.y);

        // Setup recalculation timer
        this.scene.time.addEvent({
            delay: GAME_SETTINGS.game.enemyTargetRecalculationInterval,
            callback: () => this.recalculateEnemyTargets(),
            loop: true
        });
    }

    public getUser(): Player {
        return this.user;
    }

    public getBase(): Base {
        return this.base;
    }

    public getEnemies(): Phaser.Physics.Arcade.Sprite[] {
        if (!this.enemies) return [];

        return this.enemies.getChildren().filter(obj => {
            return obj.active && obj instanceof Enemy;
        }) as Phaser.Physics.Arcade.Sprite[];
    }

    public getEnemiesGroup(): Phaser.Physics.Arcade.Group | undefined {
        return this.enemies;
    }

    public getTowers(): Phaser.Physics.Arcade.Group | undefined {
        return this.towers;
    }

    public getProjectiles(): Phaser.Physics.Arcade.Group | undefined {
        return this.projectiles;
    }

    public findNearestTower(x: number, y: number, range: number): Phaser.Physics.Arcade.Sprite | null {
        if (!this.towers) return null;

        let nearest: Phaser.Physics.Arcade.Sprite | null = null;
        let nearestDistance = range;

        (this.towers.getChildren() as Phaser.Physics.Arcade.Sprite[]).forEach(towerSprite => {
            const distance = Phaser.Math.Distance.Between(x, y, towerSprite.x, towerSprite.y);
            if (distance < nearestDistance) {
                nearest = towerSprite;
                nearestDistance = distance;
            }
        });

        return nearest;
    }

    public recalculateEnemyTargets(): void {
        if (!this.enemies) return;

        this.enemies.getChildren().forEach(obj => {
            const enemy = obj as Enemy;
            if (!enemy.active) return;

            // Get current target
            const currentTarget = enemy.getData('target') as Phaser.Physics.Arcade.Sprite;
            
            // Skip if target is still valid
            if (currentTarget && currentTarget.active) return;

            // Find new target
            const playerDistance = Phaser.Math.Distance.Between(
                enemy.x, enemy.y, this.user.x, this.user.y
            );

            // Check if player is in range (using a constant value as fallback)
            const playerDetectionRange = 300; // Fallback value
            if (playerDistance < playerDetectionRange) {
                enemy.setData('target', this.user);
                return;
            }

            // Find nearest tower
            const towerDetectionRange = 500; // Fallback value
            const nearestTower = this.findNearestTower(
                enemy.x, enemy.y, 
                towerDetectionRange
            );

            if (nearestTower) {
                enemy.setData('target', nearestTower);
                return;
            }

            // Default to base if no other targets
            enemy.setData('target', this.base);
        });
    }

    public updateEnemies(): void {
        if (!this.enemies) return;

        this.enemies.getChildren().forEach(gameObj => {
            const enemy = gameObj as Enemy;
            if (!enemy || !enemy.active) return;

            const target = enemy.getData('target') as Phaser.Physics.Arcade.Sprite | null;

            if (!target || !target.active) {
                this.recalculateEnemyTargets();
                return;
            }

            const targetX = target.x;
            const targetY = target.y;
            const angle = Phaser.Math.Angle.Between(
                enemy.x,
                enemy.y,
                targetX,
                targetY
            );

            const enemyType = enemy.getData('type') as EnemyType || this.chooseEnemyType();
            const defaultSpeed = GAME_SETTINGS.enemies[enemyType]?.speed || 100;
            const speed = enemy.getData('speed') || defaultSpeed;

            const body = enemy.body as Phaser.Physics.Arcade.Body;
            if (body) {
                this.scene.physics.velocityFromRotation(angle, speed, body.velocity);
                enemy.rotation = angle;
            }

            const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, targetX, targetY);
            const attackRange = enemy.getData('attackRange') || 20;

            if (distance <= attackRange) {
                if (body) {
                    body.setVelocity(0, 0);
                }
                const attackFunc = enemy.getData('attack');
                if (attackFunc && typeof attackFunc === 'function') {
                    attackFunc(target);
                }
            }
        });
    }

    public spawnEnemy(enemyType: EnemyType): void {
        if (!this.itemDropManager || !this.combatSystem) {
            console.error("Cannot spawn enemy - missing dependencies");
            return;
        }
        
        // Find spawn point
        const spawnPoint = this.tileMapManager.getEnemySpawnPoint();
        if (!spawnPoint) {
            console.error("No valid enemy spawn point found");
            return;
        }

        // Create enemy
        const onEnemyDeath = () => {
            // Award resources based on enemy type
            let reward = 10; // Default reward
            
            // Use a type-safe approach to access enemy rewards
            try {
                // Access the enemy config as a generic object to avoid type errors
                const enemyConfig = GAME_SETTINGS.enemies[enemyType] as any;
                if (enemyConfig && typeof enemyConfig === 'object') {
                    // Try to get the reward from various possible property names
                    reward = enemyConfig.reward || 
                             enemyConfig.resourceReward || 
                             enemyConfig.resources || 
                             reward;
                }
            } catch (error) {
                console.warn(`Error getting reward for enemy type ${enemyType}:`, error);
            }
            
            this.gameState.earnResources(reward);
            
            // Emit event
            this.eventBus.emit('enemy-killed', spawnPoint.x, spawnPoint.y);
            
            // Update UI
            this.eventBus.emit('update-resources');
        };

        const enemy = this.entityFactory.createEnemy(
            spawnPoint.x, spawnPoint.y,
            enemyType,
            1, // tier
            onEnemyDeath
        );

        if (enemy && this.enemies) {
            this.enemies.add(enemy);
            // Setting target via setter method rather than data
            enemy.setTarget(this.base);
            
            // Force a refresh of collision detection when a new enemy is spawned
            if (this.combatSystem) {
                // Emit the event to refresh collisions
                console.log(`Refreshing collisions after spawning enemy ${enemy.id}`);
                this.eventBus.emit('refresh-collisions', {});
            }
        }
    }

    public createProjectile(x: number, y: number, texture: string): Phaser.Physics.Arcade.Sprite {
        if (!this.projectiles) {
            console.error("Projectiles group not initialized");
            this.projectiles = this.scene.physics.add.group({
                classType: Phaser.Physics.Arcade.Sprite,
                runChildUpdate: true
            });
        }

        // Create the projectile sprite
        const projectile = this.scene.physics.add.sprite(x, y, texture);
        
        // Ensure it has physics enabled
        if (!projectile.body) {
            this.scene.physics.world.enable(projectile);
        }
        
        // Add to the group after ensuring it has a body
        this.projectiles.add(projectile);

        // Set the origin to 0.5, 0.5 to make rotation work properly around the center
        projectile.setOrigin(0.5, 0.5);

        // Store the base values we'll need for consistent scaling
        const BASE_RADIUS = 8; // Using a smaller radius for better collision detection
        projectile.setData('baseRadius', BASE_RADIUS);

        // Initial hitbox setup - ensure we're setting a proper circular body
        if (projectile.body) {
            projectile.body.setCircle(BASE_RADIUS);
            
            // Enable the body for collision detection
            projectile.body.enable = true;
            
            // Set as a sensor (trigger overlap events without physical collision)
            // projectile.body.isSensor = true;
        }

        projectile.setActive(true);
        projectile.setVisible(true);
        
        // Debug identification
        projectile.setData('id', Math.floor(Math.random() * 10000));
        projectile.setData('creationTime', this.scene.time.now);
        
        return projectile;
    }

    public removeTower(tower: Tower): void {
        this.towers?.remove(tower, true, true);
    }

    public gameOver(): void {
        if (this.gameOverHandled) return;
        this.gameOverHandled = true;

        // Show game over message
        this.scene.showMessage('Game Over!', 0xff0000, '48px');

        // Disable player controls
        if (this.user) {
            this.user.setActive(false);
        }

        // Stop all enemies
        if (this.enemies) {
            this.enemies.getChildren().forEach(enemy => {
                (enemy as Phaser.Physics.Arcade.Sprite).setVelocity(0, 0);
                (enemy as Phaser.Physics.Arcade.Sprite).setActive(false);
            });
        }

        // Emit game over event
        this.eventBus.emit('game-over');

        // Return to main menu after delay
        this.scene.time.delayedCall(3000, () => {
            this.scene.scene.start('MainMenuScene');
        });
    }

    public update(): void {
        // Update all entities
        if (this.user && this.user.active) this.user.update();
        this.updateEnemies();

        this.enemies?.getChildren().forEach(enemy => {
            if (enemy.active && enemy instanceof Enemy) enemy.update();
        });

        this.towers?.getChildren().forEach(tower => {
            if (tower.active && tower instanceof Tower) tower.update();
        });
    }

    private findValidStartPosition(): { x: number, y: number } {
        const baseX = this.base.x;
        const baseY = this.base.y;
        const minDistance = 200; // Minimum distance from base
        const maxDistance = 300; // Maximum distance from base
        
        let x, y, distance;
        let attempts = 0;
        const maxAttempts = 50;
        
        do {
            // Get random position within map bounds
            const tileX = Phaser.Math.Between(2, GAME_SETTINGS.map.width - 3);
            const tileY = Phaser.Math.Between(2, GAME_SETTINGS.map.height - 3);
            
            // Convert to world coordinates
            const worldPos = this.tileMapManager.tileToWorld(tileX, tileY);
            x = worldPos.x;
            y = worldPos.y;
            
            // Calculate distance from base
            distance = Phaser.Math.Distance.Between(x, y, baseX, baseY);
            attempts++;
            
            // Check if position is valid (not occupied and within distance range)
            if (distance >= minDistance && distance <= maxDistance && 
                this.tileMapManager.isTileAvailable(tileX, tileY, 1, 1)) {
                return { x, y };
            }
        } while (attempts < maxAttempts);
        
        // Fallback position if no valid position found
        return { 
            x: baseX + minDistance, 
            y: baseY 
        };
    }

    private chooseEnemyType(): EnemyType {
        // Get current round from the scene
        const currentRound = this.scene.getCurrentRound();
        
        // Simple logic: higher rounds introduce more enemy types
        if (currentRound > 15) {
            return Phaser.Math.RND.pick([
                EnemyType.Normal, 
                EnemyType.Fast, 
                EnemyType.Heavy, 
                EnemyType.Boss,
                EnemyType.Flying
            ]);
        } else if (currentRound > 10) {
            return Phaser.Math.RND.pick([
                EnemyType.Normal, 
                EnemyType.Fast, 
                EnemyType.Heavy, 
                EnemyType.Boss
            ]);
        } else if (currentRound > 5) {
            return Phaser.Math.RND.pick([
                EnemyType.Normal, 
                EnemyType.Fast, 
                EnemyType.Heavy
            ]);
        } else if (currentRound > 2) {
            return Phaser.Math.RND.pick([
                EnemyType.Normal, 
                EnemyType.Fast
            ]);
        } else {
            return EnemyType.Normal;
        }
    }

    public removeEnemy(enemy: Enemy): void {
        if (!this.enemies) return;
        
        console.log(`Removing enemy ${enemy.id}, active enemies before removal: ${this.enemies.countActive()}`);
        
        // First remove from the group
        this.enemies.remove(enemy, true, true);
        
        // Make sure it's not in the physics system
        if (enemy.body) {
            enemy.disableBody(true, true);
        }
        
        // Destroy the enemy after it's removed from the group
        enemy.destroy();

        // Immediately force a refresh of collision detection
        if (this.combatSystem) {
            this.eventBus.emit('refresh-collisions', {});
            console.log(`Refresh collisions event emitted after enemy ${enemy.id} removal. Active enemies: ${this.enemies ? this.enemies.countActive() : 0}`);
        }
    }
}