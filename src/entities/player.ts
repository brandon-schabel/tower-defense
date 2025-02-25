import Phaser from "phaser";
import GameScene from "../scenes/game-scene";
import { GAME_SETTINGS } from "../settings"; // Import
import InventoryManager from "../utils/inventory-manager";
import { DroppedItem, GameItem, ItemType, WeaponItem, ItemRarity } from "../types/item";
import { HealthComponent } from "../utils/health-component"; // Import HealthComponent

// Define Equipment item interface
interface EquipmentItem {
  id: string;
  name: string;
  tier: number;
  slot: string;
  texture?: string;
  description?: string;
  stats: {
    damageBonus?: number;
    rangeBonus?: number;
    speedBonus?: number;
    healthBonus?: number;
  };
}

export default class Player extends Phaser.Physics.Arcade.Sprite {
  private healthComponent: HealthComponent; // Replace health and healthBar
  private movementSpeed: number = GAME_SETTINGS.player.movementSpeed; // Use from settings
  // private shootRange: number = GAME_SETTINGS.player.shootRange; // Use from settings
  private lastShotTime: number = 0;
  private shootCooldown: number = GAME_SETTINGS.player.shootCooldown; // Use from settings
  private keys: { 
    up: Phaser.Input.Keyboard.Key; 
    down: Phaser.Input.Keyboard.Key; 
    left: Phaser.Input.Keyboard.Key; 
    right: Phaser.Input.Keyboard.Key; 
    shoot: Phaser.Input.Keyboard.Key;
    pickup: Phaser.Input.Keyboard.Key;
    useItem: Phaser.Input.Keyboard.Key;
  };
  private speedLevel: number = 0;
  private damageLevel: number = 0;
  private rangeLevel: number = 0;
  private maxHealthLevel: number = 0;
  private equippedItems: Map<string, EquipmentItem> = new Map();
  
  // Inventory system
  private inventory: InventoryManager;
  private equippedWeapon: WeaponItem | null = null;
  private pickupText: Phaser.GameObjects.Text | null = null;
  private invKeyText: Phaser.GameObjects.Text | null = null;

  // Add after the getRange() method
  private activeBuffs: Map<string, { value: number, endTime: number }> = new Map();

  constructor(scene: GameScene, x: number, y: number) {
    super(scene, x, y, "user");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);

    // Initialize health component with initial health values
    // We'll update the max health after all player stats are initialized
    this.healthComponent = new HealthComponent(
      this,
      scene,
      GAME_SETTINGS.player.initialHealth,
      GAME_SETTINGS.player.initialHealth,
      () => {
        console.log("User died!");
        (this.scene as GameScene).gameOver();
      }
    );
    
    // Initialize inventory
    this.inventory = new InventoryManager(20); // 20 slots

    // Initialize keys
    this.keys = scene.input.keyboard!.addKeys({
      up: 'W', 
      down: 'S', 
      left: 'A', 
      right: 'D', 
      shoot: 'SPACE',
      pickup: 'E',
      useItem: 'Q'
    }) as {
      up: Phaser.Input.Keyboard.Key;
      down: Phaser.Input.Keyboard.Key;
      left: Phaser.Input.Keyboard.Key;
      right: Phaser.Input.Keyboard.Key;
      shoot: Phaser.Input.Keyboard.Key;
      pickup: Phaser.Input.Keyboard.Key;
      useItem: Phaser.Input.Keyboard.Key;
    };
    
    // Create pickup prompt text (hidden by default)
    this.pickupText = this.scene.add.text(
      this.x, 
      this.y - 50, 
      "Press E to pick up", 
      { fontSize: '14px', color: '#FFFFFF' }
    );
    this.pickupText.setOrigin(0.5);
    this.pickupText.setVisible(false);
    
    // Create inventory key prompt
    this.invKeyText = this.scene.add.text(
      10, 
      10, 
      "I: Inventory", 
      { fontSize: '14px', color: '#FFFFFF' }
    );
    this.invKeyText.setScrollFactor(0); // Fix to camera
    
    // Setup inventory key
    scene.input.keyboard!.on('keydown-I', () => {
      this.toggleInventoryUI();
    });
    
    // Make sure max health is properly set after all initialization
    this.getMaxHealth();
  }

  update() {
    const velocity = new Phaser.Math.Vector2(0, 0);
    const speed = this.getMoveSpeed();

    if (this.keys.up.isDown) velocity.y = -speed;
    if (this.keys.down.isDown) velocity.y = speed;
    if (this.keys.left.isDown) velocity.x = -speed;
    if (this.keys.right.isDown) velocity.x = speed;

    if (velocity.length() > 0) {
      velocity.normalize().scale(speed);
    }

    this.setVelocity(velocity.x, velocity.y);

    // Rotate user to face mouse cursor
    const pointer = (this.scene as GameScene).input.activePointer;
    this.rotation = Phaser.Math.Angle.Between(this.x, this.y, pointer.x, pointer.y);

    this.handleShooting();
    this.handleItemPickup();
    this.handleItemUse();
    
    // Update health component
    this.healthComponent.update();
    
    // Update floating text positions
    if (this.pickupText) {
      this.pickupText.setPosition(this.x, this.y - 50);
    }
  }

  heal(amount: number) {
    this.healthComponent.heal(amount);
  }

  getHealth(): number {
    return this.healthComponent.getHealth();
  }

  takeDamage(damage: number) {
    if (!this.active) return; // Exit if the user is already destroyed
    this.healthComponent.takeDamage(damage);
  }

  private handleShooting() {
    const currentTime = (this.scene as GameScene).time.now;
    const cooldown = this.equippedWeapon?.cooldown || this.shootCooldown;

    if (this.keys.shoot.isDown && currentTime - this.lastShotTime >= cooldown) {
      this.shoot();
      this.lastShotTime = currentTime;
    }
  }

  private shoot() {
    const gameScene = this.scene as GameScene;
    const enemies = gameScene.getEnemies();

    // Find closest enemy in range
    let closestEnemy: Phaser.Physics.Arcade.Sprite | null = null;
    let closestDistance = this.getRange(); // Use current range

    enemies.forEach(enemy => {
      const distance = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
      if (distance < closestDistance) {
        closestEnemy = enemy;
        closestDistance = distance;
      }
    });

    if (closestEnemy) {
      // Use equipped weapon if available, otherwise use default
      const damage = this.equippedWeapon?.damage || this.getDamage();
      const projectileType = this.equippedWeapon?.projectileType || 'player';
      
      // Shoot projectile with player's current damage
      gameScene.shootProjectile(this, closestEnemy, damage, projectileType);
    }
  }

  public getMoveSpeed(): number {
    const baseSpeed = GAME_SETTINGS.player.movementSpeed * (1 + 0.1 * this.speedLevel);
    let equipmentBonus = 0;

    // Add equipment bonuses
    this.equippedItems.forEach(item => {
      if (item.stats.speedBonus) {
        equipmentBonus += item.stats.speedBonus;
      }
    });

    return baseSpeed * (1 + equipmentBonus);
  }

  public getDamage(): number {
    const baseDamage = GAME_SETTINGS.player.projectileDamage * (1 + 0.2 * this.damageLevel);
    let equipmentBonus = 0;

    this.equippedItems.forEach(item => {
      if (item.stats.damageBonus) {
        equipmentBonus += item.stats.damageBonus;
      }
    });

    return baseDamage + equipmentBonus;
  }

  public getRange(): number {
    // Use weapon range if available
    if (this.equippedWeapon?.range) {
      return this.equippedWeapon.range;
    }
    
    const baseRange = GAME_SETTINGS.player.shootRange + (25 * this.rangeLevel);
    let equipmentBonus = 0;

    this.equippedItems.forEach(item => {
      if (item.stats.rangeBonus) {
        equipmentBonus += item.stats.rangeBonus;
      }
    });

    return baseRange + equipmentBonus;
  }

  public getMaxHealth(): number {
    const baseMaxHealth = GAME_SETTINGS.player.initialHealth * (1 + 0.15 * this.maxHealthLevel);
    let equipmentBonus = 0;

    this.equippedItems.forEach(item => {
      if (item.stats.healthBonus) {
        equipmentBonus += item.stats.healthBonus;
      }
    });

    const totalMaxHealth = baseMaxHealth + equipmentBonus;
    
    // Ensure the health component's max health is in sync
    // Only update if it's different to avoid unnecessary updates
    if (this.healthComponent.getMaxHealth() !== totalMaxHealth) {
      this.healthComponent.setMaxHealth(totalMaxHealth, true);
    }
    
    return totalMaxHealth;
  }

  public upgradeAttribute(attribute: 'speed' | 'damage' | 'range' | 'health', cost: number): boolean {
    const gameScene = this.scene as GameScene;

    if (!gameScene.getGameState().spendResources(cost)) {
      return false;
    }

    switch (attribute) {
      case 'speed':
        this.speedLevel++;
        break;
      case 'damage':
        this.damageLevel++;
        break;
      case 'range':
        this.rangeLevel++;
        break;
      case 'health':
        this.maxHealthLevel++;
        // The getMaxHealth method will update the health component
        this.getMaxHealth();
        break;
    }

    return true;
  }

  public equipItem(item: EquipmentItem): boolean {
    // Check if an item is already equipped in this slot
    if (this.equippedItems.has(item.slot)) {
      const currentItem = this.equippedItems.get(item.slot)!;
      // Unequip current item - add back to inventory or drop
      const gameScene = this.scene as GameScene;
      // Create a GameItem from the EquipmentItem
      const gameItem: GameItem = {
        id: currentItem.id,
        name: currentItem.name,
        description: `${currentItem.name} (${currentItem.slot})`,
        type: ItemType.ARMOR, // Default to ARMOR type
        rarity: ItemRarity.COMMON, // Default rarity
        value: 0,
        texture: 'armor-default',
        stackable: false
      };
      gameScene.addItemToInventory(gameItem);
    }

    // Equip the new item
    this.equippedItems.set(item.slot, item);

    // Update the player's appearance based on equipped items
    this.updateAppearance();
    
    // Update max health if the item affects health
    if (item.stats.healthBonus) {
      this.getMaxHealth(); // This will update the health component
    }

    return true;
  }

  private updateAppearance() {
    // For now, a simple implementation that changes the player's color
    // Later this could be expanded to use composited SVGs

    // Reset appearance
    this.clearTint();

    // Apply visual effects from equipment
    let hasArmor = false;
    let hasWeapon = false;
    let hasHelmet = false;

    this.equippedItems.forEach(item => {
      switch (item.slot) {
        case 'armor':
          hasArmor = true;
          // Color the center of the player based on armor tier
          switch (item.tier) {
            case 1: this.setTint(0x8B8B8B); break; // Iron
            case 2: this.setTint(0xFFD700); break; // Gold
            case 3: this.setTint(0x00BFFF); break; // Diamond
            case 4: this.setTint(0xFF4500); break; // Mythical
            case 5: this.setTint(0xFF00FF); break; // Legendary
          }
          break;

        case 'weapon':
          hasWeapon = true;
          // Change projectile appearance later
          break;

        case 'helmet':
          hasHelmet = true;
          // Add a helmet sprite as a child
          break;
      }
    });
  }
  
  // New inventory and item methods
  
  /**
   * Get the player's inventory manager
   */
  public getInventory(): InventoryManager {
    return this.inventory;
  }
  
  /**
   * Add item to player's inventory
   */
  public addItemToInventory(item: GameItem, quantity: number = 1): boolean {
    const added = this.inventory.addItem(item, quantity);
    
    // If it's a weapon, and we don't have one equipped, auto-equip it
    if (added && item.type === ItemType.WEAPON && !this.equippedWeapon) {
      this.equipWeapon(item as WeaponItem);
    }
    
    return added;
  }
  
  /**
   * Equip a weapon from inventory
   */
  public equipWeapon(weapon: WeaponItem): void {
    this.equippedWeapon = weapon;
    
    // Visual feedback
    const gameScene = this.scene as GameScene;
    const equipText = gameScene.add.text(
      this.x, 
      this.y - 40, 
      `Equipped ${weapon.name}`, 
      { fontSize: '16px', color: '#00FF00' }
    );
    equipText.setOrigin(0.5);
    
    // Fade out and destroy
    gameScene.tweens.add({
      targets: equipText,
      alpha: 0,
      y: this.y - 60,
      duration: 1500,
      onComplete: () => equipText.destroy()
    });
  }
  
  /**
   * Handle picking up items
   */
  private handleItemPickup(): void {
    const gameScene = this.scene as GameScene;
    const itemDropManager = gameScene.getItemDropManager();
    
    if (!itemDropManager) return;
    
    // Check if there's an item in range
    const nearbyItem = itemDropManager.getItemInPickupRange(this.x, this.y);
    
    // Show/hide pickup prompt
    if (this.pickupText) {
      this.pickupText.setVisible(!!nearbyItem);
    }
    
    // Handle pickup key press
    if (nearbyItem && Phaser.Input.Keyboard.JustDown(this.keys.pickup)) {
      const added = this.addItemToInventory(nearbyItem.item, nearbyItem.quantity);
      
      if (added) {
        // Remove from world
        itemDropManager.removeItem(nearbyItem);
        
        // Show pickup message
        const pickupMsg = gameScene.add.text(
          this.x, 
          this.y - 40, 
          `Picked up ${nearbyItem.quantity}x ${nearbyItem.item.name}`, 
          { fontSize: '16px', color: '#FFFFFF' }
        );
        pickupMsg.setOrigin(0.5);
        
        // Fade out and destroy
        gameScene.tweens.add({
          targets: pickupMsg,
          alpha: 0,
          y: this.y - 60,
          duration: 1500,
          onComplete: () => pickupMsg.destroy()
        });
      } else {
        // Inventory full message
        const fullMsg = gameScene.add.text(
          this.x, 
          this.y - 40, 
          `Inventory full!`, 
          { fontSize: '16px', color: '#FF0000' }
        );
        fullMsg.setOrigin(0.5);
        
        // Fade out and destroy
        gameScene.tweens.add({
          targets: fullMsg,
          alpha: 0,
          y: this.y - 60,
          duration: 1500,
          onComplete: () => fullMsg.destroy()
        });
      }
    }
  }
  
  /**
   * Handle using items (consumables)
   */
  private handleItemUse(): void {
    // Only process on button press, not continuously
    if (!Phaser.Input.Keyboard.JustDown(this.keys.useItem)) return;
    
    const gameScene = this.scene as GameScene;
    
    // Get the selected inventory slot (for now we'll use the first health item found)
    const healthItemSlot = this.inventory.findItem('small-health');
    if (healthItemSlot === -1) return;
    
    // Remove the item from inventory
    const result = this.inventory.removeItemFromSlot(healthItemSlot, 1);
    if (!result) return;
    
    const item = result.item;
    
    // Handle item based on type
    if (item.type === ItemType.HEALTH) {
      const healthItem = item as import('../types/item').HealthItem;
      this.heal(healthItem.healAmount);
      
      // Show healing effect
      const healText = gameScene.add.text(
        this.x, 
        this.y - 40, 
        `+${healthItem.healAmount} HP`, 
        { fontSize: '16px', color: '#00FF00' }
      );
      healText.setOrigin(0.5);
      
      // Fade out and destroy
      gameScene.tweens.add({
        targets: healText,
        alpha: 0,
        y: this.y - 60,
        duration: 1500,
        onComplete: () => healText.destroy()
      });
    }
  }
  
  /**
   * Toggle inventory UI visibility
   */
  private toggleInventoryUI(): void {
    const gameScene = this.scene as GameScene;
    gameScene.toggleInventoryUI();
  }
  
  /**
   * Clean up resources when player is destroyed
   */
  public destroy(fromScene?: boolean): void {
    if (this.pickupText) {
      this.pickupText.destroy();
    }
    
    if (this.invKeyText) {
      this.invKeyText.destroy();
    }
    
    this.healthComponent.cleanup();
    super.destroy(fromScene);
  }

  public addTemporaryBuff(buffType: string, value: number, duration: number): void {
    // Store the buff with an end time
    const endTime = this.scene.time.now + duration;
    this.activeBuffs.set(buffType, { value, endTime });
    
    // Schedule removal
    this.scene.time.delayedCall(duration, () => {
      this.activeBuffs.delete(buffType);
      
      // If this was a health buff, update max health when it expires
      if (buffType === 'health' || buffType === 'maxHealth') {
        this.getMaxHealth();
      }
    });
    
    // If this is a health buff, update max health immediately
    if (buffType === 'health' || buffType === 'maxHealth') {
      this.getMaxHealth();
    }
    
    // Visual feedback
    const buffText = this.scene.add.text(
      this.x, 
      this.y - 50, 
      `${buffType} +${value}`, 
      { fontSize: '16px', color: '#ffff00' }
    );
    buffText.setOrigin(0.5);
    
    this.scene.tweens.add({
      targets: buffText,
      alpha: 0,
      y: this.y - 80,
      duration: 1500,
      onComplete: () => buffText.destroy()
    });
    
    // Update UI if we have HUD
    const gameScene = this.scene as GameScene;
    if (gameScene.getHUD) {
      gameScene.getHUD().updatePowerUpsDisplay(this.activeBuffs);
    }
  }

  public getActiveBuffs(): Map<string, { value: number, endTime: number }> {
    return this.activeBuffs;
  }

  // Add getter for equipped items
  public getEquippedItems(): Map<string, EquipmentItem> {
    return this.equippedItems;
  }
}