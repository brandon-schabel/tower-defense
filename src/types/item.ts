/**
 * Possible rarity levels for items
 */
export enum ItemRarity {
    COMMON = 'common',
    UNCOMMON = 'uncommon',
    RARE = 'rare',
    EPIC = 'epic',
    LEGENDARY = 'legendary'
}

/**
 * Item types available in the game
 */
export enum ItemType {
    WEAPON = 'weapon',
    ARMOR = 'armor',
    HEALTH = 'health',
    RESOURCE = 'resource',
    UPGRADE = 'upgrade',
    BLUEPRINT = 'blueprint'
}

/**
 * Base interface for all game items
 */
export interface GameItem {
    id: string;
    name: string;
    description: string;
    texture: string;
    type: ItemType;
    rarity: ItemRarity;
    value: number;
    stackable: boolean;
    useOnPickup?: boolean;
}

/**
 * Health item for healing
 */
export interface HealthItem extends GameItem {
    type: ItemType.HEALTH;
    healAmount: number;
}

/**
 * Resource item for collecting resources
 */
export interface ResourceItem extends GameItem {
    type: ItemType.RESOURCE;
    resourceAmount: number;
}

/**
 * Weapon item that player can equip
 */
export interface WeaponItem extends GameItem {
    type: ItemType.WEAPON;
    damage: number;
    range: number;
    cooldown: number;
    projectileType: string;
    tier: number;
}

/**
 * Armor item that player can equip for protection
 */
export interface ArmorItem extends GameItem {
    type: ItemType.ARMOR;
    defense: number;
    tier: number;
}

/**
 * Upgrade item to enhance player or tower stats
 */
export interface UpgradeItem extends GameItem {
    type: ItemType.UPGRADE;
    upgradeTarget: 'player' | 'tower' | 'base';
    upgradeProperty: string;
    upgradeValue: number;
    duration?: number; // if temporary
}

/**
 * Blueprint for building towers
 */
export interface BlueprintItem extends GameItem {
    type: ItemType.BLUEPRINT;
    towerType: string;
    towerTier: number;
}

/**
 * Represents an item in an inventory slot
 */
export interface InventorySlot {
    item: GameItem;
    quantity: number;
}

/**
 * Represents an item dropped in the world
 */
export interface DroppedItem {
    id: string;
    item: GameItem;
    quantity: number;
    x: number;
    y: number;
    sprite?: Phaser.Physics.Arcade.Sprite;
}

export interface EquipmentItem extends GameItem {
    slot: string;
    stats: {
        healthBonus?: number;
        damageBonus?: number;
        speedBonus?: number;
        rangeBonus?: number;
        specialEffect?: {
            type: string;
            chance: number;
            power: number;
        };
    };
    description: string;
    texture: string;
    tier: number;
} 