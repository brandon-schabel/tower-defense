export const GAME_SETTINGS = {
    game: {
        enemyTargetRecalculationInterval: 1000, // ms, how often enemies recalculate targets
    },
    towers: {
        'normal-tower': {
            name: 'Normal Tower',
            texture: 'normal-tower',
            price: 100,
            range: 150,
            damage: 10,
            health: 100,
            shootCooldown: 500, // ms
            scale: 0.5,
            projectileType: 'normal',
        },
        'sniper-tower': {
            name: 'Sniper Tower',
            texture: 'sniper-tower',
            price: 200,
            range: 300,
            damage: 25,
            health: 80,
            shootCooldown: 1000, // ms
            scale: 0.5,
            projectileType: 'sniper',
        },
        'area-tower': {
            name: 'Area Tower',
            texture: 'area-tower',
            price: 150,
            range: 100,
            damage: 15,
            health: 120,
            shootCooldown: 2000, // ms
            scale: 0.5,
            projectileType: 'area',
        },
    },
    enemies: {
        baseCount: 5, // Starting number of enemies per round
        countIncrementPerRound: 2, // Additional enemies per round
        maxCount: 20, // Max enemies per round
        baseHealth: 50, // Starting health
        healthIncrementPerRound: 10, // Health increase per round
        speed: 2, // Movement speed
        damageToPlayer: 1,
        damageToTowers: 10,
        damageToBase: 10,
        spawnInterval: 1000, // ms between spawns
        attackCooldown: 1000, // ms between attacks
        attackDistance: 20, // Distance to stop and attack
    },
    player: {
        initialHealth: 100,
        movementSpeed: 200,
        shootRange: 200,
        shootCooldown: 200, // ms
        projectileDamage: 20,
        healPerRound: 20,
    },
    base: {
        initialHealth: 100,
        size: { width: 100, height: 100 }, // New: Base size
        color: 0x0000ff, // New: Base color (blue)
        position: { x: 400, y: 300 }, // New: Base position
    },
    resources: {
        initialAmount: 100,
        perEnemyKillBase: 5, // Base resources per kill, scaled by round
        perRoundCompletionBase: 100, // Base resources per round, scaled by round
    },
    projectiles: {
        speed: 300, // Pixels per second
        hitDistance: 5, // Distance to hit target
        normal: {
          speed: 300,
          damage: 10,
        },
        sniper: {
          speed: 600,
          damage: 25,
        },
        area: {
          speed: 200,
          damage: 15,
        },
        player: {
            speed: 400,
            damage: 20
        }
    },
} as const

export const TOWER_TYPES = Object.keys(GAME_SETTINGS.towers);
export type TowerType = keyof typeof GAME_SETTINGS.towers;

