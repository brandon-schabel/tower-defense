/**
 * Player class
 * Represents the player character that can move around the game map
 * Provides keyboard-controlled movement and interactions with game elements
 * 
 * Most Recent Changes:
 * - Updated to use type-safe TextureLoader for texture loading
 * - Removed manual texture scaling in favor of TextureLoader
 * - Added type safety for texture key
 * - Fixed collision with world bounds using setCollideWorldBounds method
 */

import Phaser from 'phaser';
import { Entity } from './entity';
import { TextureLoader } from '../loaders/texture-loader';
import { ImageKey } from '../loaders/asset-loader/image-map';

export class Player extends Entity {
  private speed: number = 200; // Pixels per second
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | undefined;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: ImageKey) {
    super(scene, x, y, texture);
    
    // Use TextureLoader to automatically handle scaling
    const desiredSize = 32; // Match grid cell size
    TextureLoader.applyTexture(this, scene, {
      key: texture,
      desiredSize
    });
    
    // Set up physics body
    scene.physics.add.existing(this);
    
    // Set body size and prevent the player from leaving the screen
    this.setCollideWorldBounds(true);
    if (this.body) {
      this.body.setSize(desiredSize, desiredSize);
    }
    
    // Get cursor keys
    this.cursors = scene.input.keyboard?.createCursorKeys();
    
    // Initialize state machine
    this.stateMachine.addState('idle', {
      enter: this.onIdleEnter.bind(this),
      execute: this.onIdleUpdate.bind(this),
      exit: () => {}
    });
    
    this.stateMachine.addState('moving', {
      enter: this.onMovingEnter.bind(this),
      execute: this.onMovingUpdate.bind(this),
      exit: this.onMovingExit.bind(this)
    });
    
    // Start in idle state
    this.stateMachine.transition('idle');
  }
  
  private onIdleEnter(): void {
    // Reset velocity when entering idle state
    this.setVelocity(0, 0);
  }
  
  private onIdleUpdate(): void {
    // Check for movement input to transition to moving state
    if (!this.cursors) return;
    
    if (
      this.cursors.left.isDown ||
      this.cursors.right.isDown ||
      this.cursors.up.isDown ||
      this.cursors.down.isDown
    ) {
      this.stateMachine.transition('moving');
    }
  }
  
  private onMovingEnter(): void {
    // Optional: play movement animation
    // this.play('player-walk');
  }
  
  private onMovingUpdate(): void {
    if (!this.cursors) return;
    
    // Reset velocity
    this.setVelocity(0, 0);
    
    // Horizontal movement
    if (this.cursors.left.isDown) {
      this.setVelocityX(-this.speed);
    } else if (this.cursors.right.isDown) {
      this.setVelocityX(this.speed);
    }
    
    // Vertical movement
    if (this.cursors.up.isDown) {
      this.setVelocityY(-this.speed);
    } else if (this.cursors.down.isDown) {
      this.setVelocityY(this.speed);
    }
    
    // If no keys are pressed, go back to idle
    if (
      !this.cursors.left.isDown &&
      !this.cursors.right.isDown &&
      !this.cursors.up.isDown &&
      !this.cursors.down.isDown
    ) {
      this.stateMachine.transition('idle');
    }
  }
  
  private onMovingExit(): void {
    // Optional: stop movement animation
    // this.stop();
  }
  
  override update(time: number, delta: number): void {
    // Update state machine
    this.stateMachine.update(delta);
  }
}
