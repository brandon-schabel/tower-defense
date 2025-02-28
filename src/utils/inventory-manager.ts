import { GameItem } from "../types/item";

export class InventoryManager {
  private items: GameItem[] = [];
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  /**
   * Add an item to the inventory
   * @param item The item to add
   * @param quantity The quantity to add (default: 1)
   * @returns Whether the item was successfully added
   */
  public addItem(item: GameItem, quantity: number = 1): boolean {
    // Check if inventory is full
    if (this.items.length >= this.maxSize) {
      return false;
    }

    // For stackable items, check if we already have it
    if (item.stackable) {
      const existingItemIndex = this.items.findIndex(i => i.id === item.id);
      if (existingItemIndex !== -1) {
        // Update existing item quantity
        const existingItem = this.items[existingItemIndex];
        if (existingItem.quantity) {
          existingItem.quantity += quantity;
        } else {
          existingItem.quantity = quantity;
        }
        return true;
      }
    }

    // Add as a new item
    const newItem = { ...item, quantity: quantity };
    this.items.push(newItem);
    return true;
  }

  /**
   * Remove an item from the inventory
   * @param item The item to remove
   * @param quantity The quantity to remove (default: 1)
   * @returns Whether the item was successfully removed
   */
  public removeItem(item: GameItem, quantity: number = 1): boolean {
    const index = this.items.findIndex(i => i.id === item.id);
    if (index === -1) {
      return false;
    }

    const existingItem = this.items[index];
    
    // If stackable and quantity > 1, just reduce quantity
    if (existingItem.stackable && existingItem.quantity && existingItem.quantity > quantity) {
      existingItem.quantity -= quantity;
      return true;
    }
    
    // Otherwise remove the item completely
    this.items.splice(index, 1);
    return true;
  }

  /**
   * Find an item by name
   * @param name The name of the item to find
   * @returns The index of the item in the inventory, or -1 if not found
   */
  public findItem(name: string): number {
    return this.items.findIndex(item => item.name === name);
  }

  /**
   * Remove an item from a specific slot
   * @param slot The slot to remove from
   * @param quantity The quantity to remove (default: 1)
   * @returns The removed item and quantity, or null if failed
   */
  public removeItemFromSlot(slot: number, quantity: number = 1): { item: GameItem, quantity: number } | null {
    if (slot < 0 || slot >= this.items.length) {
      return null;
    }

    const item = this.items[slot];
    
    if (item.stackable && item.quantity && item.quantity > quantity) {
      // Just reduce quantity for stackable items
      item.quantity -= quantity;
      return { item, quantity };
    } else {
      // Remove the item completely
      this.items.splice(slot, 1);
      return { item, quantity: item.quantity || 1 };
    }
  }

  /**
   * Get all items in the inventory
   * @returns Array of items
   */
  public getItems(): GameItem[] {
    return [...this.items];
  }

  /**
   * Check if the inventory is full
   * @returns Whether the inventory is full
   */
  public isFull(): boolean {
    return this.items.length >= this.maxSize;
  }

  /**
   * Get the current size of the inventory
   * @returns The number of items in the inventory
   */
  public getSize(): number {
    return this.items.length;
  }

  /**
   * Get the maximum size of the inventory
   * @returns The maximum number of items the inventory can hold
   */
  public getMaxSize(): number {
    return this.maxSize;
  }

  /**
   * Clear the inventory
   */
  public clear(): void {
    this.items = [];
  }
} 