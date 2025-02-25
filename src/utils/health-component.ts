import Phaser from "phaser";
import { HealthBar } from "./health-bar";

/**
 * A reusable component for managing entity health
 * This can be composed into any entity that needs health management
 */
export class HealthComponent {
  private entity: Phaser.GameObjects.Sprite;
  private scene: Phaser.Scene;
  private health: number;
  private maxHealth: number;
  private healthBar: HealthBar;
  private onDeathCallback: () => void;
  private active: boolean = true;

  /**
   * Creates a health component to manage an entity's health
   * 
   * @param entity The entity this component belongs to
   * @param scene The current game scene
   * @param initialHealth Starting health value
   * @param maxHealth Maximum health (defaults to initialHealth if not specified)
   * @param onDeath Callback to execute when health reaches zero
   */
  constructor(
    entity: Phaser.GameObjects.Sprite,
    scene: Phaser.Scene,
    initialHealth: number,
    maxHealth?: number,
    onDeath?: () => void
  ) {
    this.entity = entity;
    this.scene = scene;
    this.health = initialHealth;
    this.maxHealth = maxHealth || initialHealth;
    this.onDeathCallback = onDeath || (() => {});
    
    // Create the health bar visualization
    this.healthBar = new HealthBar(scene, entity, this.maxHealth);
  }

  /**
   * Apply damage to the entity
   * @param amount Amount of damage to apply
   * @returns true if entity is still alive, false if killed
   */
  takeDamage(amount: number): boolean {
    if (!this.active) return false;
    
    this.health = Math.max(0, this.health - amount);
    this.healthBar.updateHealth(this.health);
    
    if (this.health <= 0) {
      this.cleanup();
      this.onDeathCallback();
      return false;
    }
    
    return true;
  }

  /**
   * Heal the entity
   * @param amount Amount to heal
   */
  heal(amount: number): void {
    if (!this.active) return;
    
    this.health = Math.min(this.maxHealth, this.health + amount);
    this.healthBar.updateHealth(this.health);
  }

  /**
   * Set maximum health, optionally scaling current health
   * @param newMax New maximum health
   * @param scaleCurrentHealth Whether to scale current health proportionally
   */
  setMaxHealth(newMax: number, scaleCurrentHealth: boolean = false): void {
    if (scaleCurrentHealth && this.maxHealth > 0) {
      // Scale current health proportionally to new max
      const ratio = this.health / this.maxHealth;
      this.health = Math.round(newMax * ratio);
    }
    
    this.maxHealth = newMax;
    this.healthBar.updateHealth(this.health);
  }

  /**
   * Get current health
   */
  getHealth(): number {
    return this.health;
  }

  /**
   * Get maximum health
   */
  getMaxHealth(): number {
    return this.maxHealth;
  }

  /**
   * Get health as percentage (0-1)
   */
  getHealthPercentage(): number {
    return this.health / this.maxHealth;
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.active = false;
    if (this.healthBar) {
      this.healthBar.cleanup();
    }
  }

  /**
   * Update the health bar position (should be called in the entity's update method)
   */
  update(): void {
    if (this.active) {
      this.healthBar.updateHealth(this.health);
    }
  }
} 