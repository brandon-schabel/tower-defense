import Phaser from "phaser";
import GameScene from "../scenes/game-scene";
import InventoryManager from "../managers/inventory-manager";
import { GameItem, ItemType, WeaponItem, EquipmentItem } from "../types/item";
import { HealthComponent } from "../utils/health-component";
import { InputManager } from "../managers/input-manger";
import { ConfigManager } from "../managers/config-manager"; // Import ConfigManager
import ResearchTree, { ResearchNode } from "../utils/research-tree"; // Import ResearchTree and ResearchNode
import { gameConfig } from "../utils/app-config";

export default class Player extends Phaser.Physics.Arcade.Sprite {
  private healthComponent: HealthComponent;
  private movementSpeed: number; //  = GAME_SETTINGS.player.movementSpeed; // Use from settings - now set in constructor
  // private shootRange: number = GAME_SETTINGS.player.shootRange; // Use from settings -  not used directly, getRange() used instead
  private lastShotTime: number = 0;
  private shootCooldown: number; // = GAME_SETTINGS.player.shootCooldown; // Use from settings - now set in constructor
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
  private initialHealth: number;

  private inputManager: InputManager; // Add InputManager

  private researchTree: ResearchTree;

  constructor(scene: GameScene, x: number, y: number) {
    super(scene, x, y, "user");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);

    // Get ConfigManager instance

    // Use ConfigManager to get player settings (initial values)
    this.movementSpeed = (gameConfig.getConfig('player')?.movementSpeed) || -1;
    this.shootCooldown = (gameConfig.getConfig('player')?.shootCooldown) || -1;

    // Get ResearchTree instance
    this.researchTree = ResearchTree.getInstance();

    this.initialHealth = (gameConfig.getConfig('player')?.initialHealth) || -1;

    if (this.initialHealth === -1) {
      console.error('Initial health not found in game config');
    }

    // Apply research effects (in constructor, we apply *initial* health bonus)
    const playerHealthLevel = this.researchTree.getResearchLevel('player_health');
    let healthBonus = 0;
    for (let i = 0; i < playerHealthLevel; i++) {
      const node = this.researchTree.getResearchNode('player_health');
      if (node && node.effects && node.effects.playerHealthMultiplier) {
        healthBonus += this.initialHealth * node.effects.playerHealthMultiplier;
      }
    }

    // Initialize health component with initial health values and research bonus
    this.healthComponent = new HealthComponent(
      this,
      scene,
      this.initialHealth + healthBonus, // Apply health bonus from research
      this.initialHealth + healthBonus, // Apply health bonus from research
      () => {
        console.log("User died!");
        (this.scene as GameScene).gameOver();
      }
    );

    // Initialize inventory
    this.inventory = new InventoryManager();
    this.inventory.clear(); // Clear the inventory for testing

    // Input Manager setup - Ensure 'pickup' is 'E'
    this.inputManager = new InputManager(scene, {
      moveUp: "W",
      moveDown: "S",
      moveLeft: "A",
      moveRight: "D",
      shoot: "SPACE",
      pickup: "E", // Correct pickup key
      useItem: "Q"
    });

    this.inputManager.onAction("shoot", () => this.handleShooting());
    this.inputManager.onAction("pickup", () => this.handleItemPickup());
    this.inputManager.onAction("useItem", () => this.handleItemUse());

    // Create pickup prompt text (hidden by default)
    this.pickupText = this.scene.add.text(
      this.x,
      this.y - 50,
      "Press E to pick up", // Correct prompt text
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
    this.getMaxHealth(); // Recalculate max health after research
  }

  update() {
    this.inputManager.update();

    const velocity = new Phaser.Math.Vector2(0, 0);
    const speed = this.getMoveSpeed();

    if (this.inputManager.keyMappings.moveUp.isDown) velocity.y = -speed; // Use keyMappings from InputManager
    if (this.inputManager.keyMappings.moveDown.isDown) velocity.y = speed;
    if (this.inputManager.keyMappings.moveLeft.isDown) velocity.x = -speed;
    if (this.inputManager.keyMappings.moveRight.isDown) velocity.x = speed;

    if (velocity.length() > 0) {
      velocity.normalize().scale(speed);
    }

    this.setVelocity(velocity.x, velocity.y);

    // Rotate user to face mouse cursor
    const pointer = (this.scene as GameScene).input.activePointer;
    this.rotation = Phaser.Math.Angle.Between(this.x, this.y, pointer.x, pointer.y);

    this.handleActiveBuffs();
    this.updatePickupTextPosition();
    this.healthComponent.update();

    // Debugging item detection:
    const gameScene = this.scene as GameScene;
    const itemDropManager = gameScene.getItemDropManager();
    if (itemDropManager) { // Check if itemDropManager exists
        const nearbyItem = itemDropManager.getItemInPickupRange(this.x, this.y);
        console.log('Nearby item:', nearbyItem); // Log nearby item
        if (this.pickupText) {
            this.pickupText.setVisible(!!nearbyItem);
        }
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
    (this.scene as GameScene).eventBus.emit('player-damaged', { damage, health: this.getHealth() }); // Emit player-damaged event
  }

  private handleShooting() {
    const currentTime = (this.scene as GameScene).time.now;
    const cooldown = this.equippedWeapon?.cooldown || this.getShootCooldown(); // Use getter

    if (this.inputManager.keyMappings.shoot.isDown && currentTime - this.lastShotTime >= cooldown) {
      this.shoot();
    }
  }

  private shoot() {
    const gameScene = this.scene as GameScene;
    const pointer = gameScene.input.activePointer;

    // Get world position of pointer
    const worldPoint = pointer.positionToCamera(gameScene.cameras.main) as Phaser.Math.Vector2;

    // Calculate angle between player and pointer
    const angle = Phaser.Math.Angle.Between(this.x, this.y, worldPoint.x, worldPoint.y);

    // Get damage value from equipped weapon or default
    const damage = this.equippedWeapon?.damage || this.getDamage();
    const projectileType = this.equippedWeapon?.projectileType || 'player';

    // Create a projectile -  Now using gameScene.createProjectile
    const projectile = gameScene.createProjectile(this.x, this.y, 'projectile');

    projectile.setData('damage', damage);
    projectile.setData('source', this);
    projectile.setData('type', projectileType);


    // Set appearance based on projectile type
    switch (projectileType) {
      case 'player-rapid':
        console.log('player-rapid');
        projectile.setTint(0x00ffff);
        projectile.setScale(0.6);
        break;
      case 'player-power':
        console.log('player-power');
        projectile.setTint(0xff0000);
        projectile.setScale(1.5);
        break;
      default:
        console.log('default');
        projectile.setTint(0x00ff00); // Default green for player projectiles
        projectile.setScale(0.25);
        break;
    }

    // Set rotation to match direction
    projectile.setRotation(angle);

    // Calculate velocity components
    const speed = 400; // Projectile speed
    if (projectile.body) {
      gameScene.physics.velocityFromRotation(angle, speed, (projectile.body as Phaser.Physics.Arcade.Body).velocity);
    }

    // Set timeout to destroy projectile after time
    gameScene.time.delayedCall(3000, () => {
      if (projectile.active) {
        projectile.destroy();
      }
    });

    // Update last shot time.  Moved from handleShooting()
    this.lastShotTime = (this.scene as GameScene).time.now;
  }

  // Apply research effects to movement speed
  public getMoveSpeed(): number {
    let baseSpeed = (gameConfig.getConfig('player')?.movementSpeed) || -1;
    let equipmentBonus = 0;

    if (baseSpeed === -1) {
      console.error('Base speed not found in game config');
    }

    // Add equipment bonuses
    this.equippedItems.forEach(item => {
      if (item.stats.speedBonus) {
        equipmentBonus += item.stats.speedBonus;
      }
    });

    // Apply research effects
    const playerSpeedLevel = this.researchTree.getResearchLevel('player_speed'); // Assuming you add a player_speed node
    if (playerSpeedLevel > 0) {
      const node = this.researchTree.getResearchNode('player_speed');
      if (node && node.effects && node.effects.playerSpeedMultiplier) {
        baseSpeed *= (1 + node.effects.playerSpeedMultiplier * playerSpeedLevel);
      }
    }

    return baseSpeed * (1 + equipmentBonus);
  }

  // Apply research effects to damage
  public getDamage(): number {
    let baseDamage = (gameConfig.getConfig('player')?.projectileDamage) || -1;
    let equipmentBonus = 0;

    if (baseDamage === -1) {
      console.error('Base damage not found in game config');
    }

    this.equippedItems.forEach(item => {
      if (item.stats.damageBonus) {
        equipmentBonus += item.stats.damageBonus;
      }
    });

    // Apply research effects
    const playerDamageLevel = this.researchTree.getResearchLevel('player_damage');
    if (playerDamageLevel > 0) {
      const node = this.researchTree.getResearchNode('player_damage');
      if (node && node.effects && node.effects.playerDamageMultiplier) {
        baseDamage *= (1 + node.effects.playerDamageMultiplier * playerDamageLevel);
      }
    }

    return baseDamage + equipmentBonus;
  }

  // Apply research effects to shoot cooldown
  private getShootCooldown(): number {
    let cooldown = (gameConfig.getConfig('player')?.shootCooldown) || -1;

    if (cooldown === -1) {
      console.error('Shoot cooldown not found in game config');
    }

    const playerCooldownLevel = this.researchTree.getResearchLevel('player_cooldown'); // Assuming a player_cooldown node
    if (playerCooldownLevel > 0) {
      const node = this.researchTree.getResearchNode('player_cooldown');
      if (node && node.effects && node.effects.playerCooldownMultiplier) {
        cooldown *= (1 + node.effects.playerCooldownMultiplier * playerCooldownLevel); // Note: This should likely *decrease* the cooldown, so the multiplier should be negative.
      }
    }
    return cooldown;
  }

  // Apply research effects to range
  public getRange(): number {
    // Use weapon range if available
    if (this.equippedWeapon?.range) {
      return this.equippedWeapon.range;
    }

    let baseRange = (gameConfig.getConfig('player')?.shootRange) || -1;
    let equipmentBonus = 0;

    this.equippedItems.forEach(item => {
      if (item.stats.rangeBonus) {
        equipmentBonus += item.stats.rangeBonus;
      }
    });

    // Apply research effects
    const playerRangeLevel = this.researchTree.getResearchLevel('player_range'); // Assuming a player_range node
    if (playerRangeLevel > 0) {
      const node = this.researchTree.getResearchNode('player_range');
      if (node && node.effects && node.effects.playerRangeMultiplier) {
        baseRange *= (1 + node.effects.playerRangeMultiplier * playerRangeLevel);
      }
    }

    return baseRange + equipmentBonus;
  }

  // Apply research effects to max health
  public getMaxHealth(): number {
    let baseMaxHealth = this.initialHealth * (1 + 0.15 * this.maxHealthLevel);
    let equipmentBonus = 0;

    this.equippedItems.forEach(item => {
      if (item.stats.healthBonus) {
        equipmentBonus += item.stats.healthBonus;
      }
    });

    // Apply research effects
    const playerHealthLevel = this.researchTree.getResearchLevel('player_health');
    if (playerHealthLevel > 0) {
      const node = this.researchTree.getResearchNode('player_health');
      if (node && node.effects && node.effects.playerHealthMultiplier) {
        baseMaxHealth *= (1 + node.effects.playerHealthMultiplier * playerHealthLevel);
      }
    }

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

  public equipItem(item: GameItem): void {
    const equipmentItem = item as EquipmentItem;
    const slot = equipmentItem.slot;
    if (this.equippedItems.has(slot)) {
      // Already have an item equipped in this slot, unequip it first
      this.unequipItem(slot);
    }

    if (this.inventory.removeItemFromSlot(this.inventory.findItem(item.name))) {
      this.equippedItems.set(slot, equipmentItem);
      // Apply item stats
      this.applyItemStats(equipmentItem.stats);
    }
  }

  public unequipItem(slot: string): void {
    const item = this.equippedItems.get(slot);
    if (item) {
      this.equippedItems.delete(slot);
      // Remove item stats
      this.removeItemStats(item.stats);

      // Add back to inventory, if there's space
      if (!this.inventory.addItem(item)) {
        // Inventory is full, drop the item
        // this.dropItem(item); // Example drop function
        console.warn("Inventory full, item dropped!");
      }
    }
  }

  public getEquippedItems(): Map<string, GameItem> {
    return this.equippedItems as Map<string, GameItem>;
  }

  // You'll need to implement these based on your game's mechanics
  private applyItemStats(stats: any) {
    // Example:
    if (stats.healthBonus) {
      // this.maxHealth += stats.healthBonus; // Assuming you have maxHealth
      // this.health += stats.healthBonus;    // and health properties
    }
    // ... apply other stats ...
  }

  private removeItemStats(stats: any) {
    // Example:
    if (stats.healthBonus) {
      // this.maxHealth -= stats.healthBonus;
      // this.health = Math.min(this.health, this.maxHealth); // Prevent health exceeding max
    }
    // ... remove other stats ...
  }

  public getInventory(): InventoryManager { // Add a getter for the inventory
    return this.inventory;
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
   * Handle picking up items
   */
  private handleItemPickup(): void {
    try { // Add try-catch for error handling
        const gameScene = this.scene as GameScene;
        const itemDropManager = gameScene.getItemDropManager();

        if (!itemDropManager) return;

        const nearbyItem = itemDropManager.getItemInPickupRange(this.x, this.y);
        console.log('Attempting pickup of:', nearbyItem); // Log attempted pickup

        if (nearbyItem) {
            const added = this.addItemToInventory(nearbyItem.item, nearbyItem.quantity);
            if (added) {
                itemDropManager.removeItem(nearbyItem);
                gameScene.showPickupMessage(`Picked up ${nearbyItem.quantity}x ${nearbyItem.item.name}`);
            } else { // Add else for inventory full
                gameScene.showPickupMessage("Inventory full!");
            }
        }

        // Update pickup text visibility
        if (this.pickupText) {
            this.pickupText.setVisible(!!nearbyItem);
        }
    } catch (error) {
        console.error("Error in handleItemPickup:", error); // Log any errors
    }
  }

  /**
   * Handle using items (consumables)
   */
  private handleItemUse(): void {
    // Only process on button press, not continuously
    if (!Phaser.Input.Keyboard.JustDown(this.inputManager.keyMappings.useItem)) return;

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

  private handleActiveBuffs() {
    // Implementation of handleActiveBuffs method - Check for expired buffs
    const now = this.scene.time.now;
    this.activeBuffs.forEach((buff, buffType) => {
      if (buff.endTime <= now) {
        this.activeBuffs.delete(buffType);
        console.log(`Buff ${buffType} expired`);

        // If this was a health buff, update max/current health
        if (buffType === 'health' || buffType === 'maxHealth') {
          this.getMaxHealth();
        }
      }
    });
  }

  private updatePickupTextPosition() {
    // Update pickup text position to follow player
    if (this.pickupText && this.pickupText.visible) {
      this.pickupText.setPosition(this.x, this.y - 50);
    }
  }

  public addItemToInventory(item: GameItem, quantity: number): boolean {
    return this.inventory.addItem(item, quantity);
  }
}