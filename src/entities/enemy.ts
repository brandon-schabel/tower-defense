/**
 * Enemy class representing enemies that attack the player's base
 * 
 * Most Recent Changes:
 * - Fixed onPathComplete method to check if scene exists and enemy is not destroyed before emitting events
 * - Added isDestroyed flag to prevent multiple callbacks from triggering after enemy is destroyed
 * - Improved path completion handling to prevent "Cannot read properties of undefined" errors
 * - Completely revamped health bar positioning to fix alignment issues
 * - Changed health bar to be a Container with Rectangle objects for better positioning
 * - Made health bar follow the visible representation directly instead of using calculated offsets
 * - Fixed origin point calculations for proper alignment
 * - Added more robust positioning logic for different enemy types
 * - Fixed health bar display issues by setting proper depth values
 * - Improved health bar positioning calculation and visibility
 * - Added fallback for height calculation when pathFollower height is undefined
 * - Increased health bar size for better visibility
 * - Ensured proper layering so health bars appear above enemies
 * - Updated to use type-safe TextureLoader for texture loading 
 * - Added type safety for texture key
 * - Made the main sprite invisible, using only the pathFollower as the visible representation
 * - Added detection for path completion to trigger enemyReachedEnd event
 * - Sync the position of the main sprite with the pathFollower for physics
 * - Added scaling to match the game's grid size
 * - Fixed pathFollower.pause() calls to use pathFollower.stop() instead
 * - Fixed stateMachine.update call to pass the correct parameter
 * - Removed unused 'healthBar' warning
 */
import Phaser from 'phaser';
import { Entity } from './entity';
import { ENEMY_TYPES } from '../config/game-config';
import { TextureLoader } from '../loaders/texture-loader';
import { ImageKey } from '../loaders/asset-loader/image-map';

export interface EnemyConfig {
  scene: Phaser.Scene;
  x: number;
  y: number;
  texture: ImageKey;
  frame?: string | number;
  type: keyof typeof ENEMY_TYPES;
  path?: Phaser.Curves.Path;
  waypoints?: { x: number, y: number }[];
}

export class Enemy extends Entity {
  public health: number;
  public maxHealth: number;
  public speed: number;
  public damage: number;
  public reward: number;
  public type: keyof typeof ENEMY_TYPES;
  
  private healthBarContainer: Phaser.GameObjects.Container;
  private healthBarBackground: Phaser.GameObjects.Rectangle;
  private healthBarFill: Phaser.GameObjects.Rectangle;
  private healthBarOutline: Phaser.GameObjects.Rectangle;
  private pathFollower?: Phaser.GameObjects.PathFollower;
  private waypoints?: { x: number, y: number }[];
  private currentWaypoint: number = 0;
  private pathComplete: boolean = false;
  private isDestroyed: boolean = false; // Flag to track if the enemy is destroyed
  
  constructor(config: EnemyConfig) {
    super(config.scene, config.x, config.y, config.texture, config.frame);

    // Get enemy stats from config based on type
    const enemyConfig = ENEMY_TYPES[config.type];
    this.type = config.type;
    this.health = enemyConfig.health;
    this.maxHealth = enemyConfig.health;
    this.speed = enemyConfig.speed;
    this.damage = enemyConfig.damage;
    this.reward = enemyConfig.reward;
    
    // Standard entity size for enemies
    const desiredSize = 32; // Match grid cell size
    
    // Set depth for enemy entity
    this.setDepth(5);
    
    // Setup path following if path is provided
    if (config.path) {
      this.pathFollower = this.scene.add.follower(config.path, this.x, this.y, config.texture);
      this.pathFollower.startFollow({
        duration: config.path.getLength() / this.speed * 1000,
        rotateToPath: true,
        onComplete: () => {
          // Only call onPathComplete if the enemy and scene still exist
          if (!this.isDestroyed) {
            this.onPathComplete();
          }
        }
      });
      
      // Apply texture with proper scaling to pathFollower
      TextureLoader.applyTexture(this.pathFollower, this.scene, {
        key: config.texture,
        frame: config.frame,
        desiredSize
      });
      
      // Set depth for pathFollower to match enemy
      this.pathFollower.setDepth(5);
      
      // Make the main sprite invisible - we'll only use the pathFollower as the visual
      this.setVisible(false);
    } else if (config.waypoints) {
      // Apply texture with proper scaling to this entity
      TextureLoader.applyTexture(this, this.scene, {
        key: config.texture,
        frame: config.frame,
        desiredSize
      });
      
      this.waypoints = config.waypoints;
      this.moveToNextWaypoint();
    }
    
    // Create health bar container and components
    // Using Container + Rectangle approach for better positioning control
    const barWidth = 30;
    const barHeight = 6;
    
    // Create container
    this.healthBarContainer = this.scene.add.container(0, 0);
    this.healthBarContainer.setDepth(10);
    
    // Create the background (red)
    this.healthBarBackground = this.scene.add.rectangle(0, 0, barWidth, barHeight, 0xff0000);
    this.healthBarBackground.setOrigin(0.5, 0.5);
    
    // Create the health fill (green)
    this.healthBarFill = this.scene.add.rectangle(
      -barWidth/2, 0, barWidth, barHeight, 0x00ff00
    );
    this.healthBarFill.setOrigin(0, 0.5);
    
    // Create the outline
    this.healthBarOutline = this.scene.add.rectangle(0, 0, barWidth, barHeight, 0x000000, 0);
    this.healthBarOutline.setOrigin(0.5, 0.5);
    this.healthBarOutline.setStrokeStyle(1, 0x000000, 0.8);
    
    // Add all components to the container
    this.healthBarContainer.add([
      this.healthBarBackground,
      this.healthBarFill,
      this.healthBarOutline
    ]);
    
    // Initial health bar position
    this.updateHealthBar();
    
    // Setup state machine with enemy-specific states
    this.stateMachine.addState('moving', {
      enter: this.onMovingEnter.bind(this),
      execute: this.onMovingUpdate.bind(this),
      exit: () => {}
    });
    
    this.stateMachine.addState('attacking', {
      enter: this.onAttackingEnter.bind(this),
      execute: this.onAttackingUpdate.bind(this),
      exit: () => {}
    });
    
    this.stateMachine.addState('dying', {
      enter: this.onDyingEnter.bind(this),
      execute: this.onDyingUpdate.bind(this),
      exit: () => {}
    });
    
    // Start in the moving state
    this.stateMachine.transition('moving');
  }
  
  /**
   * Update the health bar position and fill
   */
  private updateHealthBar(): void {
    // Get the visible representation (pathFollower or main sprite)
    const visibleObject = this.pathFollower || this;
    
    // Position the health bar above the enemy
    // We need to position it relative to the top of the sprite
    // Get the actual display height (accounting for scale)
    const displayHeight = visibleObject.displayHeight || 32;
    
    // Position health bar container directly above the enemy
    this.healthBarContainer.setPosition(
      visibleObject.x,
      visibleObject.y - (displayHeight / 2) - 10
    );
    
    // Update the fill width based on health percentage
    const healthPercentage = Math.max(0, this.health / this.maxHealth);
    this.healthBarFill.width = 30 * healthPercentage;
    
    // Reset the horizontal position of the fill since its origin is left aligned
    this.healthBarFill.x = -15;
  }
  
  /**
   * Called when the path follower completes its path
   */
  private onPathComplete(): void {
    console.log('[Enemy] Path complete');
    this.pathComplete = true;
    
    // Check if scene exists before trying to emit events
    if (this.scene && !this.isDestroyed) {
      this.scene.events.emit('enemyReachedEnd', this);
      this.destroy();
    }
  }
  
  private moveToNextWaypoint(): void {
    if (this.waypoints && this.waypoints.length > 0) {
      const nextWaypoint = this.waypoints[this.currentWaypoint];
      this.x = nextWaypoint.x;
      this.y = nextWaypoint.y;
      this.currentWaypoint = (this.currentWaypoint + 1) % this.waypoints.length;
    }
  }
  
  private onMovingEnter(): void {
    // Any setup needed when entering move state
  }
  
  private onMovingUpdate(): void {
    // Additional logic during movement (beyond path following)
  }
  
  private onAttackingEnter(): void {
    // Setup for attack state - could pause movement
    if (this.pathFollower) {
      // Use stop instead of pause (which doesn't exist)
      this.pathFollower.stop();
    }
  }
  
  private onAttackingUpdate(): void {
    // Handle attack logic
  }
  
  private onDyingEnter(): void {
    // Handle death - could play animation
    if (this.pathFollower) {
      // Use stop instead of pause (which doesn't exist)
      this.pathFollower.stop();
    }
    
    // Emit event for gold reward
    if (this.scene) {
      this.scene.events.emit('enemyDied', this);
    }
    
    // Play death animation and then destroy
    if (this.scene) {
      this.scene.tweens.add({
        targets: this.pathFollower || this,
        alpha: 0,
        scale: 1.5,
        duration: 300,
        onComplete: () => {
          if (!this.isDestroyed) {
            this.destroy();
          }
        }
      });
    }
  }
  
  private onDyingUpdate(): void {
    // Additional logic during death
  }
  
  public takeDamage(amount: number): boolean {
    // Call base class method
    const isDead = super.takeDamage(amount);
    
    // Update health bar
    this.updateHealthBar();
    
    if (this.isDead) {
      this.stateMachine.transition('dying');
    }
    
    return isDead;
  }
  
  public update(time: number, delta: number): void {
    if (this.isDead || this.isDestroyed) return;
    
    // Update the state machine - pass delta as the only parameter
    this.stateMachine.update(delta);
    
    // Sync position with pathFollower if it exists
    if (this.pathFollower) {
      this.setPosition(this.pathFollower.x, this.pathFollower.y);
    }
    
    // Update health bar position
    this.updateHealthBar();
  }
  
  public destroy(): void {
    // Mark as destroyed to prevent further callbacks
    this.isDestroyed = true;
    
    if (this.pathFollower) {
      // Use stop instead of pause (which doesn't exist)
      this.pathFollower.stop();
      this.pathFollower.destroy();
    }
    if (this.healthBarContainer) {
      this.healthBarContainer.destroy();
    }
    super.destroy();
  }
} 