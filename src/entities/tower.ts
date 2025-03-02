/**
 * Tower class for the defense units in the game
 * Extends the base Entity class with tower-specific properties and behaviors
 * 
 * Most Recent Changes:
 * - Updated to match texture key changes in game-config.ts (normal-tower, area-tower, laser-tower)
 * - Updated imports to use consolidated game-config.ts
 * - Fixed type issues with TowerType references
 * - Added initialization for attackInterval property
 * - Fixed isDead property access
 * - Fixed stateMachine.update() call to pass the delta parameter
 * - Fixed upgradeConfig access to use string keys
 * - Removed unused variables warnings
 * - Updated to use type-safe TextureLoader for texture loading
 * - Updated texture parameter to use ImageKey type for type safety
 * - Improved fallback texture handling
 * - Added automatic scaling based on desired tower size
 */
import Phaser from 'phaser';
import { Entity } from './entity';
import { Enemy } from './enemy';
import { TOWER_TYPES } from '../config/game-config';
import { TextureLoader } from '../loaders/texture-loader';
import { ImageKey } from '../loaders/asset-loader/image-map';

export interface TowerConfig {
  scene: Phaser.Scene;
  x: number;
  y: number;
  texture: ImageKey;
  frame?: string | number;
  type: keyof typeof TOWER_TYPES;
  range: number;
  damage: number;
  attackSpeed: number; // Attacks per second
  cost: number;
  upgradeLevel?: number;
}

export class Tower extends Entity {
  private rangeGraphics: Phaser.GameObjects.Graphics;
  private target: Enemy | null = null;
  private _attackTimer: number = 0;
  private _attackInterval: number = 1000; // ms between attacks, default to 1000ms
  
  public type: keyof typeof TOWER_TYPES;
  public range: number;
  public damage: number;
  public attackSpeed: number; // Added explicit property
  public cost: number;
  public upgradeLevel: number;
  public isShowingRange: boolean = false;
  
  private attackCooldown: number = 0;
  private _projectiles: Phaser.GameObjects.Group;
  
  constructor(config: TowerConfig) {
    super(config.scene, config.x, config.y, config.texture, config.frame);
    
    // Get tower stats from config based on type
    const towerConfig = TOWER_TYPES[config.type];
    this.type = config.type;
    this.range = towerConfig.range;
    this.damage = towerConfig.damage;
    this.attackSpeed = towerConfig.attackSpeed;
    this.cost = towerConfig.cost;
    this.upgradeLevel = config.upgradeLevel || 1;
    this._attackInterval = 1000 / this.attackSpeed; // Calculate attack interval from attack speed
    
    // Apply texture with proper scaling
    const desiredSize = 32; // Standard tower size
    TextureLoader.applyTexture(this, this.scene, {
      key: config.texture,
      frame: config.frame,
      desiredSize
    });
    
    // Create a graphics object for showing the range
    this.rangeGraphics = this.scene.add.graphics();
    this.rangeGraphics.setDepth(1);
    
    // Create projectiles group
    this._projectiles = this.scene.add.group();
    
    // Setup visuals and UI elements
    this.createRangeIndicator();
    this.hideRangeIndicator(); // Initially hidden
    
    // Setup state machine with tower-specific states
    this.stateMachine.addState('idle', {
      enter: this.onIdleEnter.bind(this),
      execute: this.onIdleUpdate.bind(this),
      exit: () => {}
    });
    
    this.stateMachine.addState('targeting', {
      enter: this.onTargetingEnter.bind(this),
      execute: this.onTargetingUpdate.bind(this),
      exit: () => {}
    });
    
    this.stateMachine.addState('attacking', {
      enter: this.onAttackingEnter.bind(this),
      execute: this.onAttackingUpdate.bind(this),
      exit: this.onAttackingExit.bind(this)
    });
    
    // Start in the idle state
    this.stateMachine.transition('idle');
  }
  
  private createRangeIndicator(): void {
    this.rangeGraphics = this.scene.add.graphics();
    this.rangeGraphics.lineStyle(2, 0x00ff00, 0.5);
    this.rangeGraphics.strokeCircle(0, 0, this.range);
    this.rangeGraphics.setPosition(this.x, this.y);
    this.rangeGraphics.setDepth(1);
  }
  
  public showRangeIndicator(): void {
    if (this.rangeGraphics) {
      this.rangeGraphics.setVisible(true);
    }
  }
  
  public hideRangeIndicator(): void {
    if (this.rangeGraphics) {
      this.rangeGraphics.setVisible(false);
    }
  }
  
  private onIdleEnter(): void {
    // Any setup needed when entering idle state
  }
  
  private onIdleUpdate(): void {
    // Look for enemies in range
    this.findTarget();
    
    // If we have a target, transition to attack state
    if (this.target) {
      this.stateMachine.transition('targeting');
    }
  }
  
  private onTargetingEnter(): void {
    // Face the target when entering targeting state
    this.faceTarget();
  }
  
  private onTargetingUpdate(): void {
    // If no target or target is dead, go back to idle
    if (!this.target || !this.target.active || !this.isInRange(this.target)) {
      this.target = null;
      this.stateMachine.transition('idle');
      return;
    }
    
    // Update timer
    this._attackTimer += this.scene.game.loop.delta;
    
    // Face target continuously while targeting
    this.faceTarget();
    
    // If target is valid and cooldown is ready, transition to attacking
    if (this.attackCooldown <= 0) {
      this.stateMachine.transition('attacking');
    } else {
      this.attackCooldown -= this.scene.game.loop.delta;
    }
  }
  
  private onAttackingEnter(): void {
    // Perform attack when entering attack state
    this.attack();
  }
  
  private onAttackingUpdate(): void {
    // After attack, go back to targeting
    this.stateMachine.transition('targeting');
  }
  
  private onAttackingExit(): void {
    // Reset cooldown and timer
    this.attackCooldown = this._attackInterval;
    this._attackTimer = 0;
  }
  
  private findTarget(): void {
    // Get all enemies from the scene
    const enemies = this.scene.children.list.filter(
      child => child instanceof Enemy && child.active
    ) as Enemy[];
    
    // Find the closest enemy in range
    let closestDistance = Infinity;
    let closestEnemy: Enemy | null = null;
    
    for (const enemy of enemies) {
      const distance = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
      if (distance <= this.range && distance < closestDistance) {
        closestDistance = distance;
        closestEnemy = enemy;
      }
    }
    
    this.target = closestEnemy;
  }
  
  private isInRange(enemy: Enemy): boolean {
    const distance = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
    return distance <= this.range;
  }
  
  private faceTarget(): void {
    if (!this.target) return;
    
    const angle = Phaser.Math.Angle.Between(
      this.x, this.y,
      this.target.x, this.target.y
    );
    this.rotation = angle;
  }
  
  private attack(): void {
    if (!this.target) return;
    
    // Create projectile or visual effect
    this.shootProjectile();
    
    // Deal damage to the target
    this.target.takeDamage(this.damage);
    
    // Emit event for UI or sound effects
    this.scene.events.emit('towerAttack', this, this.target);
  }
  
  private shootProjectile(): void {
    if (!this.target) return;
    
    // Try to use a proper projectile texture if it exists
    const projectileKey: ImageKey = 'projectile';
    
    let projectile: Phaser.GameObjects.Sprite | Phaser.GameObjects.Arc;
    
    // Check if projectile texture exists
    if (this.scene.textures.exists(projectileKey)) {
      // Use sprite with proper texture
      projectile = this.scene.add.sprite(this.x, this.y, projectileKey);
      
      // Apply scaling to the projectile
      TextureLoader.applyTexture(projectile, this.scene, {
        key: projectileKey,
        desiredSize: 16 // Smaller size for projectiles
      });
      
      // Rotate the projectile towards the target
      const angle = Phaser.Math.Angle.Between(
        this.x, this.y,
        this.target.x, this.target.y
      );
      projectile.rotation = angle;
    } else {
      // Create a simple colored circle as fallback
      projectile = this.scene.add.circle(
        this.x, this.y, 5, 
        this.type === 'BASIC' ? 0xFFFF00 : 
        this.type === 'SNIPER' ? 0xFF0000 : 
        0x00FFFF
      );
    }
    
    // Animate the projectile
    this.scene.tweens.add({
      targets: projectile,
      x: this.target.x,
      y: this.target.y,
      duration: 200,
      onComplete: () => {
        projectile.destroy();
      }
    });
  }
  
  public upgrade(): boolean {
    // Logic for upgrading the tower
    const nextLevel = this.upgradeLevel + 1;
    
    // Check if the tower type has upgrades for this level
    const towerUpgrades = TOWER_TYPES[this.type].upgrades;
    if (!towerUpgrades) {
      return false; // No upgrades available for this tower type
    }
    
    // Handle upgrade levels with type safety
    let upgradeConfig;
    if (nextLevel === 2) {
      upgradeConfig = towerUpgrades[2];
    } else if (nextLevel === 3) {
      upgradeConfig = towerUpgrades[3];
    } else {
      return false; // No more upgrades available beyond level 3
    }
    
    if (!upgradeConfig) {
      return false; // Specific level upgrade not available
    }
    
    // Apply the upgrade stats with type checking
    this.upgradeLevel = nextLevel;
    this.range = upgradeConfig.range || this.range;
    this.damage = upgradeConfig.damage || this.damage;
    
    // Check if attackSpeed exists on the upgrade config (some tower types might not have it)
    if ('attackSpeed' in upgradeConfig) {
      this.attackSpeed = upgradeConfig.attackSpeed || this.attackSpeed;
      // Update attack interval based on new attack speed
      this._attackInterval = 1000 / this.attackSpeed;
    }
    
    // Apply visual upgrades if a texture is specified
    if ('texture' in upgradeConfig && upgradeConfig.texture) {
      const upgradeTexture = upgradeConfig.texture as ImageKey;
      if (this.scene.textures.exists(upgradeTexture)) {
        // Apply the upgraded texture with proper scaling
        TextureLoader.applyTexture(this, this.scene, {
          key: upgradeTexture,
          desiredSize: 32 // Standard tower size
        });
      } else {
        // If no specific upgraded texture, add visual indication of upgrade
        this.clearTint();
        this.setTint(0xFFFF00); // Yellow tint to indicate upgrade
      }
      
      // Add a visual effect to show the tower is upgraded
      this.scene.tweens.add({
        targets: this,
        scaleX: this.scaleX * 1.2,
        scaleY: this.scaleY * 1.2,
        duration: 200,
        yoyo: true,
        repeat: 1
      });
    }
    
    // Update the range indicator
    this.updateRangeIndicator();
    
    return true;
  }
  
  private updateRangeIndicator(): void {
    if (this.rangeGraphics) {
      this.rangeGraphics.clear();
      this.rangeGraphics.lineStyle(2, 0x00ff00, 0.5);
      this.rangeGraphics.strokeCircle(0, 0, this.range);
    }
  }
  
  public showRange(show: boolean = true): void {
    this.isShowingRange = show;
    this.rangeGraphics.clear();
    
    if (show) {
      // Draw the range circle
      this.rangeGraphics.lineStyle(2, 0x00ff00, 0.5);
      this.rangeGraphics.fillStyle(0x00ff00, 0.1);
      this.rangeGraphics.strokeCircle(this.x, this.y, this.range);
      this.rangeGraphics.fillCircle(this.x, this.y, this.range);
    }
  }
  
  public update(_time: number, delta: number): void {
    // Update the state machine
    this.stateMachine.update(delta);
    
    // Update range indicator position if visible
    if (this.rangeGraphics && this.rangeGraphics.visible) {
      this.rangeGraphics.setPosition(this.x, this.y);
    }
  }
  
  public destroy(): void {
    if (this.rangeGraphics) {
      this.rangeGraphics.destroy();
    }
    super.destroy();
  }
} 