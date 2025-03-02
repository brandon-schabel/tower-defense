/**
 * PlayerBase class representing the structure players need to defend
 * Extends the base Entity class with base-specific properties and behaviors
 * 
 * Most Recent Changes:
 * - Updated to use type-safe TextureLoader for texture loading
 * - Added type safety for texture key
 * - Removed manual scaling calculation, delegated to TextureLoader
 * - Improved visual feedback for damage and healing
 */
import Phaser from 'phaser';
import { Entity } from './entity';
import { PLAYER_CONFIG } from '../config/game-config';
import { TextureLoader } from '../loaders/texture-loader';
import { ImageKey } from '../loaders/asset-loader/image-map';

export interface PlayerBaseConfig {
  scene: Phaser.Scene;
  x: number;
  y: number;
  texture: ImageKey;
  frame?: string | number;
  maxLives?: number;
}

export class PlayerBase extends Entity {
  private livesText: Phaser.GameObjects.Text;
  private healthBar: Phaser.GameObjects.Graphics;

  public lives: number;
  public maxLives: number;

  constructor(config: PlayerBaseConfig) {
    super(config.scene, config.x, config.y, config.texture, config.frame);

    // Use TextureLoader for consistent scaling
    const desiredSize = 48; // Slightly larger than standard grid cell
    TextureLoader.applyTexture(this, this.scene, {
      key: config.texture,
      frame: config.frame,
      desiredSize
    });

    this.maxLives = config.maxLives || PLAYER_CONFIG.startingLives;
    this.lives = this.maxLives;

    // Set up the state machine with base-specific states
    this.stateMachine.addState('idle', {
      enter: this.onIdleEnter.bind(this),
      execute: this.onIdleUpdate.bind(this),
      exit: () => { }
    });

    this.stateMachine.addState('damaged', {
      enter: this.onDamagedEnter.bind(this),
      execute: this.onDamagedUpdate.bind(this),
      exit: () => { }
    });

    this.stateMachine.addState('destroyed', {
      enter: this.onDestroyedEnter.bind(this),
      execute: () => { },
      exit: () => { }
    });

    // Display lives
    this.livesText = this.scene.add.text(this.x, this.y - this.displayHeight / 2 - 15, `Lives: ${this.lives}`, {
      fontSize: '16px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3
    });
    this.livesText.setOrigin(0.5);
    this.livesText.setDepth(1);

    // Create health bar
    this.healthBar = this.scene.add.graphics();
    this.updateHealthBar();

    // Start in the idle state
    this.stateMachine.transition('idle');
  }

  private onIdleEnter(): void {
    // Reset any animations or effects
    this.setTint(0xffffff);
  }

  private onIdleUpdate(): void {
    // Any idle logic here
  }

  private onDamagedEnter(): void {
    // Flash red when damaged
    this.scene.tweens.add({
      targets: this,
      alpha: 0.6,
      duration: 100,
      yoyo: true,
      repeat: 2,
      onComplete: () => {
        this.alpha = 1;
        this.stateMachine.transition('idle');
      }
    });

    // Play damage sound or effect
    // this.scene.sound.play('base-damaged');
  }

  private onDamagedUpdate(): void {
    // Any per-frame logic during damaged state
  }

  private onDestroyedEnter(): void {
    // Game over animation or effect
    this.setTint(0x555555);

    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      y: this.y + 20,
      angle: 15,
      duration: 1000,
      ease: 'Power2',
      onComplete: () => {
        // Emit game over event
        this.scene.events.emit('gameOver', false);
      }
    });
  }

  public takeDamage(amount: number): boolean {
    // Base takes direct life damage, not health damage
    this.lives -= amount;

    // Update life display
    this.updateLivesText();
    this.updateHealthBar();

    // Transition to damaged state
    this.stateMachine.transition('damaged');

    // Emit life loss event
    this.scene.events.emit('lifeLost', amount, this.lives);

    // Check if all lives lost
    if (this.lives <= 0) {
      this.lives = 0;
      this.stateMachine.transition('destroyed');
      return true; // Indicates the base is destroyed
    }

    return false; // Base is still active
  }

  public gainLife(amount: number = 1): void {
    this.lives = Math.min(this.lives + amount, this.maxLives);
    this.updateLivesText();
    this.updateHealthBar();

    // Play effect
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 200,
      yoyo: true
    });

    // Emit life gain event
    this.scene.events.emit('lifeGained', amount, this.lives);
  }

  private updateLivesText(): void {
    this.livesText.setText(`Lives: ${this.lives}`);
  }

  private updateHealthBar(): void {
    this.healthBar.clear();

    // Health bar background
    this.healthBar.fillStyle(0xff0000, 1);
    this.healthBar.fillRect(this.x - 40, this.y + this.displayHeight / 2 + 5, 80, 8);

    // Health bar fill
    this.healthBar.fillStyle(0x00ff00, 1);
    const lifePercentage = this.lives / this.maxLives;
    this.healthBar.fillRect(this.x - 40, this.y + this.displayHeight / 2 + 5, 80 * lifePercentage, 8);
  }

  public update(_time: number, delta: number): void {
    // Update the state machine
    this.stateMachine.update(delta);

    // Update text position to follow the base
    this.livesText.setPosition(this.x, this.y - this.displayHeight / 2 - 15);

    // Update health bar position
    this.updateHealthBar();
  }

  public destroy(): void {
    if (this.livesText) {
      this.livesText.destroy();
    }
    if (this.healthBar) {
      this.healthBar.destroy();
    }
    super.destroy();
  }
} 