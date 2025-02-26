import Phaser from 'phaser';
import { DroppedItem, GameItem, ItemRarity, ItemType, ResourceItem, HealthItem, WeaponItem } from '../types/item';
import TileMapManager from './tile-map-manager';
import GameScene from '../scenes/game-scene';
import { GAME_SETTINGS } from '../settings';

export default class ItemDropManager {
    private scene: GameScene;
    private droppedItems: DroppedItem[] = [];
    private itemGroup: Phaser.GameObjects.Group;
    private tileMapManager: TileMapManager;
    private pickupRange: number;
    private nextDropId: number = 0;

    constructor(scene: GameScene, tileMapManager: TileMapManager) {
        this.scene = scene;
        this.tileMapManager = tileMapManager;
        this.itemGroup = this.scene.add.group();

        // Get pickup range from GAME_SETTINGS, fallback to a default value if not found
        this.pickupRange = GAME_SETTINGS.player?.pickupRange ?? 50;

        // Add collision detection for item pickup
        this.setupCollision();
    }

    /**
     * Drop a random item at the specified location
     * @param x X-coordinate to drop at
     * @param y Y-coordinate to drop at
     * @returns The dropped item
     */
    public dropRandomItem(x: number, y: number): DroppedItem {
        const itemTypes = ['resource-small', 'resource-medium', 'resource-large', 'health-small', 'health-medium', 'health-large'];
        const randomItemType = Phaser.Math.RND.pick(itemTypes);
        const randomQuantity = Phaser.Math.Between(1, 3); // Example quantity

        // Create a dummy GameItem.  In a real scenario, you'd have a proper
        // item registry or factory.
        const dummyItem: GameItem = {
            id: randomItemType, // Use the texture as a temporary ID
            name: randomItemType.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase()), // Capitalize
            type: ItemType.RESOURCE, //  Make it a resource for now, use enum
            texture: randomItemType,
            description: `A ${randomItemType.replace('-', ' ')}`,
            value: 10,
            rarity: ItemRarity.COMMON, // Use enum
            stackable: true,
        };

        return this.dropItem(dummyItem, x, y, randomQuantity);
    }

    /**
     * Drop a specific item at the specified location
     * @param item Item to drop
     * @param x X-coordinate to drop at
     * @param y Y-coordinate to drop at
     * @param quantity Quantity of the item (for stackable items)
     * @returns The dropped item
     */
    public dropItem(item: GameItem, x: number, y: number, quantity: number = 1): DroppedItem {
        const droppedItem: DroppedItem = {
            id: `drop_${this.nextDropId++}`,
            item,
            quantity,
            x,
            y,
            sprite: this.scene.physics.add.sprite(x, y, item.texture)
        };

        try {
            // Create sprite for the item with proper physics
            const sprite = this.scene.physics.add.sprite(x, y, item.texture);

            // Make sure sprite is properly set up
            if (!sprite.texture || sprite.texture.key === '__MISSING') {
                console.warn(`Missing texture for item: ${item.name} (${item.texture})`);
                // Fallback to a default texture if the intended one is missing
                sprite.setTexture('projectile'); // Use a texture we know exists
            }

            // Increase scale for better visibility (was 0.5)
            sprite.setScale(0.8);
            sprite.setVisible(true);
            sprite.setActive(true);

            // Store metadata on the sprite
            sprite.setData('dropId', droppedItem.id);
            sprite.setData('itemName', item.name);

            // Add visual effects
            this.addDropEffects(sprite, item.rarity);

            // Add to dropped items list
            droppedItem.sprite = sprite;
            this.droppedItems.push(droppedItem);

            // Add debug drop text
            const debugText = this.scene.add.text(x, y - 20, item.name, {
                fontSize: '10px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 2
            });
            debugText.setOrigin(0.5);

            // Store the text reference to clean it up later
            sprite.setData('debugText', debugText);

            // Auto-despawn after 60 seconds
            this.scene.time.delayedCall(60000, () => {
                this.removeItem(droppedItem);
            });

            console.log(`Dropped item: ${item.name} at (${x}, ${y}) with texture: ${item.texture}`);

            return droppedItem;
        } catch (error) {
            console.error(`Error dropping item: ${item.name}`, error);
            // Return the item without sprite in case of error
            return droppedItem;
        }
    }

    /**
     * Create a resource item with random properties
     */
    private createResourceItem(): ResourceItem {
        const resourceAmount = Math.floor(Math.random() * 30) + 10; // 10-40 resources
        const rarity = this.determineRarity();
        const rarityMultiplier = this.getRarityValueMultiplier(rarity);

        // Match texture name to what's loaded in preload
        let textureName = 'resource-small';
        if (rarity === ItemRarity.UNCOMMON || rarity === ItemRarity.RARE) {
            textureName = 'resource-medium';
        } else if (rarity === ItemRarity.EPIC || rarity === ItemRarity.LEGENDARY) {
            textureName = 'resource-large';
        }

        return {
            id: `resource_${Date.now()}`,
            name: `${rarity} Resource Cache`,
            description: `Contains ${resourceAmount * rarityMultiplier} resources.`,
            texture: textureName,
            type: ItemType.RESOURCE,
            rarity,
            value: resourceAmount * rarityMultiplier,
            stackable: true,
            resourceAmount: resourceAmount * rarityMultiplier
        };
    }

    /**
     * Create a health item with random properties
     */
    private createHealthItem(): HealthItem {
        const healAmount = Math.floor(Math.random() * 30) + 10; // 10-40 health
        const rarity = this.determineRarity();
        const rarityMultiplier = this.getRarityValueMultiplier(rarity);

        // Match texture name to what's loaded in preload
        // We need "health-small" not "health-common" to match the preload keys
        let textureName = 'health-small';
        if (rarity === ItemRarity.UNCOMMON || rarity === ItemRarity.RARE) {
            textureName = 'health-medium';
        } else if (rarity === ItemRarity.EPIC || rarity === ItemRarity.LEGENDARY) {
            textureName = 'health-large';
        }

        return {
            id: `health_${Date.now()}`,
            name: `${rarity} Health Pack`,
            description: `Restores ${healAmount * rarityMultiplier} health.`,
            texture: textureName,
            type: ItemType.HEALTH,
            rarity,
            value: healAmount * rarityMultiplier / 2,
            stackable: true,
            healAmount: healAmount * rarityMultiplier
        };
    }

    /**
     * Create a weapon item with random properties
     */
    private createWeaponItem(): WeaponItem {
        const rarity = this.determineRarity();
        const rarityMultiplier = this.getRarityValueMultiplier(rarity);
        const baseDamage = Math.floor(Math.random() * 20) + 10; // 10-30 damage
        const damage = baseDamage * rarityMultiplier;
        const range = 200 + Math.floor(Math.random() * 100); // 200-300 range

        // Calculate cooldown based on rarity index instead of direct conversion
        const rarityIndex = this.getRarityIndex(rarity);
        const cooldown = Math.max(200, 500 - rarityIndex * 50); // 300-500ms cooldown based on rarity

        // Weapon types - these match the texture keys loaded in preload
        const weaponTypes = ['blaster', 'rapid', 'cannon'];
        const weaponType = weaponTypes[Math.floor(Math.random() * weaponTypes.length)];

        // Build texture name to match what's loaded in preload
        const textureName = `weapon-${weaponType}`;

        // Projectile type based on weapon type
        let projectileType = 'player';
        if (weaponType === 'rapid') projectileType = 'player-rapid';
        if (weaponType === 'cannon') projectileType = 'player-power';

        // Determine tier based on rarity index
        const tier = Math.min(5, Math.max(1, rarityIndex + 1));

        return {
            id: `weapon_${Date.now()}`,
            name: `${rarity} ${weaponType.charAt(0).toUpperCase() + weaponType.slice(1)}`,
            description: `A ${rarity.toLowerCase()} tier ${weaponType} weapon. Deals ${damage} damage.`,
            texture: textureName,
            type: ItemType.WEAPON,
            rarity,
            value: damage * 10,
            stackable: false,
            damage,
            range,
            cooldown,
            projectileType,
            tier
        };
    }

    /**
     * Determine item rarity based on random chance
     */
    private determineRarity(): ItemRarity {
        const roll = Math.random();

        if (roll < 0.6) return ItemRarity.COMMON;       // 60%
        if (roll < 0.85) return ItemRarity.UNCOMMON;    // 25%
        if (roll < 0.95) return ItemRarity.RARE;        // 10%
        if (roll < 0.99) return ItemRarity.EPIC;        // 4%
        return ItemRarity.LEGENDARY;                    // 1%
    }

    /**
     * Get multiplier for item values based on rarity
     */
    private getRarityValueMultiplier(rarity: ItemRarity): number {
        switch (rarity) {
            case ItemRarity.COMMON: return 1;
            case ItemRarity.UNCOMMON: return 1.5;
            case ItemRarity.RARE: return 2.5;
            case ItemRarity.EPIC: return 4;
            case ItemRarity.LEGENDARY: return 8;
            default: return 1;
        }
    }

    /**
     * Get the numeric index of a rarity value (0 for common, 4 for legendary)
     */
    private getRarityIndex(rarity: ItemRarity): number {
        const rarityValues = Object.values(ItemRarity);
        return rarityValues.indexOf(rarity);
    }

    /**
     * Add visual effects to dropped items based on their rarity
     */
    private addDropEffects(sprite: Phaser.Physics.Arcade.Sprite, rarity: ItemRarity): void {
        // Add a slight bouncing effect
        this.scene.tweens.add({
            targets: sprite,
            y: sprite.y - 10,
            duration: 800,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });

        // Add a slight pulsing effect for rare+ items (gentler pulsing)
        if (rarity !== ItemRarity.COMMON) {
            this.scene.tweens.add({
                targets: sprite,
                scale: sprite.scale * 1.1, // Reduced from 1.2
                duration: 1200,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1
            });
        }

        // Add a colored outline or glow based on rarity
        let glowColor = 0xffffff; // Default white glow

        switch (rarity) {
            case ItemRarity.UNCOMMON:
                glowColor = 0x00ff00; // Green
                break;
            case ItemRarity.RARE:
                glowColor = 0x0088ff; // Blue
                break;
            case ItemRarity.EPIC:
                glowColor = 0xaa00ff; // Purple
                break;
            case ItemRarity.LEGENDARY:
                glowColor = 0xff8800; // Orange/Gold
                break;
        }

        // Use a gentler tinting approach that doesn't obscure the original image too much
        if (rarity !== ItemRarity.COMMON) {
            // For non-common items, use a partial tint that preserves the original colors better
            sprite.setTintFill(glowColor);

            // Create a pulsing alpha effect instead of a solid tint
            this.scene.tweens.add({
                targets: sprite,
                alpha: 0.8,
                duration: 1000,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1
            });

            // Try adding a particle emitter for legendary and epic items
            if (rarity === ItemRarity.LEGENDARY || rarity === ItemRarity.EPIC) {
                try {
                    // Create a simple particle effect
                    const particles = this.scene.add.particles(sprite.x, sprite.y, 'projectile', {
                        lifespan: 1000,
                        speed: { min: 10, max: 20 },
                        scale: { start: 0.1, end: 0 },
                        quantity: 1,
                        blendMode: 'ADD',
                        tint: glowColor,
                        emitting: true
                    });

                    // Store the particle emitter for cleanup
                    sprite.setData('particles', particles);
                } catch (error) {
                    console.error("Error creating particles:", error);
                }
            }
        }
    }

    /**
     * Setup collision detection for item pickup
     */
    private setupCollision(): void {
        // We'll handle this in the update method
    }

    /**
     * Check if player can pick up an item
     * @param playerX Player X position
     * @param playerY Player Y position
     * @returns DroppedItem or null if none in range
     */
    public getItemInPickupRange(playerX: number, playerY: number): DroppedItem | null {
        // Find closest item in range
        let closestItem: DroppedItem | null = null;
        let closestDistance = Infinity;

        for (const droppedItem of this.droppedItems) {
            const distance = Phaser.Math.Distance.Between(
                playerX,
                playerY,
                droppedItem.x,
                droppedItem.y
            );

            if (distance <= this.pickupRange && distance < closestDistance) {
                closestItem = droppedItem;
                closestDistance = distance;
            }
        }

        return closestItem;
    }

    /**
     * Remove an item from the world
     * @param droppedItem The item to remove
     */
    public removeItem(droppedItem: DroppedItem): void {
        // Remove from our tracking list
        const index = this.droppedItems.indexOf(droppedItem);
        if (index !== -1) {
            this.droppedItems.splice(index, 1);

            // Remove sprite
            if (droppedItem.sprite) {
                // Remove debug text if it exists
                const debugText = droppedItem.sprite.getData('debugText');
                if (debugText) {
                    debugText.destroy();
                }

                // Remove associated light
                const light = droppedItem.sprite.getData('light');
                if (light) {
                    this.scene.lights.removeLight(light);
                }

                // Destroy the sprite
                droppedItem.sprite.destroy();

                console.log(`Removed item: ${droppedItem.item.name}`);
            }
        }
    }

    /**
     * Update method to be called in the scene's update loop
     */
    public update(): void {
        // Ensure all items are visible and properly positioned
        for (const droppedItem of this.droppedItems) {
            if (droppedItem.sprite) {
                // Ensure sprite is visible
                droppedItem.sprite.setVisible(true);

                // Ensure position is correct
                droppedItem.sprite.x = droppedItem.x;
                droppedItem.sprite.y = droppedItem.y;

                // Debug info - uncomment if needed
                // console.log(`Item ${droppedItem.item.name} at (${droppedItem.x}, ${droppedItem.y}) - visible: ${droppedItem.sprite.visible}`);
            }
        }
    }

    /**
     * Get all current dropped items
     */
    public getAllDroppedItems(): DroppedItem[] {
        return [...this.droppedItems];
    }
} 