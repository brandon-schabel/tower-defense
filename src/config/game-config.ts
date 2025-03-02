/**
 * Game Configuration File
 * Contains core Phaser configuration, constants, and game settings
 * Central configuration for game dimensions, difficulty settings, tower types, enemy types,
 * economy values, UI settings, and balance constants
 * 
 * Most Recent Changes:
 * - Updated tower texture keys to match available asset filenames (normal-tower, area-tower, laser-tower)
 * - Consolidated game-config.ts and constants.ts into a single source of truth
 * - Standardized TowerType and EnemyType enums
 * - Added backward compatibility for CONSTANTS namespace
 */

import Phaser from 'phaser';

// Core Phaser game configuration
export const GameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  parent: 'game-container',
  backgroundColor: '#242424',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false
    }
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  pixelArt: false,
  // Scenes will be added in main.ts
};

// Game dimensions and base settings
export const GAME_TITLE = 'Tower Defense Game';
export const DEBUG_MODE = false;
export const DEFAULT_WIDTH = 1280;
export const DEFAULT_HEIGHT = 720;
export const MIN_WIDTH = 800;
export const MIN_HEIGHT = 600;

// Enum definitions
export enum Difficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
}

export enum TowerType {
  BASIC = 'BASIC',
  SNIPER = 'SNIPER',
  SPLASH = 'SPLASH',
  SLOW = 'SLOW',
  // Legacy/alternative names
  NORMAL = 'BASIC',
  AREA = 'SPLASH'
}

export enum EnemyType {
  BASIC = 'BASIC',
  FAST = 'FAST',
  TANK = 'TANK',
  BOSS = 'BOSS',
  // Legacy/alternative names
  STRONG = 'TANK',
  FLYING = 'FAST'
}

// Difficulty settings
export const DifficultySettings = {
  [Difficulty.EASY]: {
    enemyHealthMultiplier: 0.75,
    enemySpeedMultiplier: 0.8,
    enemyCountMultiplier: 0.8,
    resourceMultiplier: 1.2
  },
  [Difficulty.MEDIUM]: {
    enemyHealthMultiplier: 1.0,
    enemySpeedMultiplier: 1.0,
    enemyCountMultiplier: 1.0,
    resourceMultiplier: 1.0
  },
  [Difficulty.HARD]: {
    enemyHealthMultiplier: 1.5,
    enemySpeedMultiplier: 1.2,
    enemyCountMultiplier: 1.3,
    resourceMultiplier: 0.8
  }
};

// Game economy settings
export const PLAYER_CONFIG = {
  startingGold: 500,
  startingLives: 20,
  goldPerSecond: 5,
  interestRate: 0.1 // 10% interest on gold per wave
};

// Enemy types and their properties
export const ENEMY_TYPES = {
  [EnemyType.BASIC]: {
    health: 100,
    speed: 80,
    damage: 1,
    reward: 10,
    texture: 'basic-enemy'
  },
  [EnemyType.FAST]: {
    health: 50,
    speed: 120,
    damage: 1,
    reward: 15,
    texture: 'fast-enemy'
  },
  [EnemyType.TANK]: {
    health: 300,
    speed: 40,
    damage: 2,
    reward: 25,
    texture: 'tank-enemy'
  },
  [EnemyType.BOSS]: {
    health: 1000,
    speed: 30,
    damage: 5,
    reward: 100,
    texture: 'boss-enemy'
  }
};

// Tower types and their properties
export const TOWER_TYPES = {
  [TowerType.BASIC]: {
    damage: 20,
    range: 150,
    attackSpeed: 1, // attacks per second
    cost: 100,
    texture: 'normal-tower',
    projectile: 'projectile-basic',
    upgrades: {
      2: {
        damage: 30,
        range: 160,
        attackSpeed: 1.2,
        cost: 50
      },
      3: {
        damage: 45,
        range: 170,
        attackSpeed: 1.5,
        cost: 100
      }
    }
  },
  [TowerType.SNIPER]: {
    damage: 100,
    range: 250,
    attackSpeed: 0.5,
    cost: 150,
    texture: 'sniper-tower',
    projectile: 'projectile-sniper',
    upgrades: {
      2: {
        damage: 150,
        range: 275,
        attackSpeed: 0.6,
        cost: 75
      },
      3: {
        damage: 225,
        range: 300,
        attackSpeed: 0.7,
        cost: 150
      }
    }
  },
  [TowerType.SPLASH]: {
    damage: 15,
    range: 120,
    attackSpeed: 0.8,
    cost: 175,
    splashRadius: 50,
    texture: 'area-tower',
    projectile: 'projectile-splash',
    upgrades: {
      2: {
        damage: 25,
        range: 130,
        attackSpeed: 0.9,
        splashRadius: 60,
        cost: 85
      },
      3: {
        damage: 40,
        range: 140,
        attackSpeed: 1,
        splashRadius: 70,
        cost: 170
      }
    }
  },
  [TowerType.SLOW]: {
    damage: 10,
    range: 130,
    attackSpeed: 1,
    cost: 125,
    slowEffect: 0.5, // 50% slow
    slowDuration: 2000, // 2 seconds
    texture: 'laser-tower',
    projectile: 'projectile-slow',
    upgrades: {
      2: {
        damage: 15,
        range: 140,
        slowEffect: 0.4, // 60% slow
        slowDuration: 2500,
        cost: 65
      },
      3: {
        damage: 20,
        range: 150,
        slowEffect: 0.3, // 70% slow
        slowDuration: 3000,
        cost: 130
      }
    }
  }
};

// Wave configuration
export const WAVE_CONFIG = {
  initialDelay: 10000, // 10 seconds before first wave
  timeBetweenWaves: 20000, // 20 seconds between waves
  enemySpawnInterval: 1000, // 1 second between enemy spawns
  baseEnemyCount: 10,
  enemyCountMultiplier: 1.25,
  waves: [
    {
      enemies: [
        { type: EnemyType.BASIC, count: 10 }
      ]
    },
    {
      enemies: [
        { type: EnemyType.BASIC, count: 15 },
        { type: EnemyType.FAST, count: 5 }
      ]
    },
    {
      enemies: [
        { type: EnemyType.BASIC, count: 10 },
        { type: EnemyType.FAST, count: 10 },
        { type: EnemyType.TANK, count: 3 }
      ]
    },
    {
      enemies: [
        { type: EnemyType.BASIC, count: 15 },
        { type: EnemyType.FAST, count: 15 },
        { type: EnemyType.TANK, count: 5 }
      ]
    },
    {
      enemies: [
        { type: EnemyType.BASIC, count: 20 },
        { type: EnemyType.FAST, count: 15 },
        { type: EnemyType.TANK, count: 10 },
        { type: EnemyType.BOSS, count: 1 }
      ]
    }
  ]
};

// Map configuration
export const MAP_CONFIG = {
  tileSize: 32, // Size of each map tile in pixels
  tiles: {
    path: 0,
    buildable: 1,
    obstacle: 2,
    water: 3,
    start: 4,
    end: 5
  },

  // Default map layout (can be overridden by level-specific maps)
  defaultMap: [
    [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    [2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2],
    [2, 1, 4, 0, 0, 0, 0, 0, 0, 0, 1, 2],
    [2, 1, 2, 2, 2, 2, 2, 2, 2, 0, 1, 2],
    [2, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 2],
    [2, 2, 2, 2, 2, 2, 2, 2, 1, 0, 1, 2],
    [2, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 2],
    [2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2],
    [2, 1, 0, 2, 2, 2, 2, 2, 2, 2, 1, 2],
    [2, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 2],
    [2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 5, 2],
    [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]
  ]
};

// UI configuration
export const UI_CONFIG = {
  fontSize: {
    small: '14px',
    medium: '18px',
    large: '24px',
    title: '32px'
  },
  colors: {
    primary: '#ffffff',
    secondary: '#cccccc',
    highlight: '#ffcc00',
    background: '#333333',
    button: '#4a6fa5',
    buttonHover: '#6c8ebd',
    health: '#00ff00',
    damage: '#ff0000',
    gold: '#ffcc00'
  },
  padding: 10,
  margin: 5,
  borderRadius: 5
};

// Sound settings
export const SOUND_CONFIG = {
  defaultVolume: 0.7,
  musicVolume: 0.5
};

// Constants object for backward compatibility and organized access
export const CONSTANTS = {
  ECONOMY: {
    STARTING_RESOURCES: PLAYER_CONFIG.startingGold,
    STARTING_LIVES: PLAYER_CONFIG.startingLives,
    SELL_REFUND_RATE: 0.7, // Get 70% of tower cost back when selling
    INTEREST_RATE: PLAYER_CONFIG.interestRate // 10% interest on gold per wave
  },
  DIFFICULTY: {
    SCALING_FACTOR: 0.1 // 10% increase in difficulty per wave
  },
  TOWER: {
    MAX_LEVEL: 3
  },
  MAP: {
    TILE_SIZE: MAP_CONFIG.tileSize
  },
  WAVE: {
    BASE_ENEMY_COUNT: WAVE_CONFIG.baseEnemyCount,
    ENEMY_COUNT_MULTIPLIER: WAVE_CONFIG.enemyCountMultiplier
  }
}; 