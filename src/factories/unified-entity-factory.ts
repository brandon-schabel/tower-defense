import Phaser from "phaser";
import { GameScene } from "../scenes/game-scene";
import { Player } from "../entities/player/player";
import { Base } from "../entities/base/base";
import { Tower } from "../entities/tower/tower";
import { Enemy } from "../entities/enemy/enemy";
import { GAME_SETTINGS, TowerType } from "../settings";
import { EnemyType } from "../entities/enemy/enemy-type";
import { TileMapManager } from "../managers/tile-map-manager";
import { EventBus } from "../core/event-bus";
import { GameState } from "../utils/game-state";
import { ItemDropManager } from "../managers/item-drop-manager";
import { CollisionSystem } from "../systems/collision-system";
import { EntityManager } from "../managers/entity-manager";
import { DroppedItem, GameItem, ItemRarity, ItemType } from "../types/item";

/**
 * A unified factory that handles creation of all game entities.
 * This centralizes entity creation logic to reduce duplication.
 */
export class UnifiedEntityFactory {
    private scene: GameScene;
    private tileMapManager: TileMapManager;
    private eventBus: EventBus;
    private gameState?: GameState;
    private itemDropManager?: ItemDropManager;
    private collisionSystem?: CollisionSystem;
    private entityManager?: EntityManager;
    
    constructor(
        scene: GameScene, 
        tileMapManager: TileMapManager,
        eventBus: EventBus
    ) {
        this.scene = scene;
        this.tileMapManager = tileMapManager;
        this.eventBus = eventBus;
    }
    
    /**
     * Set optional dependencies after construction
     */
    public setDependencies(
        gameState?: GameState,
        itemDropManager?: ItemDropManager,
        collisionSystem?: CollisionSystem,
        entityManager?: EntityManager
    ): void {
        this.gameState = gameState;
        this.itemDropManager = itemDropManager;
        this.collisionSystem = collisionSystem;
        this.entityManager = entityManager;
    }
    
    /**
     * Create a player entity
     */
    public createPlayer(x: number, y: number): Player {
        // Ensure we have required dependencies
        if (!this.collisionSystem) {
            throw new Error("Cannot create player: CollisionSystem dependency is missing");
        }
        
        if (!this.itemDropManager) {
            throw new Error("Cannot create player: ItemDropManager dependency is missing");
        }
        
        console.log(`[EntityFactory] Creating player at ${x}, ${y}`);
        
        // Create player entity
        const player = new Player(
            this.scene,
            x,
            y,
            this.eventBus,
            this.collisionSystem,
            this.itemDropManager
        );
        
        // Add physics
        this.scene.physics.world.enable(player);
        console.log(`[EntityFactory] Player physics enabled: ${player.body ? 'Yes' : 'No'}`);
        
        // Set collision properties - use setCollideWorldBounds method directly on player
        player.setCollideWorldBounds(true);
        
        // Ensure visibility
        player.setVisible(true);
        player.setActive(true);
        
        // Debug appearance
        const debugCircle = this.scene.add.circle(x, y, 30, 0xffff00, 0.5);
        this.scene.time.delayedCall(5000, () => debugCircle.destroy());
        
        // Register with tile map
        this.tileMapManager.occupyTiles(
            Math.floor(x / this.tileMapManager.getTileSize()),
            Math.floor(y / this.tileMapManager.getTileSize()),
            1,
            1,
            'player',
            'player'
        );
        
        // Emit event
        this.eventBus.emit('player-created', player);
        console.log(`[EntityFactory] Player created: ${player.x}, ${player.y}, visible: ${player.visible}, texture: ${player.texture.key}`);
        
        return player;
    }
    
    /**
     * Create a base entity
     */
    public createBase(x: number, y: number): Base {
        console.log(`[EntityFactory] Creating base at ${x}, ${y}`);
        
        const base = new Base(
            this.scene,
            x,
            y,
            this.eventBus
        );
        
        // Add physics
        this.scene.physics.world.enable(base);
        console.log(`[EntityFactory] Base physics enabled: ${base.body ? 'Yes' : 'No'}`);
        
        // Ensure visibility
        base.setVisible(true);
        base.setActive(true);
        
        // Debug appearance
        const debugCircle = this.scene.add.circle(x, y, 50, 0xff0000, 0.5);
        this.scene.time.delayedCall(5000, () => debugCircle.destroy());
        
        // Register with tile map
        const tileX = Math.floor(x / this.tileMapManager.getTileSize());
        const tileY = Math.floor(y / this.tileMapManager.getTileSize());
        const baseWidth = 3;
        const baseHeight = 3;
        
        this.tileMapManager.occupyTiles(
            tileX - Math.floor(baseWidth / 2),
            tileY - Math.floor(baseHeight / 2),
            baseWidth,
            baseHeight,
            'base',
            'base'
        );
        
        // Emit event
        this.eventBus.emit('base-created', base);
        console.log(`[EntityFactory] Base created: ${base.x}, ${base.y}, visible: ${base.visible}, texture: ${base.texture.key}`);
        
        return base;
    }
    
    /**
     * Create a tower entity
     */
    public createTower(tileX: number, tileY: number, towerType: TowerType): Tower {
        // Ensure required dependencies are available
        if (!this.entityManager) {
            throw new Error("Cannot create tower: EntityManager dependency is missing");
        }
        
        if (!this.collisionSystem) {
            throw new Error("Cannot create tower: CollisionSystem dependency is missing");
        }
        
        // Get tower data
        const towerData = GAME_SETTINGS.towers[towerType];
        
        // Calculate world position - store as local position for use below
        const worldX = (tileX + 0.5) * this.tileMapManager.getTileSize();
        const worldY = (tileY + 0.5) * this.tileMapManager.getTileSize();
        
        // Create tower instance
        const tower = new Tower(
            this.scene,
            tileX,
            tileY,
            towerType,
            this.tileMapManager,
            this.eventBus,
            this.entityManager,
            this.collisionSystem
        );
        
        // Add physics
        this.scene.physics.world.enable(tower);
        
        // Register with tile map
        this.tileMapManager.occupyTiles(
            tileX,
            tileY,
            towerData.size.width,
            towerData.size.height,
            'tower',
            tower.getId()
        );
        
        // Emit event
        this.eventBus.emit('tower-created', tower);
        
        // Update game state
        if (this.gameState) {
            this.gameState.incrementTowersBuilt();
        }
        
        return tower;
    }
    
    /**
     * Create an enemy entity
     */
    public createEnemy(
        x: number, 
        y: number, 
        enemyType: EnemyType,
        tier: number = 1,
        onDeath?: () => void
    ): Enemy {
        // Ensure dependencies are available
        if (!this.itemDropManager || !this.collisionSystem || !this.entityManager) {
            throw new Error("Cannot create enemy: Required dependencies are missing");
        }
        
        // Default values for health and speed
        const defaultHealth = 100;
        const defaultSpeed = 100;
        
        // Get health and speed with safe access
        let health = defaultHealth;
        let speed = defaultSpeed;
        
        // Try to get enemy settings if they exist
        if (GAME_SETTINGS.enemies && GAME_SETTINGS.enemies[enemyType]) {
            const settings = GAME_SETTINGS.enemies[enemyType];
            // Use type assertion to access potentially undefined properties
            const enemyConfig = settings as unknown as { 
                baseHealth?: number; 
                health?: number; 
                baseSpeed?: number; 
                speed?: number;
            };
            
            health = enemyConfig.baseHealth || enemyConfig.health || defaultHealth;
            speed = enemyConfig.baseSpeed || enemyConfig.speed || defaultSpeed;
        }
        
        // Apply tier multipliers (if any)
        if (tier > 1) {
            health *= (1 + (tier - 1) * 0.5); // 50% more health per tier
            speed *= (1 + (tier - 1) * 0.1); // 10% more speed per tier
        }
        
        // Apply difficulty multipliers if game state is available
        if (this.gameState) {
            const healthMultiplier = this.gameState.getEnemyHealthMultiplier();
            const speedMultiplier = this.gameState.getEnemySpeedMultiplier();
            
            // Apply multipliers
            health *= healthMultiplier;
            speed *= speedMultiplier;
        }
        
        // Create enemy instance with all required parameters
        const enemy = new Enemy(
            this.scene,
            x,
            y,
            health,
            speed,
            onDeath || (() => {}),
            this.eventBus,
            this.itemDropManager,
            this.collisionSystem,
            this.entityManager,
            this.tileMapManager,
            enemyType,
            tier
        );
        
        // Set unique ID for tracking
        enemy.setData('id', `enemy_${Date.now()}_${Math.floor(Math.random() * 1000)}`);
        
        // Add physics
        this.scene.physics.world.enable(enemy);
        
        // Set collision properties - use setCollideWorldBounds method directly on enemy
        enemy.setCollideWorldBounds(true);
        
        // Emit event
        this.eventBus.emit('enemy-created', enemy);
        
        return enemy;
    }
    
    /**
     * Create a projectile
     */
    public createProjectile(
        x: number, 
        y: number, 
        source: Phaser.Physics.Arcade.Sprite,
        targetX: number,
        targetY: number,
        damage: number,
        projectileType: string = 'normal'
    ): Phaser.Physics.Arcade.Sprite | null {
        // Delegate to collision system if available
        if (this.collisionSystem) {
            return this.collisionSystem.shootProjectile(
                source,
                targetX,
                targetY,
                damage,
                projectileType
            );
        }
        
        // Fallback implementation if collision system not available
        const projectile = this.scene.physics.add.sprite(x, y, 'projectile');
        projectile.setData('damage', damage);
        projectile.setData('source', source);
        projectile.setData('type', projectileType);
        
        // Set angle and velocity
        const angle = Phaser.Math.Angle.Between(x, y, targetX, targetY);
        const speed = 400;
        this.scene.physics.velocityFromRotation(angle, speed, projectile.body.velocity);
        
        // Set rotation
        projectile.rotation = angle;
        
        // Destroy after 5 seconds
        this.scene.time.delayedCall(5000, () => {
            projectile.destroy();
        });
        
        return projectile;
    }
    
    /**
     * Create a dropped item
     */
    public createDroppedItem(
        item: GameItem, 
        x: number, 
        y: number, 
        quantity: number = 1
    ): DroppedItem | null {
        // Delegate to item drop manager if available
        if (this.itemDropManager) {
            return this.itemDropManager.dropItem(item, x, y, quantity);
        }
        
        return null;
    }
    
    /**
     * Create a random item drop
     */
    public createRandomDrop(
        x: number, 
        y: number
    ): DroppedItem | null {
        // Delegate to item drop manager if available
        if (this.itemDropManager) {
            return this.itemDropManager.dropRandomItem(x, y);
        }
        
        return null;
    }
    
    /**
     * Create a random resource item
     */
    public createResourceItem(tier: number = 1): GameItem {
        const resourceAmount = Math.floor(Math.random() * 30) + 10; // 10-40 resources
        const rarityTier = Math.min(5, Math.max(1, tier));
        const rarities = [
            ItemRarity.COMMON,
            ItemRarity.UNCOMMON,
            ItemRarity.RARE,
            ItemRarity.EPIC,
            ItemRarity.LEGENDARY
        ];
        const rarity = rarities[rarityTier - 1] || ItemRarity.COMMON;
        
        // Match texture name to what's loaded in preload
        let textureName = 'resource-small';
        if (rarityTier >= 3) {
            textureName = 'resource-medium';
        } else if (rarityTier >= 5) {
            textureName = 'resource-large';
        }
        
        return {
            id: `resource_${Date.now()}`,
            name: `${rarity} Resource Cache`,
            description: `Contains ${resourceAmount} resources.`,
            texture: textureName,
            type: ItemType.RESOURCE,
            rarity,
            value: resourceAmount,
            stackable: true
        };
    }
}