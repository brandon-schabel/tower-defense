/**
 * UIScene
 * Overlays on top of the GameScene to display UI elements for the player.
 * Handles all game UI rendering and user interaction with UI components.
 * 
 * Most Recent Changes:
 * - Fixed tower rendering in tower selection UI by using sprite textures instead of colored rectangles
 * - Updated tower selection to use correct texture keys from TOWER_TYPES
 * - Added fallback for missing textures with warning logs
 * - Added new event handlers for tower placement, sale, and upgrades
 * - Added showMessage method to display game notifications
 * - Consolidated all UI elements from GameScene to UIScene
 * - Updated imports to use consolidated game-config.ts
 */

import Phaser from 'phaser';
import { CONSTANTS, PLAYER_CONFIG, TOWER_TYPES, TowerType } from '../config/game-config';
import { Tower } from '../entities/tower';
import { ImageKey } from '../loaders/asset-loader/image-map';

export class UIScene extends Phaser.Scene {
  // UI state
  private resources: number = PLAYER_CONFIG.startingGold;
  private lives: number = PLAYER_CONFIG.startingLives;
  private currentWave: number = 0;
  private score: number = 0;
  private isGamePaused: boolean = false;
  
  // UI elements
  private resourceText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private nextWaveButton!: Phaser.GameObjects.Container;
  private towerButtons: Phaser.GameObjects.Container[] = [];
  private statusText!: Phaser.GameObjects.Text;
  private gameOverOverlay?: Phaser.GameObjects.Container;
  
  constructor() {
    super({ key: 'UIScene' });
  }
  
  create(): void {
    console.log('[UIScene] Creating UI elements');
    
    // Create top bar for game stats
    this.createTopBar();
    
    // Create tower selection toolbar
    this.createTowerSelectionBar();
    
    // Create wave control button
    this.createWaveControls();
    
    // Create status text for notifications
    this.createStatusText();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Make this scene sit on top of the GameScene
    this.scene.bringToTop();
  }
  
  /**
   * Create top bar with player stats (resources, lives, wave)
   */
  private createTopBar(): void {
    // Create top bar background
    const topBarHeight = 40;
    const topBar = this.add.rectangle(
      0, 0, 
      this.cameras.main.width, 
      topBarHeight, 
      0x222222, 0.8
    ).setOrigin(0);
    
    // Resources display
    this.resourceText = this.add.text(
      10, 
      topBarHeight / 2, 
      `Resources: ${this.resources}`, 
      { 
        fontFamily: 'Arial', 
        fontSize: '16px', 
        color: '#ffffff' 
      }
    ).setOrigin(0, 0.5);
    
    // Lives display
    this.livesText = this.add.text(
      this.cameras.main.width / 2, 
      topBarHeight / 2, 
      `Lives: ${this.lives}`, 
      { 
        fontFamily: 'Arial', 
        fontSize: '16px', 
        color: '#ffffff' 
      }
    ).setOrigin(0.5, 0.5);
    
    // Wave display
    this.waveText = this.add.text(
      this.cameras.main.width - 10, 
      topBarHeight / 2, 
      `Wave: ${this.currentWave}`, 
      { 
        fontFamily: 'Arial', 
        fontSize: '16px', 
        color: '#ffffff' 
      }
    ).setOrigin(1, 0.5);
    
    // Score display (new addition)
    this.scoreText = this.add.text(
      this.cameras.main.width / 4 * 3, 
      topBarHeight / 2, 
      `Score: ${this.score}`, 
      { 
        fontFamily: 'Arial', 
        fontSize: '16px', 
        color: '#ffffff' 
      }
    ).setOrigin(0.5, 0.5);
    
    // Make these elements fixed to the camera
    topBar.setScrollFactor(0);
    this.resourceText.setScrollFactor(0);
    this.livesText.setScrollFactor(0);
    this.waveText.setScrollFactor(0);
    this.scoreText.setScrollFactor(0);
  }
  
  /**
   * Create tower selection toolbar
   */
  private createTowerSelectionBar(): void {
    const bottomBarHeight = 60;
    const bottomBarY = this.cameras.main.height - bottomBarHeight;
    
    // Create bottom bar background
    const bottomBar = this.add.rectangle(
      0, 
      bottomBarY, 
      this.cameras.main.width, 
      bottomBarHeight, 
      0x222222, 0.8
    ).setOrigin(0);
    
    // Make it fixed to the camera
    bottomBar.setScrollFactor(0);
    
    // Create tower buttons
    const buttonWidth = 50;
    const buttonSpacing = 20;
    const totalWidth = (buttonWidth * 3) + (buttonSpacing * 2);
    const startX = (this.cameras.main.width - totalWidth) / 2;
    
    // Tower names and costs
    const towerTypes = [
      { type: TowerType.BASIC, name: 'Basic' },
      { type: TowerType.SNIPER, name: 'Sniper' },
      { type: TowerType.SPLASH, name: 'Splash' }
    ];
    
    // Create a button for each tower type
    for (let i = 0; i < towerTypes.length; i++) {
      const x = startX + (buttonWidth + buttonSpacing) * i;
      const y = bottomBarY + bottomBarHeight / 2;
      
      // Get the texture key for this tower type
      const textureKey = TOWER_TYPES[towerTypes[i].type].texture as ImageKey;
      
      // Create a button container
      const towerButton = this.createTowerButton(
        x, y, 
        `${towerTypes[i].name}\n${this.getTowerCost(towerTypes[i].type.toString())}`, 
        textureKey,
        towerTypes[i].type.toString()
      );
      
      towerButton.setScrollFactor(0);
      this.towerButtons.push(towerButton);
    }
  }
  
  /**
   * Create wave control button
   */
  private createWaveControls(): void {
    const bottomBarHeight = 60;
    const bottomBarY = this.cameras.main.height - bottomBarHeight;
    
    // Create next wave button
    this.nextWaveButton = this.createButton(
      this.cameras.main.width - 100,
      bottomBarY + bottomBarHeight / 2,
      'Start Wave',
      () => this.startNextWave()
    );
    
    this.nextWaveButton.setScrollFactor(0);
  }
  
  /**
   * Create status text for game notifications
   */
  private createStatusText(): void {
    this.statusText = this.add.text(
      this.cameras.main.width / 2,
      100,
      '',
      {
        fontFamily: 'Arial',
        fontSize: '24px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4
      }
    )
    .setOrigin(0.5)
    .setAlpha(0)
    .setScrollFactor(0);
  }
  
  /**
   * Helper to create a tower selection button
   */
  private createTowerButton(
    x: number, 
    y: number, 
    text: string,
    textureKey: ImageKey,
    towerType: string
  ): Phaser.GameObjects.Container {
    // Create container for button
    const button = this.add.container(x, y);
    
    // Create button background
    const bg = this.add.rectangle(0, 0, 50, 50, 0x444444)
      .setStrokeStyle(1, 0xffffff);
    
    // Add background to container first
    button.add(bg);
    
    // Create tower icon using actual texture
    if (this.textures.exists(textureKey)) {
      console.log(`[UIScene] Using texture ${textureKey} for tower button`);
      const icon = this.add.sprite(0, -10, textureKey);
      icon.setDisplaySize(30, 30); // Scale to fit the button
      button.add(icon);
    } else {
      // Fallback if texture doesn't exist
      console.warn(`[UIScene] Texture ${textureKey} not found, using fallback rectangle`);
      const fallbackIcon = this.add.rectangle(0, -10, 20, 20, 0xff0000);
      button.add(fallbackIcon);
    }
    
    // Create button text
    const buttonText = this.add.text(0, 15, text, {
      fontFamily: 'Arial',
      fontSize: '10px',
      color: '#ffffff',
      align: 'center'
    }).setOrigin(0.5);
    
    // Add text to container
    button.add(buttonText);
    
    // Make button interactive
    bg.setInteractive({ useHandCursor: true })
      .on('pointerover', () => {
        bg.setFillStyle(0x666666);
      })
      .on('pointerout', () => {
        bg.setFillStyle(0x444444);
      })
      .on('pointerdown', () => {
        this.selectTower(towerType);
        bg.setFillStyle(0x444444);
      });
    
    return button;
  }
  
  /**
   * Helper to create a general button
   */
  private createButton(
    x: number,
    y: number,
    text: string,
    callback: () => void
  ): Phaser.GameObjects.Container {
    // Create container for button
    const button = this.add.container(x, y);
    
    // Create button background
    const bg = this.add.rectangle(0, 0, 120, 40, 0x008800)
      .setStrokeStyle(1, 0xffffff);
    
    // Create button text
    const buttonText = this.add.text(0, 0, text, {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#ffffff'
    }).setOrigin(0.5);
    
    // Add to container
    button.add([bg, buttonText]);
    
    // Make button interactive
    bg.setInteractive({ useHandCursor: true })
      .on('pointerover', () => {
        bg.setFillStyle(0x00aa00);
      })
      .on('pointerout', () => {
        bg.setFillStyle(0x008800);
      })
      .on('pointerdown', () => {
        bg.setFillStyle(0x006600);
        this.time.delayedCall(100, callback);
      });
    
    return button;
  }
  
  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Listen for game scene events
    const gameScene = this.scene.get('GameScene');
    
    gameScene.events.on('updateResources', this.updateResources, this);
    gameScene.events.on('updateLives', this.updateLives, this);
    gameScene.events.on('updateWave', this.updateWave, this);
    gameScene.events.on('updateScore', this.updateScore, this);
    gameScene.events.on('waveStarted', this.onWaveStarted, this);
    gameScene.events.on('waveCompleted', this.onWaveCompleted, this);
    gameScene.events.on('gameOver', this.showGameOverMessage, this);
    
    // New tower-related events
    gameScene.events.on('towerPlaced', this.onTowerPlaced, this);
    gameScene.events.on('towerSold', this.onTowerSold, this);
    gameScene.events.on('towerUpgraded', this.onTowerUpgraded, this);
    gameScene.events.on('towerSelected', this.onTowerSelected, this);
    gameScene.events.on('towerDeselected', this.onTowerDeselected, this);
    
    // Message system for notifications
    gameScene.events.on('showMessage', this.onShowMessage, this);
  }
  
  /**
   * Update resources display
   */
  private updateResources(amount: number): void {
    this.resources = amount;
    this.resourceText.setText(`Resources: ${this.resources}`);
    
    // Update tower button affordability
    this.updateTowerButtonsAffordability();
  }
  
  /**
   * Update lives display
   */
  private updateLives(lives: number): void {
    this.lives = lives;
    this.livesText.setText(`Lives: ${this.lives}`);
  }
  
  /**
   * Update wave display
   */
  private updateWave(wave: number): void {
    this.currentWave = wave;
    this.waveText.setText(`Wave: ${this.currentWave}`);
  }
  
  /**
   * Update score display
   */
  private updateScore(score: number): void {
    this.score = score;
    this.scoreText.setText(`Score: ${this.score}`);
  }
  
  /**
   * Handle tower placed event
   */
  private onTowerPlaced(tower: Tower, towerType: TowerType): void {
    this.showStatusMessage(`${towerType} tower placed!`);
    this.updateTowerButtonsAffordability();
  }
  
  /**
   * Handle tower sold event
   */
  private onTowerSold(tower: Tower, refundAmount: number): void {
    this.showStatusMessage(`Tower sold for ${refundAmount} gold!`);
    this.updateTowerButtonsAffordability();
  }
  
  /**
   * Handle tower upgraded event
   */
  private onTowerUpgraded(tower: Tower, cost: number): void {
    this.showStatusMessage(`Tower upgraded to level ${tower.upgradeLevel}!`);
    this.updateTowerButtonsAffordability();
  }
  
  /**
   * Handle tower selected event
   */
  private onTowerSelected(tower: Tower): void {
    // Could show tower info panel or upgrade options
    console.log('[UIScene] Tower selected:', tower);
  }
  
  /**
   * Handle tower deselected event
   */
  private onTowerDeselected(): void {
    // Could hide tower info panel or upgrade options
    console.log('[UIScene] Tower deselected');
  }
  
  /**
   * Handle show message event from GameScene
   */
  private onShowMessage(data: { message: string, color: number }): void {
    this.showStatusMessage(data.message);
  }
  
  /**
   * Handle wave started event
   */
  private onWaveStarted(waveNumber: number): void {
    // Show wave started message
    this.showStatusMessage(`Wave ${waveNumber} started!`);
    
    // Disable next wave button during wave
    const bg = this.nextWaveButton.getAt(0) as Phaser.GameObjects.Rectangle;
    const text = this.nextWaveButton.getAt(1) as Phaser.GameObjects.Text;
    
    bg.setFillStyle(0x555555);
    text.setText('Wave in Progress');
    bg.disableInteractive();
  }
  
  /**
   * Handle wave completed event
   */
  private onWaveCompleted(data: { waveNumber: number, reward: number }): void {
    // Show wave completed message
    this.showStatusMessage(`Wave ${data.waveNumber} completed!\n+${data.reward} resources`);
    
    // Re-enable next wave button
    const bg = this.nextWaveButton.getAt(0) as Phaser.GameObjects.Rectangle;
    const text = this.nextWaveButton.getAt(1) as Phaser.GameObjects.Text;
    
    bg.setFillStyle(0x008800);
    text.setText('Start Next Wave');
    bg.setInteractive({ useHandCursor: true });
  }
  
  /**
   * Select a tower for placement
   */
  private selectTower(towerType: string): void {
    console.log(`[UIScene] Selected tower: ${towerType}`);
    
    // Check if player has enough resources
    const towerCost = this.getTowerCost(towerType);
    
    if (this.resources >= towerCost) {
      // Emit event to game scene
      const gameScene = this.scene.get('GameScene');
      gameScene.events.emit('selectTower', towerType);
    } else {
      this.showStatusMessage('Not enough resources!');
    }
  }
  
  /**
   * Get cost for a tower type
   */
  private getTowerCost(towerType: string): number {
    // Return the cost of the specified tower type
    switch (towerType) {
      case TowerType.BASIC:
        return TOWER_TYPES[TowerType.BASIC].cost;
      case TowerType.SNIPER:
        return TOWER_TYPES[TowerType.SNIPER].cost;
      case TowerType.SPLASH:
        return TOWER_TYPES[TowerType.SPLASH].cost;
      default:
        return 0;
    }
  }
  
  /**
   * Update tower buttons based on affordability
   */
  private updateTowerButtonsAffordability(): void {
    const towerTypes = [
      TowerType.BASIC,
      TowerType.SNIPER,
      TowerType.SPLASH
    ];
    
    for (let i = 0; i < this.towerButtons.length; i++) {
      const button = this.towerButtons[i];
      const bg = button.getAt(0) as Phaser.GameObjects.Rectangle;
      const cost = this.getTowerCost(towerTypes[i].toString());
      
      if (this.resources >= cost) {
        // Player can afford this tower
        bg.setFillStyle(0x444444);
        button.setAlpha(1);
        bg.setInteractive({ useHandCursor: true });
      } else {
        // Player cannot afford this tower
        bg.setFillStyle(0x333333);
        button.setAlpha(0.7);
        bg.disableInteractive();
      }
    }
  }
  
  /**
   * Display a temporary status message
   */
  private showStatusMessage(message: string, duration: number = 2000): void {
    // Update text
    this.statusText.setText(message);
    
    // Stop any existing tweens
    this.tweens.killTweensOf(this.statusText);
    
    // Show message with fade in/out
    this.statusText.setAlpha(0);
    
    this.tweens.add({
      targets: this.statusText,
      alpha: 1,
      duration: 200,
      onComplete: () => {
        this.tweens.add({
          targets: this.statusText,
          alpha: 0,
          delay: duration,
          duration: 500
        });
      }
    });
  }
  
  /**
   * Start the next wave
   */
  private startNextWave(): void {
    console.log('[UIScene] Start next wave button clicked');
    
    // Notify game scene
    const gameScene = this.scene.get('GameScene');
    gameScene.events.emit('startNextWave');
  }
  
  /**
   * Show game over message
   */
  private showGameOverMessage(isVictory: boolean): void {
    // Create overlay
    const overlay = this.add.rectangle(
      0, 0,
      this.cameras.main.width,
      this.cameras.main.height,
      0x000000, 0.7
    )
    .setOrigin(0)
    .setScrollFactor(0);
    
    // Add game over text
    const message = isVictory ? 'Victory!' : 'Game Over';
    const color = isVictory ? '#ffff00' : '#ff0000';
    
    const gameOverText = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 - 50,
      message,
      {
        fontFamily: 'Arial',
        fontSize: '48px',
        color: color,
        stroke: '#000000',
        strokeThickness: 6
      }
    )
    .setOrigin(0.5)
    .setScrollFactor(0);
    
    // Add return to menu button
    const menuButton = this.createButton(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 + 50,
      'Return to Menu',
      () => this.returnToMenu()
    );
    
    menuButton.setScrollFactor(0);
  }
  
  /**
   * Return to the main menu
   */
  private returnToMenu(): void {
    console.log('[UIScene] Returning to main menu');
    
    // Stop both scenes and start menu
    this.scene.stop('GameScene');
    this.scene.stop();
    this.scene.start('MenuScene');
  }
} 