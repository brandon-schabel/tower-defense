/**
 * Entity Base Class
 * Serves as the foundation for all game entities (towers, enemies, etc).
 * 
 * Most Recent Changes:
 * - Updated to use type-safe ImageKey for textures
 * - Added integration with TextureLoader for consistent scaling
 * - Improved fallback texture handling
 * - Enhanced type safety in constructor parameters
 */

import Phaser from 'phaser';
import { StateMachine } from '../states/state-machine';
import { ImageKey } from '../loaders/asset-loader/image-map';
import { TextureLoader } from '../loaders/texture-loader';

export abstract class Entity extends Phaser.Physics.Arcade.Sprite {
  // Core properties
  protected id: number;
  protected stateMachine: StateMachine;
  
  // Health and status
  protected health: number;
  protected maxHealth: number;
  protected isDead: boolean = false;
  
  // Static ID counter to ensure unique IDs
  private static nextId: number = 1;
  
  constructor(
    scene: Phaser.Scene, 
    x: number, 
    y: number, 
    texture: ImageKey, 
    frame?: string | number,
    health: number = 100
  ) {
    super(scene, x, y, texture, frame);
    
    // Generate unique ID
    this.id = Entity.nextId++;
    
    // Check if the texture exists
    if (!scene.textures.exists(texture)) {
      console.warn(`[Entity] Texture '${texture}' not found for entity ID ${this.id}.`);
      
      // Create a basic fallback texture if the requested one doesn't exist
      this.createFallbackTexture(scene, texture);
    }
    
    // Add to scene
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    // Initialize state machine
    this.stateMachine = new StateMachine(this);
    
    // Set health
    this.health = health;
    this.maxHealth = health;
    
    console.log(`[Entity] Created entity ID ${this.id} at (${x}, ${y})`);
  }
  
  /**
   * Create a fallback texture if the requested one doesn't exist
   */
  private createFallbackTexture(scene: Phaser.Scene, textureKey: string): void {
    // Don't create it if it already exists
    if (scene.textures.exists(textureKey)) {
      console.log(`[Entity] Texture already exists: ${textureKey}`);
      return;
    }
    
    console.warn(`[Entity] Creating fallback texture for: ${textureKey}`);
    
    // Generate a simple colored rectangle texture based on entity type
    const graphics = scene.make.graphics({ x: 0, y: 0 });
    
    // Use different colors based on texture name to differentiate entities
    let color = 0xFFFFFF; // Default white
    let size = 32; // Default size
    
    if (textureKey.includes('enemy')) {
      color = 0xFF0000; // Red for enemies
      
      // Add some distinction between enemy types
      if (textureKey.includes('boss')) {
        size = 48; // Larger for boss
        // Add a border
        graphics.lineStyle(4, 0x000000, 1);
      } else if (textureKey.includes('fast')) {
        color = 0xFF9900; // Orange for fast enemies
      } else if (textureKey.includes('flying')) {
        color = 0xFF00FF; // Purple for flying enemies
      }
    } else if (textureKey.includes('tower')) {
      color = 0x0000FF; // Blue for towers
      
      // Add some distinction between tower types
      if (textureKey.includes('sniper')) {
        color = 0x00FFFF; // Cyan for sniper towers
      } else if (textureKey.includes('area')) {
        color = 0x0088FF; // Light blue for area towers
      }
    } else if (textureKey === 'base') {
      color = 0x00FF00; // Green for base
      size = 48; // Larger for base
    } else if (textureKey === 'player') {
      color = 0xFFFF00; // Yellow for player
    }
    
    // Draw a colored rectangle with a border
    graphics.fillStyle(color, 1);
    graphics.fillRect(0, 0, size, size);
    graphics.lineStyle(2, 0x000000, 1);
    graphics.strokeRect(0, 0, size, size);
    
    // Add a distinctive pattern to make it obvious this is a fallback
    graphics.lineStyle(1, 0x000000, 0.5);
    graphics.lineBetween(0, 0, size, size);
    graphics.lineBetween(0, size, size, 0);
    
    // Add a letter identifier
    if (textureKey.length > 0) {
      // Draw a letter in the middle to identify the entity type
      const letter = textureKey.charAt(0).toUpperCase();
      const textObject = scene.make.text({
        x: size / 2,
        y: size / 2,
        text: letter,
        style: {
          fontSize: Math.floor(size / 2) + 'px',
          fontFamily: 'Arial',
          color: '#000000'
        }
      });
      textObject.setOrigin(0.5, 0.5);
      
      // Render the text to the graphics object
      textObject.setPosition(size / 2, size / 2);
      // Note: can't directly draw text to graphics, but the text will appear in the scene
    }
    
    try {
      // Generate a texture from the graphics
      graphics.generateTexture(textureKey, size, size);
      console.log(`[Entity] Successfully created fallback texture: ${textureKey}`);
      
      // Use the new texture (important!)
      this.setTexture(textureKey);
      
      // Set a debug name to indicate this is a fallback
      this.setName(`FALLBACK_${textureKey}`);
    } catch (error) {
      console.error(`[Entity] Failed to create fallback texture for ${textureKey}:`, error);
    }
  }
  
  /**
   * Apply a texture to this entity with automatic scaling
   * @param key The image key to use
   * @param desiredSize The desired size in pixels
   */
  protected applyTexture(key: ImageKey, desiredSize: number = 32): void {
    TextureLoader.applyTexture(this, this.scene, {
      key,
      desiredSize
    });
  }
  
  /**
   * Take damage from an attack
   * @param amount Damage amount to take
   * @returns True if the entity died from this damage
   */
  public takeDamage(amount: number): boolean {
    if (this.isDead) return false;
    
    this.health -= amount;
    
    // Check if entity died
    if (this.health <= 0) {
      this.health = 0;
      this.die();
      return true;
    }
    
    // Flash effect to indicate damage
    this.scene.tweens.add({
      targets: this,
      alpha: 0.5,
      duration: 100,
      yoyo: true
    });
    
    return false;
  }
  
  /**
   * Heal the entity
   * @param amount Amount to heal
   */
  public heal(amount: number): void {
    if (this.isDead) return;
    
    this.health = Math.min(this.health + amount, this.maxHealth);
  }
  
  /**
   * Handle death of the entity
   */
  protected die(): void {
    this.isDead = true;
    
    // Transition to dead state if it exists
    if (this.stateMachine.isInState('dead')) {
      return; // Already in dead state
    }
    
    this.stateMachine.transition('dead');
    
    console.log(`[Entity] Entity ID ${this.id} died`);
  }
  
  /**
   * Get the entity's unique ID
   */
  public getId(): number {
    return this.id;
  }
  
  /**
   * Get current health
   */
  public getHealth(): number {
    return this.health;
  }
  
  /**
   * Get maximum health
   */
  public getMaxHealth(): number {
    return this.maxHealth;
  }
  
  /**
   * Get health as percentage (0-1)
   */
  public getHealthPercentage(): number {
    return this.health / this.maxHealth;
  }
  
  /**
   * Check if the entity is dead
   */
  public isDying(): boolean {
    return this.isDead;
  }
  
  /**
   * All entities must implement an update method
   */
  public abstract update(time: number, delta: number): void;
} 