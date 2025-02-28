import Phaser from 'phaser';
import InventoryManager from '../managers/inventory-manager';
import { GameItem, InventorySlot, ItemRarity, ItemType, HealthItem } from '../types/item';
import { EventBus } from "../utils/event-bus";

export default class InventoryUI {
    private scene: Phaser.Scene;
    private inventoryManager: InventoryManager;
    private container: Phaser.GameObjects.Container;
    private slots: Phaser.GameObjects.Container[] = [];
    private draggedItem: {
        item: GameItem,
        quantity: number,
        originalSlot: number,
        sprite: Phaser.GameObjects.Sprite,
        quantityText: Phaser.GameObjects.Text
    } | null = null;
    private isVisible: boolean = false;
    private eventBus: EventBus;
    private onDragMove: ((p: Phaser.Input.Pointer) => void) | null = null;

    // Constants for layout
    private readonly ROWS = 4;
    private readonly COLS = 5;
    private readonly SLOT_SIZE = 64;
    private readonly SLOT_PADDING = 8;
    private readonly BG_PADDING = 20;

    constructor(scene: Phaser.Scene, inventoryManager: InventoryManager) {
        this.scene = scene;
        this.inventoryManager = inventoryManager;
        this.container = scene.add.container(0, 0);
        this.container.setVisible(false);
        this.eventBus = (scene as any).eventBus;
        this.createUI();
        this.eventBus.on('update-inventory', this.updateInventoryDisplay, this);
    }


    private createUI(): void {
        // Get camera dimensions instead of game config for positioning
        const camera = this.scene.cameras.main;
        const centerX = camera.width / 2;
        const centerY = camera.height / 2;

        // Remove any previous container if it exists
        if (this.container) {
            this.container.destroy();
        }

        // Create a new container positioned at the center of the camera view
        this.container = this.scene.add.container(centerX, centerY);
        this.container.setDepth(100); // High depth to appear above game elements

        // Make container stay in fixed position relative to camera
        this.container.setScrollFactor(0);

        // Background - positioned at origin (0,0) of container
        const bg = this.scene.add.rectangle(
            0,
            0,
            500, 400, 0x000000, 0.8
        );
        bg.setOrigin(0.5);
        this.container.add(bg);

        // Title
        const title = this.scene.add.text(
            0,
            -160,
            "Inventory",
            { fontSize: '24px', color: '#ffffff' }
        );
        title.setOrigin(0.5);
        this.container.add(title);

        // Close button
        const closeBtn = this.scene.add.text(
            230,
            -160,
            "X",
            { fontSize: '24px', color: '#ff0000' }
        );
        closeBtn.setOrigin(0.5);
        closeBtn.setInteractive();
        closeBtn.on('pointerdown', () => {
            this.hide();
        });
        this.container.add(closeBtn);

        // Create inventory slots
        this.createSlots();

        // Initially hidden
        this.container.setVisible(false);
    }

    /**
     * Create the inventory slot grid
     */
    private createSlots(): void {
        // Clear previous slots if any
        this.slots = [];

        const startX = -(this.COLS * (this.SLOT_SIZE + this.SLOT_PADDING)) / 2 + this.SLOT_SIZE / 2;
        const startY = -(this.ROWS * (this.SLOT_SIZE + this.SLOT_PADDING)) / 2 + this.SLOT_SIZE / 2 + 40; // Offset for title

        for (let row = 0; row < this.ROWS; row++) {
            for (let col = 0; col < this.COLS; col++) {
                const x = startX + col * (this.SLOT_SIZE + this.SLOT_PADDING);
                const y = startY + row * (this.SLOT_SIZE + this.SLOT_PADDING);

                const slotContainer = this.scene.add.container(x, y);

                // Create slot background
                const slotBg = this.scene.add.rectangle(0, 0, this.SLOT_SIZE, this.SLOT_SIZE, 0x333333);
                slotBg.setStrokeStyle(1, 0x777777);
                slotContainer.add(slotBg);

                // Make slot interactive
                slotBg.setInteractive({ useHandCursor: true });

                // Store slot index for later reference
                const slotIndex = row * this.COLS + col;
                slotContainer.setData('slotIndex', slotIndex);

                // Add slot to container
                this.container?.add(slotContainer);
                this.slots.push(slotContainer);

                // Set up drag events
                this.setupSlotEvents(slotBg, slotIndex);
            }
        }
    }

    /**
     * Set up drag and drop events for inventory slots
     */
    private setupSlotEvents(slotBg: Phaser.GameObjects.Rectangle, slotIndex: number): void {
        // Clear any existing event handlers to prevent duplicates
        slotBg.removeAllListeners();
        
        // Add hover effect
        slotBg.on('pointerover', () => {
            slotBg.setFillStyle(0x555555); // Highlight color
            
            // Show tooltip for the item
            const inventoryData = this.inventoryManager.getInventory();
            const slotData = inventoryData[slotIndex];
            
            if (slotData) {
                // Get pointer position
                const pointer = this.scene.input.activePointer;
                this.hideItemTooltip(); // Clear any existing tooltip
                
                // Show tooltip with item info and usage instructions
                this.showItemTooltip(slotData.item, pointer.x, pointer.y - 80);
                
                // Add usage instructions based on item type
                if (slotData.item.type === ItemType.HEALTH) {
                    this.addTooltipInstruction("Click to use and heal");
                } else if (slotData.item.type === ItemType.WEAPON) {
                    this.addTooltipInstruction("Drag to equip");
                } else if (slotData.item.type === ItemType.RESOURCE) {
                    this.addTooltipInstruction("Used for crafting");
                } else {
                    this.addTooltipInstruction("Click or drag to use");
                }
            }
        });
        
        slotBg.on('pointerout', () => {
            slotBg.setFillStyle(0x333333); // Reset color
            this.hideItemTooltip();
        });

        // Modified pointer down/up behavior to clearly separate clicks from drags
        let dragStarted = false;
        let dragThreshold = 5; // Pixels to move before considering it a drag
        let startPosition = {x: 0, y: 0};
        
        slotBg.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            startPosition = {x: pointer.x, y: pointer.y};
            dragStarted = false;
            
            const inventoryData = this.inventoryManager.getInventory();
            const slotData = inventoryData[slotIndex];
            
            // If slot has an item and we're not already dragging something
            if (slotData && !this.draggedItem) {
                // Start tracking for potential drag
                this.scene.input.on('pointermove', this.onDragMove = (p: Phaser.Input.Pointer) => {
                    if (!dragStarted) {
                        const distance = Phaser.Math.Distance.Between(
                            startPosition.x, startPosition.y, p.x, p.y
                        );
                        
                        if (distance > dragThreshold) {
                            dragStarted = true;
                            
                            // Create visual for dragging
                            const sprite = this.scene.add.sprite(p.x, p.y, slotData.item.texture);
                            sprite.setScale(0.8);
                            sprite.setDepth(101);
                            
                            // Add quantity text if stackable
                            let quantityText = null;
                            if (slotData.quantity > 1) {
                                quantityText = this.scene.add.text(
                                    p.x + 15, p.y + 15,
                                    slotData.quantity.toString(),
                                    { 
                                        fontSize: '16px', 
                                        color: '#FFFFFF', 
                                        stroke: '#000000', 
                                        strokeThickness: 4 
                                    }
                                );
                                quantityText.setDepth(102);
                            }
                            
                            // Store dragged item info
                            this.draggedItem = {
                                item: slotData.item,
                                quantity: slotData.quantity,
                                originalSlot: slotIndex,
                                sprite: sprite,
                                quantityText: quantityText!
                            };
                        }
                    } else if (this.draggedItem) {
                        // Update drag position
                        this.draggedItem.sprite.setPosition(p.x, p.y);
                        if (this.draggedItem.quantityText) {
                            this.draggedItem.quantityText.setPosition(p.x + 15, p.y + 15);
                        }
                    }
                });
            }
        });
        
        slotBg.on('pointerup', (pointer: Phaser.Input.Pointer) => {
            // Clean up move listener
            if (this.onDragMove) {
                this.scene.input.off('pointermove', this.onDragMove);
                this.onDragMove = null;
            }
            
            // If we didn't start dragging, treat it as a click to use the item
            if (!dragStarted && !this.draggedItem) {
                const inventoryData = this.inventoryManager.getInventory();
                const slotData = inventoryData[slotIndex];
                
                if (slotData) {
                    // Use the item if it's a health item
                    if (slotData.item.type === ItemType.HEALTH) {
                        this.useItem(slotIndex);
                    }
                }
            } 
            // If we're dragging something and released over a slot
            else if (this.draggedItem) {
                // Handle item placement
                this.inventoryManager.moveItem(
                    this.draggedItem.originalSlot,
                    slotIndex
                );
                
                // Clean up drag visuals
                this.cleanupDraggedItem();
                
                // Update inventory display
                this.updateInventoryDisplay();
            }
            
            // Reset flag
            dragStarted = false;
        });
    }

    private addTooltipInstruction(text: string): void {
        const tooltip = this.container?.getData('tooltip') as Phaser.GameObjects.Container;
        if (!tooltip) return;
        
        // Find the last element to position after it
        let maxY = 0;
        tooltip.each((child: Phaser.GameObjects.GameObject) => {
            // Skip the background
            if (child instanceof Phaser.GameObjects.Rectangle) return;
            
            if (child instanceof Phaser.GameObjects.Text) {
                const bottom = child.y + child.height;
                if (bottom > maxY) maxY = bottom;
            }
        });
        
        // Add instruction text
        const instruction = this.scene.add.text(
            0, maxY + 10,
            text,
            { 
                fontSize: '12px', 
                color: '#ffff00', 
                fontStyle: 'italic',
                stroke: '#000000',
                strokeThickness: 2
            }
        );
        instruction.setOrigin(0.5, 0);
        instruction.setName('instruction');
        tooltip.add(instruction);
        
        // Resize background to fit
        const bg = tooltip.getAt(0) as Phaser.GameObjects.Rectangle;
        if (bg) {
            bg.height = maxY + instruction.height + 20;
        }
    }

    /**
     * Handle using an item from inventory
     */
    private useItem(slotIndex: number): void {
        const inventoryData = this.inventoryManager.getInventory();
        const slotData = inventoryData[slotIndex];

        if (!slotData) return;

        // Handle different item types
        switch(slotData.item.type) {
            case ItemType.HEALTH:
                const healthItem = slotData.item as HealthItem;
                if (healthItem.healAmount) {
                    // First, try to remove the item before applying effects
                    const removed = this.inventoryManager.removeItemFromSlot(slotIndex, 1);
                    
                    if (removed) {
                        // Only proceed with healing if item was successfully removed
                        console.log(`Using health item to heal for ${healthItem.healAmount}`);
                        
                        // Flash the slot with a healing color
                        const slotContainer = this.slots[slotIndex];
                        const slotBg = slotContainer.getAt(0) as Phaser.GameObjects.Rectangle;
                        
                        // Create a more noticeable heal effect
                        this.scene.tweens.add({
                            targets: slotBg,
                            fillColor: { from: 0x00ff00, to: 0x333333 },
                            alpha: { from: 1, to: 0.5 },
                            yoyo: true,
                            duration: 400,
                            repeat: 1,
                            onComplete: () => {
                                slotBg.setFillStyle(0x333333);
                                slotBg.setAlpha(1);
                            }
                        });
                        
                        // Emit the heal event with a slight delay to ensure visuals sync
                        this.scene.time.delayedCall(200, () => {
                            this.eventBus.emit('use-health-item', {
                                amount: healthItem.healAmount,
                                source: 'healthpack',
                                timestamp: Date.now()
                            });
                        });
                        
                        // Show healing effect with improved visuals
                        this.showHealingEffect(healthItem.healAmount);
                        
                        // Update the inventory display after a short delay
                        this.scene.time.delayedCall(100, () => {
                            this.updateInventoryDisplay();
                        });
                    } else {
                        console.warn('Failed to remove health item from inventory');
                        // Show error feedback
                        const slotContainer = this.slots[slotIndex];
                        const slotBg = slotContainer.getAt(0) as Phaser.GameObjects.Rectangle;
                        
                        this.scene.tweens.add({
                            targets: slotBg,
                            fillColor: 0xff0000,
                            yoyo: true,
                            duration: 200,
                            onComplete: () => {
                                slotBg.setFillStyle(0x333333);
                            }
                        });
                    }
                }
                break;
                
            // Handle other item types as needed
            default:
                console.log(`Using item: ${slotData.item.name}`);
                break;
        }
    }

    private showHealingEffect(amount: number): void {
        const camera = this.scene.cameras.main;
        const x = camera.width / 2;
        const y = camera.height / 2;
        
        // Create multiple healing particles
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const radius = 60;
            const particleX = x + Math.cos(angle) * radius;
            const particleY = y + Math.sin(angle) * radius;
            
            const particle = this.scene.add.circle(particleX, particleY, 5, 0x00ff00, 1);
            particle.setDepth(199);
            particle.setScrollFactor(0);
            
            this.scene.tweens.add({
                targets: particle,
                x: x,
                y: y,
                alpha: 0,
                scale: 0.1,
                duration: 1000,
                ease: 'Quad.easeIn',
                onComplete: () => particle.destroy()
            });
        }
        
        // Create a healing text that floats up
        const healText = this.scene.add.text(
            x, 
            y,
            `+${amount} HP`,
            { 
                fontSize: '32px', 
                color: '#00FF00',
                stroke: '#000000',
                strokeThickness: 6,
                fontStyle: 'bold'
            }
        );
        healText.setOrigin(0.5);
        healText.setDepth(200);
        healText.setScrollFactor(0);
        healText.setAlpha(0);
        
        // Add a pulsing glow effect
        const glow = this.scene.add.graphics();
        glow.fillStyle(0x00ff00, 0.3);
        glow.fillCircle(x, y, 120);
        glow.setScrollFactor(0);
        glow.setDepth(199);
        glow.setAlpha(0);
        
        // Sequence the animations
        this.scene.tweens.add({
            targets: healText,
            y: y - 100,
            alpha: { from: 0, to: 1 },
            duration: 300,
            ease: 'Back.easeOut',
            onComplete: () => {
                this.scene.tweens.add({
                    targets: healText,
                    y: y - 150,
                    alpha: 0,
                    duration: 1000,
                    ease: 'Power2',
                    delay: 500,
                    onComplete: () => healText.destroy()
                });
            }
        });
        
        // Glow animation
        this.scene.tweens.add({
            targets: glow,
            alpha: { from: 0, to: 0.5 },
            scale: { from: 0.5, to: 2 },
            duration: 1000,
            onComplete: () => {
                this.scene.tweens.add({
                    targets: glow,
                    alpha: 0,
                    scale: 2.5,
                    duration: 500,
                    onComplete: () => glow.destroy()
                });
            }
        });
    }

    /**
     * Clean up dragged item visuals
     */
    private cleanupDraggedItem(): void {
        if (this.draggedItem) {
            this.draggedItem.sprite.destroy();

            if (this.draggedItem.quantityText) {
                this.draggedItem.quantityText.destroy();
            }

            this.draggedItem = null;
        }
    }

    /**
     * Update drag position during movement
     */
    update(): void {
        if (this.draggedItem) {
            const pointer = this.scene.input.activePointer;
            this.draggedItem.sprite.setPosition(pointer.x, pointer.y);

            if (this.draggedItem.quantityText) {
                this.draggedItem.quantityText.setPosition(pointer.x + 15, pointer.y + 15);
            }
        }
    }

    /**
     * Refresh inventory display
     */
    public updateInventoryDisplay(): void {
        const inventoryData = this.inventoryManager.getInventory();

        // Clear all slots first
        this.slots.forEach(slot => {
            // Remove all items except the slot background
            while (slot.list.length > 1) {
                const item = slot.list[slot.list.length - 1];
                slot.remove(item, true);
            }
        });

        // Add items to slots
        inventoryData.forEach((slotData, index) => {
            if (slotData && index < this.slots.length) {
                const slot = this.slots[index];

                // Add item sprite
                const itemSprite = this.scene.add.sprite(0, 0, slotData.item.texture);
                itemSprite.setDisplaySize(this.SLOT_SIZE * 0.8, this.SLOT_SIZE * 0.8);

                // Add rarity border
                const rarityColor = this.getRarityColor(slotData.item.rarity);
                const rarityBorder = this.scene.add.rectangle(0, 0, this.SLOT_SIZE, this.SLOT_SIZE, rarityColor, 0);
                rarityBorder.setStrokeStyle(2, rarityColor);

                // Add quantity text if more than 1
                if (slotData.quantity > 1) {
                    const qtyText = this.scene.add.text(
                        this.SLOT_SIZE / 3,
                        this.SLOT_SIZE / 3,
                        slotData.quantity.toString(),
                        { fontSize: '14px', color: '#FFFFFF', stroke: '#000000', strokeThickness: 3 }
                    );
                    slot.add(qtyText);
                }

                // Add to slot in correct order (border behind sprite)
                slot.add(rarityBorder);
                slot.add(itemSprite);
            }
        });
    }

    /**
     * Show tooltip with item details
     */
    private showItemTooltip(item: GameItem, x: number, y: number): void {
        // Create tooltip container
        const tooltip = this.scene.add.container(x, y);
        tooltip.setDepth(103);
        tooltip.setScrollFactor(0); // Fixed to camera

        // Background
        const bg = this.scene.add.rectangle(0, 0, 200, 120, 0x000000, 0.8);
        bg.setStrokeStyle(2, this.getRarityColor(item.rarity));
        tooltip.add(bg);

        // Item name
        const nameText = this.scene.add.text(
            0,
            -45,
            item.name,
            { fontSize: '16px', color: this.getRarityTextColor(item.rarity), fontStyle: 'bold' }
        );
        nameText.setOrigin(0.5, 0);
        tooltip.add(nameText);

        // Item type
        const typeText = this.scene.add.text(
            0,
            -25,
            `Type: ${item.type}`,
            { fontSize: '12px', color: '#CCCCCC' }
        );
        typeText.setOrigin(0.5, 0);
        tooltip.add(typeText);

        // Item description
        const descText = this.scene.add.text(
            0,
            -5,
            item.description,
            { fontSize: '12px', color: '#FFFFFF', wordWrap: { width: 180 } }
        );
        descText.setOrigin(0.5, 0);
        tooltip.add(descText);

        // Value
        const valueText = this.scene.add.text(
            0,
            descText.y + descText.height + 10,
            `Value: ${item.value}`,
            { fontSize: '12px', color: '#FFFF00' }
        );
        valueText.setOrigin(0.5, 0);
        tooltip.add(valueText);

        // Store tooltip
        this.container?.add(tooltip);
        this.container?.setData('tooltip', tooltip);
    }

    /**
     * Hide the current tooltip
     */
    private hideItemTooltip(): void {
        const tooltip = this.container?.getData('tooltip') as Phaser.GameObjects.Container;
        if (tooltip) {
            tooltip.destroy();
            this.container?.setData('tooltip', null);
        }
    }

    /**
     * Get color for item rarity
     */
    private getRarityColor(rarity: ItemRarity): number {
        switch (rarity) {
            case ItemRarity.COMMON: return 0x777777;
            case ItemRarity.UNCOMMON: return 0x00AA00;
            case ItemRarity.RARE: return 0x0088FF;
            case ItemRarity.EPIC: return 0xAA00FF;
            case ItemRarity.LEGENDARY: return 0xFF8800;
            default: return 0x777777;
        }
    }

    /**
     * Get text color for item rarity
     */
    private getRarityTextColor(rarity: ItemRarity): string {
        switch (rarity) {
            case ItemRarity.COMMON: return '#FFFFFF';
            case ItemRarity.UNCOMMON: return '#00FF00';
            case ItemRarity.RARE: return '#00AAFF';
            case ItemRarity.EPIC: return '#DD00FF';
            case ItemRarity.LEGENDARY: return '#FFAA00';
            default: return '#FFFFFF';
        }
    }

    /**
     * Show the inventory UI
     */
    public show(): void {
        // Make sure container is properly positioned relative to the camera
        const camera = this.scene.cameras.main;
        if (this.container) {
            this.container.setPosition(camera.width / 2, camera.height / 2);
            this.container.setVisible(true);
        }

        this.isVisible = true;
        this.updateInventoryDisplay();

        // Capture input so it doesn't pass through to game
        this.scene.input.on('pointermove', this.onPointerMove, this);
        this.scene.input.on('pointerup', this.onPointerUp, this);
    }

    /**
     * Hide the inventory UI
     */
    public hide(): void {
        this.container?.setVisible(false);
        this.isVisible = false;

        // Clean up any dragged item
        this.cleanupDraggedItem();

        // Remove input handlers
        this.scene.input.off('pointermove', this.onPointerMove, this);
        this.scene.input.off('pointerup', this.onPointerUp, this);
    }

    /**
     * Handle pointer movement (for dragging)
     */
    private onPointerMove(pointer: Phaser.Input.Pointer): void {
        if (this.draggedItem) {
            this.draggedItem.sprite.setPosition(pointer.x, pointer.y);

            if (this.draggedItem.quantityText) {
                this.draggedItem.quantityText.setPosition(pointer.x + 15, pointer.y + 15);
            }
        }
    }

    /**
     * Handle pointer up outside of slots (cancels drag)
     */
    private onPointerUp(): void {
        // If we're dragging something but pointer isn't over a slot, return to original position
        if (this.draggedItem) {
            this.cleanupDraggedItem();
            this.hideItemTooltip();
        }
    }

    public isShowing(): boolean {
        return this.isVisible;
    }

    destroy() {
        this.eventBus.off('update-inventory', this.updateInventoryDisplay, this);
        if (this.container) {
            this.container.destroy();
        }
    }

    public onResize(): void {
        if (this.container) {
            const camera = this.scene.cameras.main;
            this.container.setPosition(camera.width / 2, camera.height / 2);
        }
    }

    // Add method to reset tooltip position when dragging
    private updateTooltipPosition(x: number, y: number): void {
        const tooltip = this.container?.getData('tooltip') as Phaser.GameObjects.Container;
        if (tooltip) {
            // Convert screen coords to container-relative coords
            const camera = this.scene.cameras.main;
            const containerX = this.container?.x || camera.width / 2;
            const containerY = this.container?.y || camera.height / 2;

            // Position tooltip relative to container
            tooltip.setPosition(x - containerX, y - containerY - 80);
        }
    }
} 