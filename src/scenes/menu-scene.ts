/**
 * MenuScene
 * Displays the main menu, provides game options and starts the game.
 * 
 * Most Recent Changes:
 * - Fixed type issue with emitZone in particle configuration
 * - Removed placeholder particle effect until proper assets are available
 */

import Phaser from 'phaser';
import { Difficulty } from '../config/game-config';

export class MenuScene extends Phaser.Scene {
  private gameTitle!: Phaser.GameObjects.Text;
  private currentDifficulty: Difficulty = Difficulty.MEDIUM;
  
  constructor() {
    super({ key: 'MenuScene' });
  }
  
  create(): void {
    // Create background
    this.createBackground();
    
    // Create title
    this.gameTitle = this.add.text(
      this.cameras.main.width / 2,
      100,
      'Tower Defense Game',
      { 
        fontFamily: 'Arial', 
        fontSize: '48px', 
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4
      }
    ).setOrigin(0.5);
    
    // Create menu buttons
    this.createButtons();
  }
  
  /**
   * Create menu background
   */
  private createBackground(): void {
    // Add background image or effect
    this.add.rectangle(0, 0, this.cameras.main.width, this.cameras.main.height, 0x111111)
      .setOrigin(0)
      .setAlpha(1);
      
    // Add grid pattern for visual interest
    const gridSize = 32;
    const graphics = this.add.graphics();
    
    graphics.lineStyle(1, 0x444444, 0.3);
    
    // Draw vertical lines
    for (let x = 0; x < this.cameras.main.width; x += gridSize) {
      graphics.moveTo(x, 0);
      graphics.lineTo(x, this.cameras.main.height);
    }
    
    // Draw horizontal lines
    for (let y = 0; y < this.cameras.main.height; y += gridSize) {
      graphics.moveTo(0, y);
      graphics.lineTo(this.cameras.main.width, y);
    }
    
    graphics.strokePath();
  }
  
  /**
   * Create menu buttons
   */
  private createButtons(): void {
    const buttonY = 250;
    const spacing = 70;
    
    // New Game button
    this.createButton(
      this.cameras.main.width / 2,
      buttonY,
      'New Game',
      () => this.startNewGame()
    );
    
    // Difficulty button
    this.createButton(
      this.cameras.main.width / 2,
      buttonY + spacing,
      `Difficulty: ${this.currentDifficulty}`,
      () => this.cycleDifficulty()
    );
    
    // Options button
    this.createButton(
      this.cameras.main.width / 2,
      buttonY + spacing * 2,
      'Options',
      () => this.openOptions()
    );
    
    // Credits button
    this.createButton(
      this.cameras.main.width / 2,
      buttonY + spacing * 3,
      'Credits',
      () => this.showCredits()
    );
  }
  
  /**
   * Helper to create a menu button
   */
  private createButton(x: number, y: number, text: string, callback: () => void): Phaser.GameObjects.Container {
    // Create container for button
    const button = this.add.container(x, y);
    
    // Create button background
    const bg = this.add.rectangle(0, 0, 200, 50, 0x222222)
      .setStrokeStyle(1, 0x00ff00);
    
    // Create button text
    const buttonText = this.add.text(0, 0, text, {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#ffffff'
    }).setOrigin(0.5);
    
    // Add both to container
    button.add([bg, buttonText]);
    
    // Make button interactive
    bg.setInteractive({ useHandCursor: true })
      .on('pointerover', () => {
        bg.setFillStyle(0x444444);
      })
      .on('pointerout', () => {
        bg.setFillStyle(0x222222);
      })
      .on('pointerdown', () => {
        bg.setFillStyle(0x666666);
        this.time.delayedCall(100, callback);
      });
    
    return button;
  }
  
  /**
   * Start a new game with the current settings
   */
  private startNewGame(): void {
    console.log(`[MenuScene] Starting new game with difficulty: ${this.currentDifficulty}`);
    
    // Pass the difficulty setting to the game scene
    this.scene.start('GameScene', { 
      difficulty: this.currentDifficulty,
      isNewGame: true 
    });
    
    // Start UI scene in parallel
    this.scene.launch('UIScene');
  }
  
  /**
   * Cycle through difficulty levels
   */
  private cycleDifficulty(): void {
    // Cycle through difficulties: EASY -> MEDIUM -> HARD -> EASY
    switch (this.currentDifficulty) {
      case Difficulty.EASY:
        this.currentDifficulty = Difficulty.MEDIUM;
        break;
      case Difficulty.MEDIUM:
        this.currentDifficulty = Difficulty.HARD;
        break;
      case Difficulty.HARD:
        this.currentDifficulty = Difficulty.EASY;
        break;
    }
    
    // Update the difficulty button text
    const difficultyButton = this.children.list[3] as Phaser.GameObjects.Container;
    const buttonText = difficultyButton.getAt(1) as Phaser.GameObjects.Text;
    buttonText.setText(`Difficulty: ${this.currentDifficulty}`);
  }
  
  /**
   * Open options menu
   */
  private openOptions(): void {
    console.log('[MenuScene] Options button clicked (not implemented)');
    // This would normally open an options menu
  }
  
  /**
   * Show credits screen
   */
  private showCredits(): void {
    console.log('[MenuScene] Credits button clicked (not implemented)');
    // This would normally show a credits screen
  }
} 