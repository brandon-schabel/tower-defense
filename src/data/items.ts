import {
    ItemType,
    ItemRarity,
    ResourceItem,
    HealthItem,
    WeaponItem,
    BlueprintItem,
    UpgradeItem,
    GameItem
} from '../types/item';

// Resource items
export const RESOURCE_ITEMS: Record<string, ResourceItem> = {
    'small-resource': {
        id: 'small-resource',
        type: ItemType.RESOURCE,
        name: 'Small Resource Pack',
        description: 'A small bundle of resources',
        rarity: ItemRarity.COMMON,
        value: 10,
        texture: 'resource-small',
        stackable: true,
        resourceAmount: 10
    },
    'medium-resource': {
        id: 'medium-resource',
        type: ItemType.RESOURCE,
        name: 'Medium Resource Pack',
        description: 'A decent amount of resources',
        rarity: ItemRarity.UNCOMMON,
        value: 25,
        texture: 'resource-medium',
        stackable: true,
        resourceAmount: 25
    },
    'large-resource': {
        id: 'large-resource',
        type: ItemType.RESOURCE,
        name: 'Large Resource Pack',
        description: 'A substantial bundle of resources',
        rarity: ItemRarity.RARE,
        value: 50,
        texture: 'resource-large',
        stackable: true,
        resourceAmount: 50
    }
};

// Health items
export const HEALTH_ITEMS: Record<string, HealthItem> = {
    'small-health': {
        id: 'small-health',
        type: ItemType.HEALTH,
        name: 'Small Health Pack',
        description: 'Restores a small amount of health',
        rarity: ItemRarity.COMMON,
        value: 15,
        texture: 'health-small',
        stackable: true,
        healAmount: 20
    },
    'medium-health': {
        id: 'medium-health',
        type: ItemType.HEALTH,
        name: 'Medium Health Pack',
        description: 'Restores a moderate amount of health',
        rarity: ItemRarity.UNCOMMON,
        value: 30,
        texture: 'health-medium',
        stackable: true,
        healAmount: 50
    },
    'large-health': {
        id: 'large-health',
        type: ItemType.HEALTH,
        name: 'Large Health Pack',
        description: 'Restores a significant amount of health',
        rarity: ItemRarity.RARE,
        value: 60,
        texture: 'health-large',
        stackable: true,
        healAmount: 100
    }
};

// Weapon items
export const WEAPON_ITEMS: Record<string, WeaponItem> = {
    'basic-blaster': {
        id: 'basic-blaster',
        type: ItemType.WEAPON,
        name: 'Basic Blaster',
        description: 'A standard blaster with decent damage',
        rarity: ItemRarity.COMMON,
        value: 50,
        texture: 'weapon-blaster',
        stackable: false,
        damage: 15,
        range: 200,
        cooldown: 300,
        projectileType: 'player',
        tier: 1,
        properties: {
            damage: 15,
            range: 200,
            fireRate: 300,
        }
    },
    'rapid-shooter': {
        id: 'rapid-shooter',
        type: ItemType.WEAPON,
        name: 'Rapid Shooter',
        description: 'Fires quickly with lower damage',
        rarity: ItemRarity.UNCOMMON,
        value: 100,
        texture: 'weapon-rapid',
        stackable: false,
        damage: 10,
        range: 180,
        cooldown: 150,
        projectileType: 'player-rapid',
        tier: 1,
        properties: {
            damage: 10,
            range: 180,
            fireRate: 150,
        }
    },
    'power-cannon': {
        id: 'power-cannon',
        type: ItemType.WEAPON,
        name: 'Power Cannon',
        description: 'High damage but slow firing rate',
        rarity: ItemRarity.RARE,
        value: 150,
        texture: 'weapon-cannon',
        stackable: false,
        damage: 40,
        range: 250,
        cooldown: 800,
        projectileType: 'player-power',
        tier: 2,
        properties: {
            damage: 40,
            range: 250,
            fireRate: 800,
        }
    }
};

// Tower blueprints
export const TOWER_BLUEPRINT_ITEMS: Record<string, BlueprintItem> = {
    'normal-tower-blueprint': {
        id: 'normal-tower-blueprint',
        type: ItemType.BLUEPRINT,
        name: 'Normal Tower Blueprint',
        description: 'Allows building a Normal Tower at a discount',
        rarity: ItemRarity.UNCOMMON,
        value: 40,
        texture: 'blueprint-normal',
        stackable: true,
        towerType: 'normal-tower',
        towerTier: 1
    },
    'sniper-tower-blueprint': {
        id: 'sniper-tower-blueprint',
        type: ItemType.BLUEPRINT,
        name: 'Sniper Tower Blueprint',
        description: 'Allows building a Sniper Tower at a discount',
        rarity: ItemRarity.RARE,
        value: 80,
        texture: 'blueprint-sniper',
        stackable: true,
        towerType: 'sniper-tower',
        towerTier: 1
    },
    'area-tower-blueprint': {
        id: 'area-tower-blueprint',
        type: ItemType.BLUEPRINT,
        name: 'Area Tower Blueprint',
        description: 'Allows building an Area Tower at a discount',
        rarity: ItemRarity.RARE,
        value: 60,
        texture: 'blueprint-area',
        stackable: true,
        towerType: 'area-tower',
        towerTier: 1
    }
};

// Upgrade items
export const UPGRADE_ITEMS: Record<string, UpgradeItem> = {
    'tower-damage-boost': {
        id: 'tower-damage-boost',
        type: ItemType.UPGRADE,
        name: 'Tower Damage Boost',
        description: 'Increases tower damage by 10%',
        rarity: ItemRarity.UNCOMMON,
        value: 70,
        texture: 'upgrade-tower-damage',
        stackable: false,
        upgradeTarget: 'tower',
        upgradeProperty: 'damage',
        upgradeValue: 0.1 // 10% boost
    },
    'player-speed-boost': {
        id: 'player-speed-boost',
        type: ItemType.UPGRADE,
        name: 'Player Speed Boost',
        description: 'Increases player movement speed by 15%',
        rarity: ItemRarity.RARE,
        value: 90,
        texture: 'upgrade-player-speed',
        stackable: false,
        upgradeTarget: 'player',
        upgradeProperty: 'movementSpeed',
        upgradeValue: 0.15 // 15% boost
    },
    'base-armor': {
        id: 'base-armor',
        type: ItemType.UPGRADE,
        name: 'Base Armor Plating',
        description: 'Increases base health by 20%',
        rarity: ItemRarity.EPIC,
        value: 120,
        texture: 'upgrade-base-armor',
        stackable: false,
        upgradeTarget: 'base',
        upgradeProperty: 'health',
        upgradeValue: 0.2 // 20% boost
    }
};

// Combine all item types into a single record for easier access
export const ALL_ITEMS: Record<string, GameItem> = {
    ...RESOURCE_ITEMS,
    ...HEALTH_ITEMS,
    ...WEAPON_ITEMS,
    ...TOWER_BLUEPRINT_ITEMS,
    ...UPGRADE_ITEMS
};

// Item drop chance configuration
export const ITEM_DROP_CONFIG = {
    enemyDropChance: 0.3, // 30% chance an enemy drops something
    dropChanceByRarity: {
        [ItemRarity.COMMON]: 0.6,    // 60% of drops are common
        [ItemRarity.UNCOMMON]: 0.25, // 25% of drops are uncommon
        [ItemRarity.RARE]: 0.1,      // 10% of drops are rare
        [ItemRarity.EPIC]: 0.04,     // 4% of drops are epic
        [ItemRarity.LEGENDARY]: 0.01 // 1% of drops are legendary
    },
    // Weighting for different item types
    dropTypeWeights: {
        [ItemType.RESOURCE]: 0.5,    // 50% chance for resources
        [ItemType.HEALTH]: 0.2,      // 20% chance for health
        [ItemType.WEAPON]: 0.1,      // 10% chance for weapons
        [ItemType.BLUEPRINT]: 0.1,   // 10% chance for tower blueprints
        [ItemType.UPGRADE]: 0.1      // 10% chance for upgrades
    }
}; 