import Phaser from 'phaser';
import InventoryManager from '../utils/inventory-manager';
import { GameItem, InventorySlot, ItemRarity } from '../types/item';

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
        this.createUI();
    }
    
    private createUI(): void {
        // Background
        const bg = this.scene.add.rectangle(
            Number(this.scene.game.config.width) / 2,
            Number(this.scene.game.config.height) / 2,
            500, 400, 0x000000, 0.8
        );
        bg.setOrigin(0.5);
        this.container.add(bg);
        
        // Title
        const title = this.scene.add.text(
            Number(this.scene.game.config.width) / 2,
            Number(this.scene.game.config.height) / 2 - 160,
            "Inventory",
            { fontSize: '24px', color: '#ffffff' }
        );
        title.setOrigin(0.5);
        this.container.add(title);
        
        // Close button
        const closeBtn = this.scene.add.text(
            Number(this.scene.game.config.width) / 2 + 230,
            Number(this.scene.game.config.height) / 2 - 160,
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
        const startX = -(this.COLS * (this.SLOT_SIZE + this.SLOT_PADDING)) / 2 + this.SLOT_SIZE / 2 + this.SLOT_PADDING;
        const startY = -(this.ROWS * (this.SLOT_SIZE + this.SLOT_PADDING)) / 2 + this.SLOT_SIZE / 2 + this.SLOT_PADDING + 40; // Offset for title
        
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
                this.container.add(slotContainer);
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
        // Pointer down on slot
        slotBg.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            const inventoryData = this.inventoryManager.getInventory();
            const slotData = inventoryData[slotIndex];
            
            // If slot has an item and we're not already dragging something
            if (slotData && !this.draggedItem) {
                // Create a sprite to drag
                const sprite = this.scene.add.sprite(pointer.x, pointer.y, slotData.item.texture);
                sprite.setScale(0.8);
                sprite.setDepth(101);
                
                // Add quantity text if stackable
                let quantityText = null;
                if (slotData.quantity > 1) {
                    quantityText = this.scene.add.text(
                        pointer.x + 15, 
                        pointer.y + 15, 
                        slotData.quantity.toString(), 
                        { fontSize: '16px', color: '#FFFFFF', stroke: '#000000', strokeThickness: 4 }
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
                
                // Add tooltip with item details
                this.showItemTooltip(slotData.item, pointer.x, pointer.y - 80);
            }
        });
        
        // Pointer up on slot (drop)
        slotBg.on('pointerup', () => {
            if (this.draggedItem) {
                // Handle item placement
                this.inventoryManager.moveItem(
                    this.draggedItem.originalSlot,
                    slotIndex
                );
                
                // Clean up drag visuals
                this.cleanupDraggedItem();
                
                // Hide tooltip
                this.hideItemTooltip();
            }
        });
        
        // Double click to use item
        slotBg.on('pointerdown', (pointer: Phaser.Input.Pointer, _: number, __: number, event: Phaser.Types.Input.EventData) => {
            // Use the event's current timestamp to detect double clicks 
            const currentTime = this.scene.time.now;
            if (currentTime - (slotBg.getData('lastClickTime') || 0) < 300) {
                const inventoryData = this.inventoryManager.getInventory();
                const slotData = inventoryData[slotIndex];
                
                if (slotData) {
                    // Double-clicked an item, try to use it
                    this.useItem(slotIndex);
                }
            }
            slotBg.setData('lastClickTime', currentTime);
        });
    }
    
    /**
     * Handle using an item from inventory
     */
    private useItem(slotIndex: number): void {
        const inventoryData = this.inventoryManager.getInventory();
        const slotData = inventoryData[slotIndex];
        
        if (!slotData) return;
        
        // For now we just simulate item use by removing it from inventory
        // In a complete implementation, this would trigger the appropriate 
        // action based on item type and pass to the player entity
        
        this.inventoryManager.removeItemFromSlot(slotIndex, 1);
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
    private updateInventoryDisplay(): void {
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
        this.container.add(tooltip);
        this.container.setData('tooltip', tooltip);
    }
    
    /**
     * Hide the current tooltip
     */
    private hideItemTooltip(): void {
        const tooltip = this.container.getData('tooltip') as Phaser.GameObjects.Container;
        if (tooltip) {
            tooltip.destroy();
            this.container.setData('tooltip', null);
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
        this.container.setVisible(true);
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
        this.container.setVisible(false);
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
} 