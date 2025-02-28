import Phaser from 'phaser';
import { DroppedItem, GameItem, ItemRarity, ItemType, ResourceItem, HealthItem, WeaponItem } from '../types/item';
import TileMapManager from './tile-map-manager';
import GameScene from '../scenes/game-scene';
import { GAME_SETTINGS } from '../settings';
import ServiceLocator from '../utils/service-locator';

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
        
        // Register with service locator
        ServiceLocator.getInstance().register('itemDropManager', this);
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
            sprite: undefined // Start with undefined
        };

        try {
            // Create sprite for the item with proper physics
            const sprite = this.scene.physics.add.sprite(x, y, item.texture);

            // Make sure sprite is properly set up
            if (!sprite.texture || sprite.texture.key === '__MISSING') {
                console.warn(`Missing texture for item: ${item.name} (${item.texture})`);
                sprite.setTexture('projectile'); // Use a texture we know exists
            }

            // Make items much smaller and add a distinct outline to make them more visible
            sprite.setScale(0.3);
            sprite.setVisible(true);
            sprite.setActive(true);
            sprite.setDepth(50); // Set a high depth to ensure visibility
            
            // Add a simple pulsing effect for visibility
            this.scene.tweens.add({
                targets: sprite,
                alpha: 0.6,
                duration: 1000,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1
            });

            // Store metadata on the sprite
            sprite.setData('dropId', droppedItem.id);
            sprite.setData('itemName', item.name);
            sprite.setData('droppedTime', this.scene.time.now);
            
            // Set collision properties for better physics
            sprite.body.setCircle(sprite.width / 4);
            sprite.body.setCollideWorldBounds(true);
            sprite.body.setBounce(0.2);
            sprite.body.setDrag(0.9, 0.9);

            // Add to dropped items list
            droppedItem.sprite = sprite;
            this.droppedItems.push(droppedItem);

            // Add debug drop text
            const debugText = this.scene.add.text(x, y - 15, item.name, {
                fontSize: '8px', // Smaller text
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 2
            });
            debugText.setOrigin(0.5);
            debugText.setDepth(51); // Higher than sprite

            // Store the text reference to clean it up later
            sprite.setData('debugText', debugText);

            // Auto-despawn after 30 seconds (reduced from 60)
            this.scene.time.delayedCall(30000, () => {
                const itemToRemove = this.droppedItems.find(item => item.id === droppedItem.id);
                if (itemToRemove) {
                    this.removeItem(itemToRemove);
                }
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
        console.log(`Attempting to fully remove item: ${droppedItem.item.name}`);
        
        try {
            // Step 1: Remove from our tracking list first
            const index = this.droppedItems.indexOf(droppedItem);
            if (index !== -1) {
                this.droppedItems.splice(index, 1);
            }
            
            // Step 2: Handle sprite cleanup with multiple safety measures
            if (droppedItem.sprite) {
                // Kill all tweens that might be animating this sprite
                this.scene.tweens.getTweensOf(droppedItem.sprite).forEach(tween => {
                    tween.stop();
                    tween.remove();
                });
                
                // Find and destroy any debug text
                const debugText = droppedItem.sprite.getData('debugText');
                if (debugText && debugText.destroy) {
                    debugText.destroy();
                }
                
                // Find and destroy any particles
                const particles = droppedItem.sprite.getData('particles');
                if (particles && particles.destroy) {
                    particles.destroy();
                }
                
                // Find and destroy any light
                const light = droppedItem.sprite.getData('light');
                if (light) {
                    this.scene.lights.removeLight(light);
                }
                
                // Completely disable the sprite (both visible and active flags)
                droppedItem.sprite.setVisible(false);
                droppedItem.sprite.setActive(false);
                
                // Remove from physics world
                if (droppedItem.sprite.body) {
                    this.scene.physics.world.remove(droppedItem.sprite.body);
                }
                
                // Remove from any groups it might be in
                if (this.itemGroup) {
                    this.itemGroup.remove(droppedItem.sprite, true, true);
                }
                
                // Final destruction with removeFromDisplayList and removeFromUpdateList flags
                droppedItem.sprite.destroy(true);
                
                // Force garbage collection by removing the reference
                droppedItem.sprite = undefined;
                
                // Add an additional cleanup check after a short delay to catch any persistent sprites
                this.scene.time.delayedCall(50, () => {
                    // Look for any sprites at this position that might be remnants
                    const items = this.scene.children.getAll().filter(obj => {
                        if (obj instanceof Phaser.GameObjects.Sprite) {
                            const dist = Phaser.Math.Distance.Between(
                                obj.x, obj.y, droppedItem.x, droppedItem.y);
                            return dist < 10; // Close enough to be the same item
                        }
                        return false;
                    });
                    
                    // Destroy any found sprites at this position
                    if (items.length > 0) {
                        console.log(`Found ${items.length} lingering sprites at item position, cleaning up`);
                        items.forEach(obj => obj.destroy());
                    }
                });
            }
            
            console.log(`Successfully removed item: ${droppedItem.item.name}`);
        } catch (error) {
            console.error(`Error during item removal for ${droppedItem.item.name}:`, error);
            
            // Last-ditch effort - try to find and nuke any sprite at this location
            try {
                const x = droppedItem.x;
                const y = droppedItem.y;
                
                this.scene.children.getAll().forEach(obj => {
                    if (obj instanceof Phaser.GameObjects.Sprite || 
                        obj instanceof Phaser.GameObjects.Text) {
                        const dist = Phaser.Math.Distance.Between(obj.x, obj.y, x, y);
                        if (dist < 20) { // Close enough to be related to this item
                            console.log(`Force-destroying object at (${obj.x}, ${obj.y})`);
                            obj.destroy();
                        }
                    }
                });
            } catch (e) {
                console.error("Failed last-ditch cleanup:", e);
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