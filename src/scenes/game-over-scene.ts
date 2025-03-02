/**
 * GameOverScene class
 * Displays the game over screen with final score and restart option
 * 
 * Most Recent Changes:
 * - Updated imports to use consolidated game-config.ts
 * - Fixed imports for DEFAULT_WIDTH and DEFAULT_HEIGHT
 */
import Phaser from 'phaser';
import { DEFAULT_WIDTH, DEFAULT_HEIGHT } from '../config/game-config';

interface GameOverSceneData {
  victory: boolean;
  score: number;
  wavesCompleted: number;
}

export class GameOverScene extends Phaser.Scene {
  private gameData!: GameOverSceneData;
  
  constructor() {
    super({ key: 'GameOverScene' });
  }
  
  init(data: GameOverSceneData): void {
    this.gameData = data;
  }
  
  create(): void {
    // Semi-transparent background
    this.add.rectangle(0, 0, DEFAULT_WIDTH, DEFAULT_HEIGHT, 0x000000, 0.7)
      .setOrigin(0, 0);
    
    // Game over title
    const titleText = this.gameData.victory ? 'Victory!' : 'Game Over';
    const titleColor = this.gameData.victory ? '#ffff00' : '#ff0000';
    
    this.add.text(DEFAULT_WIDTH / 2, 150, titleText, {
      fontSize: '64px',
      color: titleColor,
      fontStyle: 'bold'
    }).setOrigin(0.5);
    
    // Score and waves completed
    this.add.text(DEFAULT_WIDTH / 2, 250, `Score: ${this.gameData.score}`, {
      fontSize: '32px',
      color: '#ffffff'
    }).setOrigin(0.5);
    
    this.add.text(DEFAULT_WIDTH / 2, 300, `Waves Completed: ${this.gameData.wavesCompleted}`, {
      fontSize: '32px',
      color: '#ffffff'
    }).setOrigin(0.5);
    
    // Victory or defeat message
    const message = this.gameData.victory
      ? 'Congratulations! You have successfully defended your base!'
      : 'Your base has been destroyed! Better luck next time!';
    
    this.add.text(DEFAULT_WIDTH / 2, 370, message, {
      fontSize: '24px',
      color: '#ffffff',
      align: 'center',
      wordWrap: { width: DEFAULT_WIDTH - 200 }
    }).setOrigin(0.5);
    
    // Restart button
    const restartButton = this.add.rectangle(DEFAULT_WIDTH / 2, 450, 200, 50, 0x22bb22)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.restartGame();
      });
    
    this.add.text(DEFAULT_WIDTH / 2, 450, 'Play Again', {
      fontSize: '24px',
      color: '#ffffff'
    }).setOrigin(0.5);
    
    // Main menu button
    const menuButton = this.add.rectangle(DEFAULT_WIDTH / 2, 520, 200, 50, 0x2222bb)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.returnToMainMenu();
      });
    
    this.add.text(DEFAULT_WIDTH / 2, 520, 'Main Menu', {
      fontSize: '24px',
      color: '#ffffff'
    }).setOrigin(0.5);
    
    // Add hover effects to buttons
    this.addButtonHoverEffects(restartButton);
    this.addButtonHoverEffects(menuButton);
  }
  
  /**
   * Add hover effects to a button
   */
  private addButtonHoverEffects(button: Phaser.GameObjects.Rectangle): void {
    button.on('pointerover', () => {
      button.setScale(1.05);
    });
    
    button.on('pointerout', () => {
      button.setScale(1);
    });
  }
  
  /**
   * Restart the game
   */
  private restartGame(): void {
    // Stop this scene
    this.scene.stop();
    
    // Stop and restart the game scene
    this.scene.stop('GameScene');
    this.scene.start('GameScene');
  }
  
  /**
   * Return to the main menu
   */
  private returnToMainMenu(): void {
    // Stop all active scenes
    this.scene.stop();
    this.scene.stop('GameScene');
    
    // Start the menu scene
    this.scene.start('MenuScene');
  }
} 