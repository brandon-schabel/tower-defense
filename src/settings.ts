import { EnemyType } from "./types/enemy-type";

export enum DifficultyLevel {
    Easy = 'easy',
    Medium = 'medium',
    Hard = 'hard'
}

// Add difficulty multipliers to settings
export const DIFFICULTY_SETTINGS = {
    [DifficultyLevel.Easy]: {
        enemyHealthMultiplier: 0.8,
        enemySpeedMultiplier: 0.8,
        enemyCountMultiplier: 0.7,
        resourceMultiplier: 1.2
    },
    [DifficultyLevel.Medium]: {
        enemyHealthMultiplier: 1.0,
        enemySpeedMultiplier: 1.0,
        enemyCountMultiplier: 1.0,
        resourceMultiplier: 1.0
    },
    [DifficultyLevel.Hard]: {
        enemyHealthMultiplier: 1.3,
        enemySpeedMultiplier: 1.2,
        enemyCountMultiplier: 1.5,
        resourceMultiplier: 0.8
    }
};

export interface EnemyConfig {
    baseCount: number;
    countIncrementPerRound: number;
    maxCount: number;
    baseHealth: number;
    healthIncrementPerRound: number;
    speed: number;
    damageToPlayer: number;
    damageToBase: number;
    attackDistance: number;
    abilities?: { type: string; data: any }[];
}



type ProjectileSettings = {
    texture: string;
    damage: number;
    slow?: boolean;
    critical?: boolean;
}

const PROJECTILE_SETTINGS = {
    normal: { texture: 'projectile', damage: 10 },
    fire: { texture: 'projectile-fire', damage: 15 },
    ice: { texture: 'projectile-ice', damage: 10, slow: true },
    critical: { texture: 'projectile-critical', damage: 20, critical: true }
} satisfies { [key: string]: ProjectileSettings };

export type ProjectileType = keyof typeof PROJECTILE_SETTINGS;

type PowerUpSettings = {
    texture: string;
    duration?: number;
    value: number;
}

const POWER_UP_SETTINGS = {
    'attack-speed': { texture: 'powerup-speed', duration: 20000, value: 2 },
    'damage': { texture: 'powerup-damage', duration: 15000, value: 2 },
    'range': { texture: 'powerup-range', duration: 30000, value: 1.5 },
    'health': { texture: 'powerup-health', value: 50 },
    'invincibility': { texture: 'powerup-invincibility', duration: 10000, value: 1 },
    'resources': { texture: 'powerup-resources', value: 100 }
} satisfies { [key: string]: PowerUpSettings };

export type PowerUpType = keyof typeof POWER_UP_SETTINGS;


// --- Game Settings ---

type MapSettings = {
    tileSize: number;
    width: number;
    height: number;
    terrainTexture: string;
    decorationCount: number;
}

const MAP_SETTINGS: MapSettings = {
    tileSize: 32,
    width: 75,
    height: 75,
    terrainTexture: 'terrain-tiles',
    decorationCount: 100
};

type PlayerSettings = {
    initialHealth: number;
    movementSpeed: number;
    shootCooldown: number;
    shootRange: number;
    projectileDamage: number;
    pickupRange: number;
}

const PLAYER_SETTINGS: PlayerSettings = {
    initialHealth: 100,
    movementSpeed: 150,
    shootCooldown: 500,
    shootRange: 200,
    projectileDamage: 20,
    pickupRange: 50
};

export type TowerSettings = {
    name: string;
    texture: string;
    projectileType: ProjectileType;
    damage: number;
    range: number;
    shootCooldown: number;
    price: number;
    health: number;
    scale: number;
    size: { width: number; height: number };
}

const TOWER_SETTINGS = {
    'normal-tower': {
        name: 'Normal Tower',
        texture: 'normal-tower',
        projectileType: 'normal',
        damage: 20,
        range: 200,
        shootCooldown: 1000,
        price: 100,
        health: 100,
        scale: 1,
        size: { width: 1, height: 1 }
    },
    'sniper-tower': {
        name: 'Sniper Tower',
        texture: 'sniper-tower',
        projectileType: 'normal',
        damage: 30,
        range: 300,
        shootCooldown: 1500,
        price: 150,
        health: 80,
        scale: 1,
        size: { width: 1, height: 1 }
    },
    'area-tower': {
        name: 'Area Tower',
        texture: 'area-tower',
        projectileType: 'normal',
        damage: 10,
        range: 150,
        shootCooldown: 500,
        price: 120,
        health: 120,
        scale: 1,
        size: { width: 2, height: 2 }
    }
} satisfies { [key: string]: TowerSettings };

export type TowerType = keyof typeof TOWER_SETTINGS;


type DifficultySettings = {
    enemyHealthMultiplier: number;
    enemyDamageMultiplier: number;
    resourceMultiplier: number;
}

const DIFFICULTY_MULTIPLIER_SETTINGS = {
    easy: {
        enemyHealthMultiplier: 0.8,
        enemyDamageMultiplier: 0.8,
        resourceMultiplier: 1.2
    },
    medium: {
        enemyHealthMultiplier: 1,
        enemyDamageMultiplier: 1,
        resourceMultiplier: 1
    },
    hard: {
        enemyHealthMultiplier: 1.2,
        enemyDamageMultiplier: 1.2,
        resourceMultiplier: 0.8
    }
} satisfies { [key: string]: DifficultySettings };

type BaseSettings = {
    initialHealth: number;
    size: { width: number; height: number };
    color: number;
    position: { x: number; y: number };
}

const BASE_SETTINGS: BaseSettings = {
    initialHealth: 100,
    size: { width: 100, height: 100 },
    color: 0x0000ff,
    position: { x: 400, y: 300 },
};

type ResourceSettings = {
    initialAmount: number;
    perEnemyKillBase: number;
    perRoundCompletionBase: number;
}

const RESOURCE_SETTINGS: ResourceSettings = {
    initialAmount: 100,
    perEnemyKillBase: 5,
    perRoundCompletionBase: 100,
};

type GameSettings = {
    itemDropChance: number;
    game: {
        enemyTargetRecalculationInterval: number;
    };
    map: MapSettings;
    player: PlayerSettings;
    towers: { [key: string]: TowerSettings };
    enemies: { [key in EnemyType]: EnemyConfig };
    difficulties: { [key: string]: DifficultySettings };
    base: BaseSettings;
    resources: ResourceSettings;
    powerUps: { [key: string]: PowerUpSettings };
    projectiles: { [key: string]: ProjectileSettings };
    debug: {
        enabled: boolean;       // Master switch for all debugging
        showFPS: boolean;       // Display frames per second
        showPhysics: boolean;   // Show physics bodies
        showInput: boolean;     // Show input states (mouse, keyboard)
        showPaths: boolean;     // Show enemy paths
        showRanges: boolean;    // Show tower ranges
    };
}

const ENEMY_SETTINGS = {
    [EnemyType.Normal]: {
        baseCount: 5,
        countIncrementPerRound: 2,
        maxCount: 20,
        baseHealth: 50,
        healthIncrementPerRound: 10,
        speed: 50,
        damageToPlayer: 10,
        damageToBase: 20,
        attackDistance: 50
    } as EnemyConfig,
    [EnemyType.Fast]: {
        baseCount: 3,
        countIncrementPerRound: 1,
        maxCount: 15,
        baseHealth: 30,
        healthIncrementPerRound: 8,
        speed: 80,
        damageToPlayer: 5,
        damageToBase: 10,
        attackDistance: 40
    } as EnemyConfig,
    [EnemyType.Strong]: {
        baseCount: 2,
        countIncrementPerRound: 1,
        maxCount: 10,
        baseHealth: 80,
        healthIncrementPerRound: 15,
        speed: 40,
        damageToPlayer: 15,
        damageToBase: 30,
        attackDistance: 60,
        abilities: [{ type: 'armor', data: { reduction: 0.2 } }] // 20% damage reduction
    } as EnemyConfig,
    [EnemyType.Tank]: {
        baseCount: 1,
        countIncrementPerRound: 0.5, // Example of fractional increment
        maxCount: 5,
        baseHealth: 150,
        healthIncrementPerRound: 25,
        speed: 30,
        damageToPlayer: 20,
        damageToBase: 40,
        attackDistance: 70,
        abilities: [
            { type: 'armor', data: { reduction: 0.3 } }, // 30% damage reduction
            { type: 'regen', data: { rate: 2, interval: 1000 } } // Regenerate 2 health every 1 second
        ]
    } as EnemyConfig,
    [EnemyType.Basic]: {
        baseCount: 5,
        countIncrementPerRound: 2,
        maxCount: 20,
        baseHealth: 40, // Example values
        healthIncrementPerRound: 5,
        speed: 45,
        damageToPlayer: 8,
        damageToBase: 15,
        attackDistance: 45,
    } as EnemyConfig,
    [EnemyType.Flying]: {
        baseCount: 3,
        countIncrementPerRound: 1,
        maxCount: 10,
        baseHealth: 25, // Example values
        healthIncrementPerRound: 5,
        speed: 60,
        damageToPlayer: 5,
        damageToBase: 10,
        attackDistance: 100, // Can attack from further away
        abilities: [{ type: 'flying', data: {} }], // Indicate it's a flying unit
    } as EnemyConfig,
    [EnemyType.Heavy]: {
        baseCount: 1,
        countIncrementPerRound: 0.5,
        maxCount: 5,
        baseHealth: 100,
        healthIncrementPerRound: 20,
        speed: 30,
        damageToPlayer: 10,
        damageToBase: 20,
        attackDistance: 50,
        abilities: [{ type: 'heavy', data: {} }] // Indicate it's a heavy unit
    } as EnemyConfig,
    [EnemyType.Boss]: {
        baseCount: 1,
        countIncrementPerRound: 0.5,
        maxCount: 5,
        baseHealth: 1000,
        healthIncrementPerRound: 200,
        speed: 20,
        damageToPlayer: 20,
        damageToBase: 40,
        attackDistance: 100,
        abilities: [{ type: 'boss', data: {} }] // Indicate it's a boss unit
    } as EnemyConfig,

} satisfies { [key in EnemyType]: EnemyConfig };


export const GAME_SETTINGS: GameSettings = {
    itemDropChance: 0.3,
    game: {
        enemyTargetRecalculationInterval: 1000,
    },
    map: MAP_SETTINGS,
    player: PLAYER_SETTINGS,
    towers: TOWER_SETTINGS,
    enemies: ENEMY_SETTINGS,
    difficulties: DIFFICULTY_MULTIPLIER_SETTINGS,
    base: BASE_SETTINGS,
    resources: RESOURCE_SETTINGS,
    powerUps: POWER_UP_SETTINGS,
    projectiles: PROJECTILE_SETTINGS,
    debug: {
        enabled: false,    // Debugging off by default
        showFPS: false,    // FPS display off
        showPhysics: false, // Physics debug off
        showInput: false,  // Input debug off
        showPaths: false,  // Path debug off
        showRanges: false  // Range debug off
    }
};
