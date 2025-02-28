import GameScene from "../scenes/game-scene";
import Player from "../entities/player/player";
import Tower from "../entities/tower/tower";
import Enemy from "../entities/enemy/enemy";
import Base from "../entities/base/base";
import PowerUp, { PowerUpType } from "../entities/powerups/powerup";
import Crate from "../entities/crate/crate";
import { GAME_SETTINGS, TowerType } from "../settings";
import { EnemyType } from "../entities/enemy/enemy-type";
import { CrateContents, CrateType } from "../types/crate-types";
import { gameConfig } from "../utils/app-config";
import TileMapManager from "../managers/tile-map-manager";
import { EventBus } from "../core/event-bus";
import EntityManager from "../managers/entity-manager";
import CombatSystem from "../systems/combat-system";
import ItemDropManager from "../managers/item-drop-manager";
import GameState from "../utils/game-state";

/**
 * Define the EnemyAbility interface outside the class
 */
interface EnemyAbility {
  type: string;
  data: any; // Refine this based on actual ability data
}

/**
 * Factory class for creating game entities with standardized initialization.
 * This centralizes entity creation logic and ensures consistent patterns.
 */
export default class EntityFactory {
  private scene: GameScene;
  private tileMapManager: TileMapManager;
  private eventBus: EventBus;
  private entityManager: EntityManager | null = null;
  private combatSystem: CombatSystem | null = null;
  private itemDropManager: ItemDropManager | null = null;
  private gameState: GameState | null = null;

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
   * Set entity manager after it's been created (to avoid circular dependencies)
   */
  setEntityManager(entityManager: EntityManager): void {
    this.entityManager = entityManager;
  }

  /**
   * Set combat system after it's been created (to avoid circular dependencies)
   */
  setCombatSystem(combatSystem: CombatSystem): void {
    this.combatSystem = combatSystem;
  }
  
  /**
   * Set item drop manager after it's been created 
   */
  setItemDropManager(itemDropManager: ItemDropManager): void {
    this.itemDropManager = itemDropManager;
  }
  
  /**
   * Set game state after it's been created
   */
  setGameState(gameState: GameState): void {
    this.gameState = gameState;
  }

  /**
   * Create a player entity
   */
  createPlayer(x: number, y: number): Player {
    if (!this.entityManager || !this.combatSystem || !this.itemDropManager) {
      throw new Error("Required dependencies not set in EntityFactory");
    }
    
    const player = new Player(
      this.scene, 
      x, 
      y, 
      this.eventBus,
      this.combatSystem,
      this.itemDropManager
    );
    return player;
  }

  /**
   * Create a base entity
   */
  createBase(x: number, y: number): Base {
    const base = new Base(
      this.scene, 
      x, 
      y, 
      this.eventBus
    );
    return base;
  }

  /**
   * Create a tower entity
   */
  createTower(tileX: number, tileY: number, type: TowerType): Tower {
    if (!this.entityManager || !this.combatSystem) {
      throw new Error("EntityManager or CombatSystem not set in EntityFactory");
    }
    
    const tower = new Tower(
      this.scene, 
      tileX, 
      tileY, 
      type, 
      this.tileMapManager,
      this.eventBus,
      this.entityManager,
      this.combatSystem
    );
    return tower;
  }

  /**
   * Create an enemy entity
   */
  createEnemy(
    x: number,
    y: number,
    type: EnemyType = EnemyType.Basic,
    tier: number = 1,
    onDeath: () => void = () => { }
  ): Enemy | undefined {
    if (!this.entityManager || !this.combatSystem || !this.itemDropManager || !this.tileMapManager) {
      throw new Error("Required dependencies not set in EntityFactory");
    }
    
    // Get enemy config based on type and tier
    const enemyConfig = this.getEnemyConfig(type, tier);
    if (!enemyConfig) {
      console.error(`Error: Enemy config not found for type ${type}, tier ${tier}`);
      return undefined;
    }

    const enemy = new Enemy(
      this.scene,
      x,
      y,
      enemyConfig.health,
      enemyConfig.speed,
      onDeath,
      this.eventBus,
      this.itemDropManager,
      this.combatSystem,
      this.entityManager,
      this.tileMapManager,
      type,
      tier
    );

    // Add special abilities if configured
    if (enemyConfig.abilities) {
      enemyConfig.abilities.forEach((ability: EnemyAbility) => {
        enemy.addSpecialAbility(ability.type, ability.data);
      });
    }

    return enemy;
  }

  /**
   * Create a power-up entity
   */
  createPowerUp(x: number, y: number, type: PowerUpType): PowerUp {
    if (!this.entityManager || !this.gameState) {
      throw new Error("Required dependencies not set in EntityFactory");
    }
    
    const player = this.entityManager.getUser();
    
    const powerUp = new PowerUp(
      this.scene, 
      x, 
      y, 
      type, 
      this.eventBus,
      player,
      this.gameState
    );
    return powerUp;
  }

  /**
   * Create a crate entity
   */
  createCrate(
    tileX: number,
    tileY: number,
    type: CrateType = CrateType.Wood,
    health: number = 50,
    contents: CrateContents = { resources: 50 }
  ): Crate {
    if (!this.itemDropManager || !this.gameState) {
      throw new Error("Required dependencies not set in EntityFactory");
    }
    
    let crateContents: CrateContents; // Use a separate variable for contents
    switch (type) {
      case CrateType.Wood: crateContents = { resources: 20 }; break;
      case CrateType.Metal: crateContents = { resources: 50 }; break;
      case CrateType.Gold: crateContents = { resources: 100, items: [] }; break; // Ensure items is initialized as array if needed
      default: crateContents = contents; // Default to provided contents if type is not matched
    }
    
    const crate = new Crate(
      this.scene, 
      tileX, 
      tileY, 
      type,
      this.tileMapManager,
      this.eventBus,
      this.itemDropManager,
      this.gameState,
      health, 
      crateContents
    );
    return crate;
  }

  /**
   * Get enemy configuration based on type and tier
   * @private
   */
  private getEnemyConfig(type: EnemyType, tier: number): { health: number; speed: number; damage: number; abilities: EnemyAbility[] } | undefined {
    // Get the enemy settings from GAME_SETTINGS directly based on type
    const enemyTypeKey = this.getEnemyTypeKey(type);
    
    if (!enemyTypeKey) {
      console.error(`Enemy type ${type} not found in GAME_SETTINGS.`);
      return undefined;
    }
    
    // Get the enemy config
    const enemySettings = GAME_SETTINGS.enemies[enemyTypeKey];
    
    if (!enemySettings) {
      console.error(`Enemy settings not found for type ${type}`);
      return undefined;
    }
    
    // Calculate health based on baseHealth and tier
    const health = enemySettings.baseHealth + (enemySettings.healthIncrementPerRound * (tier - 1));
    
    return {
      health,
      speed: enemySettings.speed,
      damage: enemySettings.damageToPlayer,
      abilities: enemySettings.abilities || []
    };
  }

  private getEnemyTypeKey(type: EnemyType): keyof typeof GAME_SETTINGS.enemies | undefined {
    // Get enemy type key as string
    return type.toString() as keyof typeof GAME_SETTINGS.enemies;
  }
}