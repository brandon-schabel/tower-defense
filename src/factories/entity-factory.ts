import GameScene from "../scenes/game-scene";
import Player from "../entities/player";
import Tower from "../entities/tower";
import Enemy from "../entities/enemy";
import Base from "../entities/base";
import PowerUp, { PowerUpType } from "../entities/power-up";
import Crate from "../entities/crate";
import { GAME_SETTINGS, TowerType,  } from "../settings";
import { EnemyType } from "../types/enemy-type";
import { CrateContents, CrateType } from "../types/crate-types";
import { gameConfig } from "../utils/app-config";

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

  constructor(scene: GameScene) {
    this.scene = scene;
  }

  /**
   * Create a player entity
   */
  createPlayer(x: number, y: number): Player {
    const player = new Player(this.scene, x, y);
    return player;
  }

  /**
   * Create a base entity
   */
  createBase(x: number, y: number): Base {
    const base = new Base(this.scene, x, y);
    return base;
  }

  /**
   * Create a tower entity
   */
  createTower(tileX: number, tileY: number, type: TowerType): Tower {
    const tower = new Tower(this.scene, tileX, tileY, type);
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
    const powerUp = new PowerUp(this.scene, x, y, type);
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
    let crateContents: CrateContents; // Use a separate variable for contents
    switch (type) {
      case CrateType.Wood: crateContents = { resources: 20 }; break;
      case CrateType.Metal: crateContents = { resources: 50 }; break;
      case CrateType.Gold: crateContents = { resources: 100, items: [] }; break; // Ensure items is initialized as array if needed
      default: crateContents = contents; // Default to provided contents if type is not matched
    }
    const crate = new Crate(this.scene, tileX, tileY, type, health, crateContents);
    return crate;
  }

  /**
   * Get enemy configuration based on type and tier
   * @private
   */
  private getEnemyConfig(type: EnemyType, tier: number): { health: number; speed: number; damage: number; abilities: EnemyAbility[] } | undefined {
    const enemySettings = gameConfig.getConfig("enemies");
    const enemyTypeKey = this.getEnemyTypeKey(type);

    if (!enemyTypeKey) {
      console.error(`Enemy type ${type} not found in GAME_SETTINGS.`);
      return undefined;
    }

    const baseConfig = enemySettings?.[enemyTypeKey];

    if (!baseConfig) {
      console.error(`Enemy type ${type} not found in GAME_SETTINGS.`);
      return undefined;
    }

    // Apply tier multipliers
    const tierMultiplier = 1 + (tier - 1) * 0.5; // 50% increase per tier

    return {
      health: Math.round(baseConfig.baseHealth * tierMultiplier),
      speed: baseConfig.speed * (1 + (tier - 1) * 0.2), // 20% speed increase per tier
      damage: Math.round(baseConfig.damageToPlayer * tierMultiplier),
      abilities: baseConfig.abilities ? [...baseConfig.abilities] : []
    };
  }

  private getEnemyTypeKey(type: EnemyType): keyof typeof GAME_SETTINGS.enemies | undefined {
    const lowerCaseType = type.toLowerCase();
    for (const key in GAME_SETTINGS.enemies) {
      if (key.toLowerCase() === lowerCaseType) {
        return key as keyof typeof GAME_SETTINGS.enemies;
      }
    }
    return undefined;
  }
}