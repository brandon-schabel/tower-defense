import { GameItem, InventorySlot } from '../types/item';
import { EventEmitter } from 'events';

/**
 * Class that manages inventory slots, adding/removing items and handling stacking
 */
export default class InventoryManager extends EventEmitter {
    private slots: (InventorySlot | null)[];
    private maxSlots: number;

    constructor(maxSlots: number = 20) {
        super();
        this.maxSlots = maxSlots;
        this.slots = new Array(maxSlots).fill(null);
    }

    /**
     * Get the entire inventory
     */
    public getInventory(): (InventorySlot | null)[] {
        return [...this.slots];
    }

    /**
     * Add an item to the inventory
     * @param item Item to add
     * @param quantity Quantity to add (for stackable items)
     * @returns Whether the item was successfully added
     */
    public addItem(item: GameItem, quantity: number = 1): boolean {
        if (quantity <= 0) return false;
        
        // If item is stackable, try to add to existing stack
        if (item.stackable) {
            // Find existing stack of the same item
            const existingSlotIndex = this.slots.findIndex(
                slot => slot !== null && slot.item.id === item.id
            );
            
            if (existingSlotIndex !== -1) {
                const slot = this.slots[existingSlotIndex]!;
                slot.quantity += quantity;
                this.emit('inventoryChanged');
                return true;
            }
        }
        
        // Find first empty slot
        const emptySlotIndex = this.slots.findIndex(slot => slot === null);
        
        if (emptySlotIndex === -1) {
            // No empty slots available
            this.emit('inventoryChanged');
            return false;
        }
        
        // Add item to empty slot
        this.slots[emptySlotIndex] = {
            item,
            quantity
        };
        
        this.emit('inventoryChanged');
        return true;
    }

    /**
     * Remove an item from a specific slot
     * @param slotIndex Index of the slot to remove from
     * @param quantity Quantity to remove (for stackable items)
     * @returns The removed item and quantity, or null if failed
     */
    public removeItemFromSlot(slotIndex: number, quantity: number = 1): { item: GameItem, quantity: number } | null {
        if (slotIndex < 0 || slotIndex >= this.slots.length) {
            return null;
        }
        
        const slot = this.slots[slotIndex];
        if (!slot) {
            return null;
        }
        
        if (quantity >= slot.quantity) {
            // Remove the entire stack
            const result = { item: slot.item, quantity: slot.quantity };
            this.slots[slotIndex] = null;
            this.emit('inventoryChanged');
            return result;
        } else {
            // Remove partial stack
            slot.quantity -= quantity;
            this.emit('inventoryChanged');
            return { item: slot.item, quantity };
        }
    }

    /**
     * Remove an item by its ID
     * @param itemId ID of the item to remove
     * @param quantity Quantity to remove
     * @returns Whether the item was successfully removed
     */
    public removeItemById(itemId: string, quantity: number = 1): boolean {
        const slotIndex = this.slots.findIndex(
            slot => slot !== null && slot.item.id === itemId
        );
        
        if (slotIndex === -1) {
            return false;
        }
        
        return this.removeItemFromSlot(slotIndex, quantity) !== null;
    }

    /**
     * Move an item from one slot to another
     * @param fromSlot Source slot index
     * @param toSlot Destination slot index
     * @returns Whether the move was successful
     */
    public moveItem(fromSlot: number, toSlot: number): boolean {
        if (
            fromSlot < 0 || fromSlot >= this.slots.length ||
            toSlot < 0 || toSlot >= this.slots.length ||
            fromSlot === toSlot
        ) {
            return false;
        }
        
        const sourceSlot = this.slots[fromSlot];
        if (!sourceSlot) {
            return false;
        }
        
        const destSlot = this.slots[toSlot];
        
        // If destination is empty, simple move
        if (!destSlot) {
            this.slots[toSlot] = sourceSlot;
            this.slots[fromSlot] = null;
            this.emit('inventoryChanged');
            return true;
        }
        
        // If both slots have the same stackable item
        if (
            sourceSlot.item.stackable &&
            destSlot.item.id === sourceSlot.item.id
        ) {
            // Add quantities
            destSlot.quantity += sourceSlot.quantity;
            this.slots[fromSlot] = null;
            this.emit('inventoryChanged');
            return true;
        }
        
        // Swap items
        this.slots[fromSlot] = destSlot;
        this.slots[toSlot] = sourceSlot;
        this.emit('inventoryChanged');
        return true;
    }

    /**
     * Check if inventory has at least a certain quantity of an item
     * @param itemId ID of the item to check
     * @param quantity Minimum quantity required
     * @returns Whether the inventory has enough of the item
     */
    public hasItem(itemId: string, quantity: number = 1): boolean {
        let totalQuantity = 0;
        
        for (const slot of this.slots) {
            if (slot && slot.item.id === itemId) {
                totalQuantity += slot.quantity;
                if (totalQuantity >= quantity) {
                    return true;
                }
            }
        }
        
        return false;
    }

    /**
     * Count how many empty slots are available
     * @returns Number of empty slots
     */
    public countEmptySlots(): number {
        return this.slots.filter(slot => slot === null).length;
    }

    /**
     * Check if inventory is full
     * @returns Whether there are no empty slots
     */
    public isFull(): boolean {
        return this.countEmptySlots() === 0;
    }

    /**
     * Find an item by its type
     * @param itemType The type of item to find
     * @returns The slot index of the first matching item, or -1 if not found
     */
    public findItem(itemType: string): number {
        return this.slots.findIndex(
            slot => slot !== null && slot.item.type === itemType
        );
    }

    /**
     * Clear the entire inventory
     */
    public clear(): void {
        this.slots = new Array(this.maxSlots).fill(null);
        this.emit('inventoryChanged');
    }
} 