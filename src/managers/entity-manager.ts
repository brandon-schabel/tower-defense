import Phaser from "phaser";
import GameScene from "../scenes/game-scene";
import Player from "../entities/player";
import Base from "../entities/base";
import Tower from "../entities/tower";
import Enemy from "../entities/enemy";
import { GAME_SETTINGS } from "../settings";
import { EnemyType } from "../types/enemy-type";
import EntityFactory from "../factories/entity-factory";
import ServiceLocator from "../utils/service-locator";
import TileMapManager from "./tile-map-manager";
import { EventBus } from "../utils/event-bus";
import RoundManager from "./round-manager";

export default class EntityManager {
    private scene: GameScene;
    private user!: Player;
    private base!: Base;
    private enemies?: Phaser.Physics.Arcade.Group;
    private towers?: Phaser.Physics.Arcade.Group;
    private projectiles?: Phaser.Physics.Arcade.Group;
    private entityFactory!: EntityFactory;
    private gameOverHandled = false;

    constructor(scene: GameScene) {
        this.scene = scene;
        this.initialize();
        
        // Register with service locator
        ServiceLocator.getInstance().register('entityManager', this);
    }

    private initialize(): void {
        // Initialize entity factory and groups
        this.entityFactory = new EntityFactory(this.scene);
        this.enemies = this.scene.physics.add.group();
        this.towers = this.scene.physics.add.group();
        this.projectiles = this.scene.physics.add.group();

        // Create base
        const tileMapManager = ServiceLocator.getInstance().get<TileMapManager>('tileMapManager');
        if (!tileMapManager) {
            console.error("TileMapManager not found in service locator");
            return;
        }
        
        const basePos = tileMapManager.tileToWorld(
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
        if (!this.enemies || !this.towers) return;

        const towersActive = this.towers.countActive(true);

        this.enemies.getChildren().forEach((obj) => {
            const enemy = obj as Enemy;
            if (!enemy.active) return;

            let newTarget: Phaser.Physics.Arcade.Sprite | null = null;

            // Check if player is very close (top priority for close range)
            const distToUser = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.user.x, this.user.y);
            if (distToUser < 100) {
                newTarget = this.user;
            }
            // Priority 1: Target towers if any exist
            else if (towersActive > 0) {
                const nearestTower = this.findNearestTower(enemy.x, enemy.y, Infinity);
                if (nearestTower) {
                    const distToTower = Phaser.Math.Distance.Between(enemy.x, enemy.y, nearestTower.x, nearestTower.y);
                    if (distToTower < 500) { // Only target towers within reasonable range
                        newTarget = nearestTower;
                    }
                }
            }

            // Priority 2: Target base if no towers in range
            if (!newTarget && this.base.active) {
                newTarget = this.base;
            }

            enemy.setData("target", newTarget);
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
        if (this.gameOverHandled) return;
        
        const roundManager = ServiceLocator.getInstance().get<RoundManager>('roundManager');
        if (!roundManager || roundManager.getRoundState() !== 'combat') return;

        const tier = Math.min(roundManager.getCurrentRound() + 1, 5);
        const startPos = this.findValidStartPosition();

        if (!startPos) {
            console.warn("[EntityManager] No valid start position found for enemy.");
            return;
        }

        const eventBus = ServiceLocator.getInstance().get<EventBus>('eventBus');
        
        const onEnemyDeath = () => {
            if (this.gameOverHandled) return;
            if (eventBus) {
                eventBus.emit('enemy-killed', startPos.x, startPos.y);
            }
            if (roundManager) {
                roundManager.enemyDefeated();
            }
        };

        const enemy = this.entityFactory.createEnemy(startPos.x, startPos.y, enemyType, tier, onEnemyDeath);
        if (enemy && this.enemies) {
            this.enemies.add(enemy);
            enemy.setData('target', this.base);
        }
    }

    public createProjectile(x: number, y: number, texture: string): Phaser.Physics.Arcade.Sprite {
        if (!this.projectiles) {
            console.error("Projectiles group not initialized");
            this.projectiles = this.scene.physics.add.group();
        }

        // Create the projectile sprite
        const projectile = this.scene.physics.add.sprite(x, y, texture);
        this.projectiles.add(projectile);

        // Set the origin to 0.5, 0.5 to make rotation work properly around the center
        projectile.setOrigin(0.5, 0.5);

        // Store the base values we'll need for consistent scaling
        const BASE_RADIUS = 65; // Use your known working value
        projectile.setData('baseRadius', BASE_RADIUS);

        // Initial hitbox setup
        projectile.body.setCircle(BASE_RADIUS);

        projectile.setActive(true);
        projectile.setVisible(true);
        return projectile;
    }

    public removeTower(tower: Tower): void {
        this.towers?.remove(tower, true, true);
    }

    public gameOver(): void {
        if (this.gameOverHandled) return;
        this.gameOverHandled = true;

        this.scene.physics.pause();
        this.enemies?.clear(true, true);
        this.towers?.clear(true, true);
        this.projectiles?.clear(true, true);

        const gameOverText = this.scene.add.text(
            Number(this.scene.game.config.width) / 2,
            Number(this.scene.game.config.height) / 2,
            "Game Over!",
            { fontSize: "64px", color: "#ff0000" }
        ).setOrigin(0.5);

        this.scene.time.delayedCall(3000, () => {
            this.scene.scene.restart({ isNewGame: true });
            this.scene.game.events.emit('end-game');
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
        // Get map dimensions from tile manager
        const tileMapManager = ServiceLocator.getInstance().get<TileMapManager>('tileMapManager');
        if (!tileMapManager) {
            console.error("TileMapManager not found in service locator");
            return { x: 0, y: 0 }; // Default fallback
        }
        
        const mapWidth = tileMapManager.getMapWidth() || 100; // Default to 100 if undefined
        const mapHeight = tileMapManager.getMapHeight() || 100; // Default to 100 if undefined

        // Randomly choose an edge (0 = top, 1 = right, 2 = bottom, 3 = left)
        const edge = Phaser.Math.Between(0, 3);

        let tileX: number;
        let tileY: number;
        const margin = 2; // Keep a small margin from the absolute edge

        switch (edge) {
            case 0: // Top edge
                tileX = Phaser.Math.Between(margin, mapWidth - margin);
                tileY = margin;
                break;
            case 1: // Right edge
                tileX = mapWidth - margin;
                tileY = Phaser.Math.Between(margin, mapHeight - margin);
                break;
            case 2: // Bottom edge
                tileX = Phaser.Math.Between(margin, mapWidth - margin);
                tileY = mapHeight - margin;
                break;
            case 3: // Left edge
                tileX = margin;
                tileY = Phaser.Math.Between(margin, mapHeight - margin);
                break;
            default:
                // Fallback to a safe position if something goes wrong
                tileX = margin;
                tileY = margin;
        }

        // Make sure position is not occupied
        if (!tileMapManager.isTileAvailable(tileX, tileY, 1, 1)) {
            // If position isn't available, try again with recursive call
            // (with a limit to prevent infinite recursion)
            return this.findValidStartPosition();
        }

        // Convert tile position to world position
        return tileMapManager.tileToWorld(tileX, tileY);
    }

    private chooseEnemyType(): EnemyType {
        // As rounds progress, introduce stronger enemies
        const roundManager = ServiceLocator.getInstance().get<RoundManager>('roundManager');
        const currentRound = roundManager ? roundManager.getCurrentRound() : 0;
        
        const availableTypes: EnemyType[] = [EnemyType.Normal];

        if (currentRound >= 3) {
            availableTypes.push(EnemyType.Fast);
        }

        if (currentRound >= 5) {
            availableTypes.push(EnemyType.Tank);
        }

        if (currentRound >= 7) {
            availableTypes.push(EnemyType.Boss);
        }

        // Higher chance for special enemies in later rounds
        if (currentRound > 10) {
            availableTypes.push(EnemyType.Fast, EnemyType.Tank); // Add extra entries to increase probability
        }

        return Phaser.Math.RND.pick(availableTypes);
    }
}