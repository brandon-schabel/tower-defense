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
 * Base item interface for all game items
 */
export interface GameItem {
    id: string;
    name: string;
    description: string;
    type: string;
    rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
    stackable: boolean;
    texture: string;
    value?: number;
    quantity?: number;
    slot?: string;
    properties?: {
        damage?: number;
        healthRestore?: number;
        fireRate?: number;
        range?: number;
        speedBonus?: number;
        damageBonus?: number;
        rangeBonus?: number;
        healthBonus?: number;
        buffs?: {
            [key: string]: {
                value: number;
                duration: number;
            };
        };
    };
}

/**
 * Health item for healing
 */
export interface HealthItem extends GameItem {
    type: ItemType.HEALTH;
    healAmount: number;
    resourceAmount?: number;
}

/**
 * Resource item for collecting resources
 */
export interface ResourceItem extends GameItem {
    type: 'resource';
    value: number;
    resourceAmount?: number;
}

/**
 * Weapon item with specific weapon properties
 */
export interface WeaponItem extends GameItem {
    type: 'weapon';
    properties: {
        damage: number;
        fireRate: number;
        range: number;
    };
    damage?: number;
    range?: number;
    cooldown?: number;
    projectileType?: string;
    tier?: number;
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

/**
 * Equipment item for armor, accessories, etc.
 */
export interface EquipmentItem extends GameItem {
    type: 'equipment';
    slot: 'head' | 'body' | 'accessory' | 'weapon' | 'armor' | 'helmet';
    tier?: number;
    properties: {
        healthBonus?: number;
        speedBonus?: number;
        damageBonus?: number;
        rangeBonus?: number;
    };
    stats?: {
        healthBonus?: number;
        speedBonus?: number;
        damageBonus?: number;
        rangeBonus?: number;
    };
}

/**
 * Consumable item (like potions, scrolls, etc.)
 */
export interface ConsumableItem extends GameItem {
    type: 'consumable';
    properties: {
        healthRestore?: number;
        buffs?: {
            [key: string]: {
                value: number;
                duration: number;
            };
        };
    };
} 