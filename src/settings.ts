import { EnemyType } from "./entities/enemy/enemy-type";

export enum TowerType {
    Normal = 'normal',
    Sniper = 'sniper',
    Area = 'area',
    Laser = 'laser',
    Missile = 'missile'
}

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

// Define interfaces for type safety
interface PlayerSettings {
    initialHealth: number;
    movementSpeed: number;
    shootCooldown: number;
    damage: number;
    attackRange: number;
    inventorySize: number;
    scale: number;
    pickupRange: number;
    projectileDamage: number;
    shootRange: number;
}

interface EnemySettings {
    spawnRate: number;
    initialHealth: number;
    damage: number;
    movementSpeed: number;
    attackRange: number;
}

export interface TowerSettings {
    baseHealth: number;
    attackRange: number;
    attackSpeed: number;
    damage: number;
    cost: number;
    health: number;
    shootCooldown: number;
    range: number;
    scale: number;
    price: number;
    size: { width: number; height: number };
    projectileType: string;
    name: string;
    texture: string;
    fireRate: number;
}

export interface TowerConfig {
    name: string;
    texture: string;
    price: number;
    range: number;
    damage: number;
    fireRate: number;
    scale: number;
    size: { width: number; height: number };
    projectileType?: string;
    health: number;
    shootCooldown: number;
}

interface BaseSettings {
    initialHealth: number;
}

interface ResourceSettings {
    initialAmount: number;
    enemyDropAmount: {
        min: number;
        max: number;
    };
}

interface WaveSettings {
    initialDelay: number;
    delay: number;
    increaseFactor: number;
}

interface DropSettings {
    chance: number;
    crate: {
        spawnChance: number;
        minItems: number;
        maxItems: number;
    };
}

interface DebugSettings {
    enabled: boolean;
    showPhysics: boolean;
    showPaths: boolean;
    showRanges: boolean;
    showFPS: boolean;
    showInput: boolean;
}

interface GameSettings {
    width: number;
    height: number;
    backgroundColor: number;
    physics: {
        gravity: { x: number; y: number };
        debug: boolean;
    };
    player: PlayerSettings;
    enemy: EnemySettings;
    tower: TowerSettings;
    base: BaseSettings;
    resources: ResourceSettings;
    map: MapSettings;
    waves: WaveSettings;
    drops: DropSettings;
    towers: { [key in TowerType]: TowerConfig };
    itemDropChance: number;
    debug: DebugSettings;
    enemies: { [key in EnemyType]: EnemyConfig };
    game: {
        enemyTargetRecalculationInterval: number;
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
    width: 1280,
    height: 720,
    backgroundColor: 0x000000,
    physics: {
        gravity: { x: 0, y: 0 },
        debug: false
    },

    player: {
        initialHealth: 100,
        movementSpeed: 160,
        shootCooldown: 500,
        damage: 10,
        attackRange: 300,
        inventorySize: 20,
        scale: 1.0,
        pickupRange: 50,
        projectileDamage: 10,
        shootRange: 300
    },

    enemy: {
        spawnRate: 2000,
        initialHealth: 50,
        damage: 5,
        movementSpeed: 100,
        attackRange: 50
    },

    tower: {
        baseHealth: 500,
        attackRange: 200,
        attackSpeed: 1000,
        damage: 20,
        cost: 150,
        health: 500,
        shootCooldown: 500,
        range: 200,
        scale: 1.0,
        price: 150,
        size: { width: 32, height: 32 },
        projectileType: 'normal',
        name: 'Normal Tower',
        texture: 'tower-normal',
        fireRate: 1000
    },

    base: {
        initialHealth: 1000
    },

    resources: {
        initialAmount: 300,
        enemyDropAmount: {
            min: 10,
            max: 30
        }
    },

    map: MAP_SETTINGS,

    waves: {
        initialDelay: 10000,
        delay: 30000,
        increaseFactor: 1.2
    },

    drops: {
        chance: 0.3,
        crate: {
            spawnChance: 0.1,
            minItems: 1,
            maxItems: 3
        }
    },

    towers: {
        [TowerType.Normal]: {
            name: 'Normal Tower',
            texture: 'normal-tower',
            price: 100,
            range: 200,
            damage: 20,
            fireRate: 1000,
            scale: 1.0,
            size: { width: 32, height: 32 },
            projectileType: 'normal',
            health: 500,
            shootCooldown: 1000
        },
        [TowerType.Sniper]: {
            name: 'Sniper Tower',
            texture: 'sniper-tower',
            price: 150,
            range: 300,
            damage: 30,
            fireRate: 800,
            scale: 1.0,
            size: { width: 32, height: 32 },
            projectileType: 'normal',
            health: 500,
            shootCooldown: 800
        },
        [TowerType.Area]: {
            name: 'Area Tower',
            texture: 'area-tower',
            price: 200,
            range: 150,
            damage: 15,
            fireRate: 1200,
            scale: 1.0,
            size: { width: 32, height: 32 },
            projectileType: 'normal',
            health: 500,
            shootCooldown: 1200
        },
        [TowerType.Laser]: {
            name: 'Laser Tower',
            texture: 'laser-tower',
            price: 250,
            range: 250,
            damage: 40,
            fireRate: 1500,
            scale: 1.0,
            size: { width: 32, height: 32 },
            projectileType: 'normal',
            health: 500,
            shootCooldown: 1500
        },
        [TowerType.Missile]: {
            name: 'Missile Tower',
            texture: 'missile-tower',
            price: 300,
            range: 200,
            damage: 30,
            fireRate: 1000,
            scale: 1.0,
            size: { width: 32, height: 32 },
            projectileType: 'normal',
            health: 500,
            shootCooldown: 1000
        }
    },
    itemDropChance: 0.5,
    debug: {
        enabled: false,
        showPhysics: false,
        showPaths: false,
        showRanges: false,
        showFPS: false,
        showInput: false
    },
    enemies: ENEMY_SETTINGS,
    game: {
        enemyTargetRecalculationInterval: 1000 // Recalculate every 1 second
    }
};
