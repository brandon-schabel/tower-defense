import Phaser from "phaser";
import GameScene from "../../scenes/game-scene";
import { HealthComponent } from "../components/health-component";
import { GAME_SETTINGS } from "../../settings";
import { InventoryManager } from "../../utils/inventory-manager";
import { GameItem, WeaponItem, EquipmentItem } from "../../types/item";
import { InputManager } from "../../managers/input-manger";
import { EventBus } from "../../core/event-bus";
import ItemDropManager from "../../managers/item-drop-manager";
import CombatSystem from "../../systems/combat-system";

export default class Player extends Phaser.Physics.Arcade.Sprite {
  private healthComponent: HealthComponent;
  private movementSpeed: number = GAME_SETTINGS.player.movementSpeed; // Set default directly
  private lastShotTime: number = 0;
  private shootCooldown: number = GAME_SETTINGS.player.shootCooldown; // Set default directly
  private speedLevel: number = 0;
  private damageLevel: number = 0;
  private rangeLevel: number = 0;
  private maxHealthLevel: number = 0;
  private equippedItems: Map<string, EquipmentItem> = new Map();
  private inventory: InventoryManager;
  private equippedWeapon: WeaponItem | null = null;
  private pickupText: Phaser.GameObjects.Text | null = null;
  private invKeyText: Phaser.GameObjects.Text | null = null;
  private activeBuffs: Map<string, { value: number, endTime: number }> = new Map();
  private initialHealth: number;
  private inputManager: InputManager;
  private eventBus: EventBus;
  private combatSystem: CombatSystem;
  private itemDropManager: ItemDropManager;

  constructor(
    scene: GameScene, 
    x: number, 
    y: number,
    eventBus: EventBus,
    combatSystem: CombatSystem,
    itemDropManager: ItemDropManager
  ) {
    super(scene, x, y, 'player');
    
    this.eventBus = eventBus;
    this.combatSystem = combatSystem;
    this.itemDropManager = itemDropManager;
    
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    // Set basic properties from GAME_SETTINGS
    this.setScale(GAME_SETTINGS.player.scale);
    
    // Get starting health from settings
    this.initialHealth = GAME_SETTINGS.player.initialHealth;
    
    // Initialize health component
    this.healthComponent = new HealthComponent(
      this,
      scene,
      this.initialHealth,
      this.initialHealth,
      () => {
        scene.gameOver();
      }
    );
    
    // Initialize inventory system
    this.inventory = new InventoryManager(GAME_SETTINGS.player.inventorySize);
    
    // Create input manager for handling player input
    // Create with default key mappings
    const defaultKeyMappings = {
      'up': 'W',
      'down': 'S',
      'left': 'A',
      'right': 'D',
      'shoot': 'SPACE',
      'inventory': 'I',
      'interact': 'E'
    };
    this.inputManager = new InputManager(scene, defaultKeyMappings);
    
    // Setup pickup text
    this.pickupText = scene.add.text(x, y - 50, "", {
      fontSize: '16px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setAlpha(0);
    
    // Setup inventory key hint
    this.invKeyText = scene.add.text(x, y + 50, "Press I for Inventory", {
      fontSize: '12px',
      color: '#ffff00',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5).setAlpha(0);
    
    // Show inventory key hint briefly
    scene.time.delayedCall(1000, () => {
      if (this.invKeyText) {
        scene.tweens.add({
          targets: this.invKeyText,
          alpha: 1,
          duration: 500,
          onComplete: () => {
            scene.time.delayedCall(3000, () => {
              if (this.invKeyText) {
                scene.tweens.add({
                  targets: this.invKeyText,
                  alpha: 0,
                  duration: 500
                });
              }
            });
          }
        });
      }
    });
    
    // Set up collision with world bounds
    this.setCollideWorldBounds(true);
  }
  
  update() {
    // Update health component
    this.healthComponent.update();
    
    // Update pickup text position
    this.updatePickupTextPosition();
    
    // Handle active buffs
    this.handleActiveBuffs();
    
    // Get keyboard input directly since we don't have getControls
    const keysPressed = {
      up: this.scene.input.keyboard?.addKey('W')?.isDown || false,
      down: this.scene.input.keyboard?.addKey('S')?.isDown || false,
      left: this.scene.input.keyboard?.addKey('A')?.isDown || false,
      right: this.scene.input.keyboard?.addKey('D')?.isDown || false
    };
    
    // Apply movement with any speed buffs
    const buffedSpeed = this.getMoveSpeed();
    
    let vx = 0;
    let vy = 0;
    
    if (keysPressed.up) vy = -buffedSpeed;
    if (keysPressed.down) vy = buffedSpeed;
    if (keysPressed.left) vx = -buffedSpeed;
    if (keysPressed.right) vx = buffedSpeed;
    
    // Normalize for diagonal movement
    if (vx !== 0 && vy !== 0) {
      const length = Math.sqrt(vx * vx + vy * vy);
      vx = (vx / length) * buffedSpeed;
      vy = (vy / length) * buffedSpeed;
    }
    
    this.setVelocity(vx, vy);
    
    // Handle shooting
    this.handleShooting();
    
    // Handle item pickup with E key
    if (Phaser.Input.Keyboard.JustDown(this.scene.input.keyboard?.addKey('E') || null)) {
      this.handleItemPickup();
    }
    
    // Toggle inventory with I key
    if (Phaser.Input.Keyboard.JustDown(this.scene.input.keyboard?.addKey('I') || null)) {
      this.toggleInventoryUI();
    }
    
    // Item use keys (1-5)
    for (let i = 1; i <= 5; i++) {
      const key = this.scene.input.keyboard?.addKey(i.toString()) || null;
      if (key && Phaser.Input.Keyboard.JustDown(key)) {
        // Use item in slot i-1 (0-indexed)
        const items = this.inventory.getItems();
        if (items.length > i - 1) {
          this.handleItemUse(items[i - 1]);
        }
      }
    }
  }
  
  heal(amount: number) {
    this.healthComponent.heal(amount);
    
    // Visual feedback
    const healText = this.scene.add.text(this.x, this.y - 20, `+${amount} HP`, {
      fontSize: '16px',
      color: '#00ff00'
    }).setOrigin(0.5);
    
    this.scene.tweens.add({
      targets: healText,
      y: this.y - 50,
      alpha: 0,
      duration: 1000,
      onComplete: () => healText.destroy()
    });
  }
  
  getHealth(): number {
    return this.healthComponent.getHealth();
  }
  
  takeDamage(damage: number) {
    const hasTakenDamage = this.healthComponent.takeDamage(damage);
    
    // Visual feedback
    this.scene.tweens.add({
      targets: this,
      alpha: 0.6,
      duration: 100,
      yoyo: true
    });
    
    // Emit damage event
    this.eventBus.emit('player-damaged', {
      damage: damage,
      remainingHealth: this.healthComponent.getHealth()
    });
  }
  
  private handleShooting() {
    // Get the spacebar key state
    const shootKey = this.scene.input.keyboard?.addKey('SPACE');
    
    if (shootKey && Phaser.Input.Keyboard.JustDown(shootKey)) {
      this.shoot();
    }
  }
  
  private shoot() {
    // Check cooldown
    const currentTime = this.scene.time.now;
    if (currentTime - this.lastShotTime < this.getShootCooldown()) {
      return;
    }
    
    this.lastShotTime = currentTime;
    
    // Get the nearest enemy within range
    const enemies = (this.scene as GameScene).getEnemies();
    if (!enemies || enemies.length === 0) return;
    
    let nearestEnemy = null;
    let nearestDistance = this.getRange();
    
    for (const enemy of enemies) {
      const distance = Phaser.Math.Distance.Between(
        this.x, this.y, 
        enemy.x, enemy.y
      );
      
      if (distance < nearestDistance) {
        nearestEnemy = enemy;
        nearestDistance = distance;
      }
    }
    
    if (nearestEnemy) {
      // Determine projectile type based on equipped weapon
      let projectileType = 'player';
      if (this.equippedWeapon && this.equippedWeapon.properties) {
        if (this.equippedWeapon.properties.fireRate && this.equippedWeapon.properties.fireRate > 1.5) {
          projectileType = 'player-rapid';
        } else if (this.equippedWeapon.properties.damage && this.equippedWeapon.properties.damage > 1.5) {
          projectileType = 'player-power';
        }
      }
      
      // Use combat system to shoot projectile
      this.combatSystem.shootProjectile(
        this,
        nearestEnemy.x,
        nearestEnemy.y,
        this.getDamage(),
        projectileType
      );
      
      // Visual feedback - muzzle flash
      const angle = Phaser.Math.Angle.Between(this.x, this.y, nearestEnemy.x, nearestEnemy.y);
      
      // Emit shoot event
      this.eventBus.emit('player-shot', {
        target: {
          x: nearestEnemy.x,
          y: nearestEnemy.y
        },
        angle: angle,
        damage: this.getDamage()
      });
      
      return true;
    }
    
    return false;
  }
  
  public getMoveSpeed(): number {
    // Base speed + upgrade bonus
    let speed = GAME_SETTINGS.player.movementSpeed;
    
    // Add speed level bonus (10% per level)
    speed += (speed * 0.1 * this.speedLevel);
    
    // Apply any active buffs
    if (this.activeBuffs.has('speed')) {
      const buff = this.activeBuffs.get('speed');
      if (buff) {
        speed *= buff.value;
      }
    }
    
    // Check for equipment bonuses
    this.equippedItems.forEach(item => {
      if (item.properties && item.properties.speedBonus) {
        speed *= (1 + item.properties.speedBonus);
      }
    });
    
    return speed;
  }
  
  public getDamage(): number {
    // Base damage + upgrade bonus
    let damage = GAME_SETTINGS.player.damage;
    
    // Add damage level bonus (15% per level)
    damage += (damage * 0.15 * this.damageLevel);
    
    // Apply any active buffs
    if (this.activeBuffs.has('damage')) {
      const buff = this.activeBuffs.get('damage');
      if (buff) {
        damage *= buff.value;
      }
    }
    
    // Check for equipment bonuses, especially weapon
    if (this.equippedWeapon && this.equippedWeapon.properties && this.equippedWeapon.properties.damage) {
      damage *= this.equippedWeapon.properties.damage;
    }
    
    this.equippedItems.forEach(item => {
      if (item.properties && item.properties.damageBonus) {
        damage *= (1 + item.properties.damageBonus);
      }
    });
    
    return Math.round(damage);
  }
  
  private getShootCooldown(): number {
    // Base cooldown - lower is faster
    let cooldown = GAME_SETTINGS.player.shootCooldown;
    
    // Reduce cooldown with speed upgrades (5% per level)
    cooldown *= (1 - 0.05 * this.speedLevel);
    
    // Apply weapon modifiers
    if (this.equippedWeapon && this.equippedWeapon.properties && this.equippedWeapon.properties.fireRate) {
      cooldown /= this.equippedWeapon.properties.fireRate;
    }
    
    // Apply any active buffs
    if (this.activeBuffs.has('attackSpeed')) {
      const buff = this.activeBuffs.get('attackSpeed');
      if (buff) {
        cooldown /= buff.value;
      }
    }
    
    // Ensure there's always some minimum cooldown
    return Math.max(50, cooldown);
  }
  
  public getRange(): number {
    // Base range + upgrade bonus
    let range = GAME_SETTINGS.player.attackRange;
    
    // Add range level bonus (10% per level)
    range += (range * 0.1 * this.rangeLevel);
    
    // Apply any active buffs
    if (this.activeBuffs.has('range')) {
      const buff = this.activeBuffs.get('range');
      if (buff) {
        range *= buff.value;
      }
    }
    
    // Check for equipment bonuses
    if (this.equippedWeapon && this.equippedWeapon.properties && this.equippedWeapon.properties.range) {
      range *= this.equippedWeapon.properties.range;
    }
    
    this.equippedItems.forEach(item => {
      if (item.properties && item.properties.rangeBonus) {
        range *= (1 + item.properties.rangeBonus);
      }
    });
    
    return range;
  }
  
  public getMaxHealth(): number {
    // Base health + upgrade bonus
    let maxHealth = GAME_SETTINGS.player.initialHealth;
    
    // Add health level bonus (15% per level)
    maxHealth += (maxHealth * 0.15 * this.maxHealthLevel);
    
    // Apply any active buffs
    if (this.activeBuffs.has('maxHealth')) {
      const buff = this.activeBuffs.get('maxHealth');
      if (buff) {
        maxHealth *= buff.value;
      }
    }
    
    // Check for equipment bonuses
    this.equippedItems.forEach(item => {
      if (item.properties && item.properties.healthBonus) {
        maxHealth *= (1 + item.properties.healthBonus);
      }
    });
    
    return Math.round(maxHealth);
  }
  
  public upgradeAttribute(attribute: 'speed' | 'damage' | 'range' | 'health', cost: number): boolean {
    // Handle the different attribute upgrades
    if (attribute === 'speed') {
      this.speedLevel++;
    } else if (attribute === 'damage') {
      this.damageLevel++;
    } else if (attribute === 'range') {
      this.rangeLevel++;
    } else if (attribute === 'health') {
      this.maxHealthLevel++;
      // Update max health in the health component
      this.healthComponent.setMaxHealth(this.getMaxHealth(), true);
    }
    
    // Emit upgrade event
    this.eventBus.emit('player-upgraded', {
      attribute: attribute,
      newLevel: attribute === 'health' ? this.maxHealthLevel : this[`${attribute}Level`]
    });
    
    return true;
  }
  
  public equipItem(item: GameItem): void {
    // Logic to equip item based on type
    if (item.type === 'weapon') {
      this.equippedWeapon = item as WeaponItem;
      this.equippedItems.set('weapon', item as EquipmentItem);
    } else if (item.type === 'equipment') {
      this.equippedItems.set(item.slot || 'accessory', item as EquipmentItem);
    }
    
    // Apply item stats
    if (item.properties) {
      this.applyItemStats(item.properties);
    }
  }
  
  public unequipItem(slot: string): void {
    const item = this.equippedItems.get(slot);
    if (!item) return;
    
    // Remove item stats
    if (item.properties) {
      this.removeItemStats(item.properties);
    }
    
    // Clear equipped slot
    this.equippedItems.delete(slot);
    if (slot === 'weapon') this.equippedWeapon = null;
  }
  
  public getEquippedItems(): Map<string, GameItem> {
    return this.equippedItems;
  }
  
  private applyItemStats(stats: any) {
    // Apply various stat bonuses from the item
    if (stats.healthBonus) {
      this.healthComponent.setMaxHealth(this.getMaxHealth());
    }
  }
  
  private removeItemStats(stats: any) {
    // Remove stat bonuses when unequipping
    if (stats.healthBonus) {
      this.healthComponent.setMaxHealth(this.getMaxHealth());
    }
  }
  
  public getInventory(): InventoryManager { // Add a getter for the inventory
    return this.inventory;
  }
  
  private handleItemPickup(): void {
    try {
        const nearbyItem = this.itemDropManager.getItemInPickupRange(this.x, this.y);

        if (!nearbyItem) return;

        const success = this.addItemToInventory(nearbyItem.item, nearbyItem.quantity);
        
        if (success) {
            // Show pickup message
            const itemName = nearbyItem.item.name || "Item";
            const scene = this.scene as GameScene;
            scene.showPickupMessage(`Picked up: ${itemName}`);
            
            // Remove the item from the ground
            this.itemDropManager.removeItem(nearbyItem);
            
            // Update the inventory UI if it's visible
            if (scene.getGameState().isInventoryOpen) {
                scene.toggleInventoryUI();
                scene.toggleInventoryUI();
            }
            
            // Emit event for item pickup
            this.eventBus.emit('item-picked-up', {
                item: nearbyItem.item,
                quantity: nearbyItem.quantity
            });
        }
    } catch (error) {
        console.error("Error in handleItemPickup:", error);
    }
  }

  /**
   * Handle using items (consumables)
   */
  private handleItemUse(item: GameItem): void {
    // Only process on button press, not continuously
    if (!item) return;
    
    // Consumable items
    if (item.type === 'consumable') {
      // Apply consumable effects
      if (item.properties) {
        // Health potions
        if (item.properties.healthRestore) {
          this.heal(item.properties.healthRestore);
        }
        
        // Buffs
        if (item.properties.buffs) {
          for (const [buffType, buffData] of Object.entries(item.properties.buffs)) {
            const { value, duration } = buffData as { value: number, duration: number };
            this.addTemporaryBuff(buffType, value, duration);
          }
        }
      }
      
      // Remove from inventory after use
      this.inventory.removeItem(item);
      
      // Emit event for item use
      this.eventBus.emit('item-used', {
        item: item
      });
      
      // Update the inventory UI if it's visible
      const scene = this.scene as GameScene;
      if (scene.getGameState().isInventoryOpen) {
        scene.toggleInventoryUI();
        scene.toggleInventoryUI();
      }
    }
    // Equipment items
    else if (item.type === 'equipment' || item.type === 'weapon') {
      // Try to equip the item
      this.equipItem(item);
      
      // Remove from inventory
      this.inventory.removeItem(item);
      
      // Emit equip event
      this.eventBus.emit('item-equipped', {
        item: item
      });
      
      // Update the inventory UI
      const scene = this.scene as GameScene;
      if (scene.getGameState().isInventoryOpen) {
        scene.toggleInventoryUI();
        scene.toggleInventoryUI();
      }
    }
  }
  
  private toggleInventoryUI(): void {
    (this.scene as GameScene).toggleInventoryUI();
  }
  
  public destroy(fromScene?: boolean): void {
    // Clean up health component
    this.healthComponent.cleanup();
    
    // Clean up text objects
    if (this.pickupText) {
      this.pickupText.destroy();
      this.pickupText = null;
    }
    
    if (this.invKeyText) {
      this.invKeyText.destroy();
      this.invKeyText = null;
    }
    
    // Call parent destroy method
    super.destroy(fromScene);
  }
  
  public addTemporaryBuff(buffType: string, value: number, duration: number): void {
    // Calculate end time
    const currentTime = this.scene.time.now;
    const endTime = currentTime + duration;
    
    // Add or update buff
    this.activeBuffs.set(buffType, { value, endTime });
    
    // Visual feedback
    const buffText = this.scene.add.text(this.x, this.y - 30, `${buffType} +${value}x`, {
      fontSize: '14px',
      color: '#00ffff',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);
    
    this.scene.tweens.add({
      targets: buffText,
      y: '-=20',
      alpha: 0,
      duration: 1500,
      onComplete: () => buffText.destroy()
    });
    
    // Apply the buff effects immediately
    // (This might update max health, movement speed, etc.)
    if (buffType === 'health') {
      this.heal(Math.round(this.getHealth() * value));
    } else if (buffType === 'maxHealth') {
      this.healthComponent.setMaxHealth(this.getMaxHealth());
    }
    
    // Emit buff event
    this.eventBus.emit('player-buff-added', {
      buffType: buffType,
      value: value,
      duration: duration
    });
  }
  
  public getActiveBuffs(): Map<string, { value: number, endTime: number }> {
    return this.activeBuffs;
  }
  
  private handleActiveBuffs() {
    const currentTime = this.scene.time.now;
    
    // Check all active buffs
    this.activeBuffs.forEach((buff, buffType) => {
      if (currentTime >= buff.endTime) {
        // Buff has expired, remove it
        this.activeBuffs.delete(buffType);
        
        // Emit event for buff expiry
        this.eventBus.emit('player-buff-expired', {
          buffType: buffType
        });
      }
    });
  }
  
  private updatePickupTextPosition() {
    if (this.pickupText) {
      this.pickupText.setPosition(this.x, this.y - 50);
    }
    if (this.invKeyText) {
      this.invKeyText.setPosition(this.x, this.y + 50);
    }
  }
  
  public addItemToInventory(item: GameItem, quantity: number = 1): boolean {
    return this.inventory.addItem(item, quantity);
  }
}