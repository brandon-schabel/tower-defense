/**
 * GameScene
 * Main gameplay scene that manages the tower defense game logic and entities.
 * Responsible for coordinating game elements and handling game state.
 * 
 * Most Recent Changes:
 * - Added Player character and integration with input handling
 * - Updated update method to include Player in entity update cycle
 * - Fixed enemy end-of-path detection 
 * - Improved entity scaling for better visuals
 * - Extracted initialization logic into dedicated methods for better organization
 * - Delegated tower management responsibilities to MapManager
 * - Reduced UI responsibility by moving more UI elements to UIScene
 * - Fixed linter errors related to WAVE_CONFIG and WaveManager
 * - Removed unused imports and variables
 * - Fixed TypeScript errors with proper parameter naming
 */

import Phaser from 'phaser';
import { 
  Difficulty, 
  CONSTANTS, 
  WAVE_CONFIG, 
  TowerType, 
  DEFAULT_WIDTH, 
  DEFAULT_HEIGHT 
} from '../config/game-config';
import { PlayerBase } from '../entities/base';
import { Tower } from '../entities/tower';
import { Enemy } from '../entities/enemy';
import { Player } from '../entities/player';
import { MapManager } from '../managers/map-manager';
import { WaveManager } from '../managers/wave-manager';
import { PlayerManager } from '../managers/player-manager';
import { TextureLoader } from '../loaders/texture-loader';
import { ImageKey } from '../loaders/asset-loader/image-map';

export class GameScene extends Phaser.Scene {
  // Game state properties
  private difficulty!: Difficulty;
  private currentWave: number = 0;
  private resources: number = CONSTANTS.ECONOMY.STARTING_RESOURCES;
  private lives: number = 10;
  private isGamePaused: boolean = false;
  private isBuildMode: boolean = false;
  private selectedTowerType: TowerType = TowerType.BASIC;
  
  // Managers
  private mapManager!: MapManager;
  private waveManager!: WaveManager;
  private playerManager!: PlayerManager;
  
  // Game objects
  private _playerBase!: PlayerBase;
  private player!: Player;
  private path!: Phaser.Curves.Path;
  
  // Minimal UI elements (most UI moved to UIScene)
  private nextWaveButton!: Phaser.GameObjects.Rectangle;
  
  // Tower building UI
  private cellSize: number = 32; // Size of grid cells in pixels
  
  constructor() {
    super({ key: 'GameScene' });
  }
  
  /**
   * Initialize the scene with data passed from MenuScene
   */
  init(data: { difficulty: Difficulty, isNewGame: boolean }): void {
    // Set difficulty
    this.difficulty = data.difficulty || Difficulty.MEDIUM;
    
    console.log(`[GameScene] Initializing with difficulty: ${this.difficulty}`);
    
    // Reset game state for new game
    if (data.isNewGame) {
      this.currentWave = 0;
      this.resources = CONSTANTS.ECONOMY.STARTING_RESOURCES;
      this.lives = 10;
    }
  }
  
  /**
   * Create game objects and set up the scene
   */
  create(): void {
    console.log('[GameScene] Creating game scene');
    
    // Check if textures needed for entities are available
    this.verifyTextures(['base', 'normal-tower', 'basic-enemy', 'player']);
    
    this.createBackground();
    this.createPath();
    this.createPlayerBase();
    this.createPlayer();
    this.initializeManagers();
    this.setupInputHandlers();
    this.setupEventListeners();
    
    // Add debug overlay if there are texture issues
    this.createDebugOverlay();
    
    // Emit initial game state to UIScene
    this.emitGameState();
    
    // Start the first wave
    this.waveManager.startWaves();
  }
  
  /**
   * Verify that required textures exist
   * @param keys Array of texture keys to verify
   */
  private verifyTextures(keys: string[]): void {
    const availableTextures = this.textures.getTextureKeys();
    console.log('[GameScene] Available textures:', availableTextures);
    
    let allExists = true;
    
    for (const key of keys) {
      const exists = this.textures.exists(key);
      
      if (!exists) {
        console.warn(`[GameScene] Texture does not exist: ${key}`);
        allExists = false;
        
        // Log where this texture should be located based on the image map
        const imageMapModule = require('../loaders/asset-loader/image-map');
        const imageMap = imageMapModule.imageMap;
        
        if (imageMap && imageMap[key]) {
          const info = imageMap[key];
          const size = 64; // Example size
          let expectedPath = '';
          
          if (info.relativePath === '.') {
            expectedPath = `/public/assets/pngs/${info.name}_${size}x${size}.png`;
          } else {
            expectedPath = `/public/assets/pngs/${info.relativePath}/${info.name}_${size}x${size}.png`;
          }
          
          console.error(`[GameScene] Missing texture '${key}' should be located at: ${expectedPath}`);
        }
      } else {
        console.log(`[GameScene] Texture exists: ${key}`);
        
        // Log some details about the texture dimensions
        const texture = this.textures.get(key);
        if (texture && texture.source && texture.source[0]) {
          const source = texture.source[0];
          console.log(`[GameScene] Texture '${key}' dimensions: ${source.width}x${source.height}`);
        }
      }
    }
    
    if (!allExists) {
      console.warn('[GameScene] Some required textures are missing!');
    } else {
      console.log('[GameScene] All required textures verified and available');
    }
  }
  
  /**
   * Create scene background
   */
  private createBackground(): void {
    this.add.rectangle(0, 0, DEFAULT_WIDTH, DEFAULT_HEIGHT, 0x87CEEB)
      .setOrigin(0, 0);
  }
  
  /**
   * Create a path for enemies to follow
   */
  private createPath(): void {
    // Create a path for enemies to follow
    this.path = new Phaser.Curves.Path(0, 200);
    
    // Example path with several segments
    this.path.lineTo(100, 200);
    this.path.lineTo(100, 100);
    this.path.lineTo(300, 100);
    this.path.lineTo(300, 300);
    this.path.lineTo(500, 300);
    this.path.lineTo(500, 100);
    this.path.lineTo(700, 100);
    this.path.lineTo(700, 400);
    this.path.lineTo(DEFAULT_WIDTH, 400);
    
    // Draw the path for debugging
    const graphics = this.add.graphics();
    graphics.lineStyle(2, 0xffffff, 1);
    this.path.draw(graphics);
  }
  
  /**
   * Create the player base at the end of the path
   */
  private createPlayerBase(): void {
    // Get the end point of the path
    const endPoint = new Phaser.Math.Vector2();
    this.path.getEndPoint(endPoint);
    
    // Use a type-safe texture key with fallback
    let textureKey: ImageKey = 'base';
    
    // Check if base texture exists
    if (!this.textures.exists(textureKey)) {
      console.warn('[GameScene] Base texture not found, creating temporary texture');
      // Use a known ImageKey as a fallback
      textureKey = 'terrain-tiles' as ImageKey;
      // Create a temporary visual representation
      this.createTemporaryTexture('base', 0xffffff);
    } else {
      console.log('[GameScene] Using existing base texture:', textureKey);
    }
    
    console.log('[GameScene] Creating player base with texture:', textureKey);
    
    // Create the player base
    this._playerBase = new PlayerBase({
      scene: this,
      x: endPoint.x,
      y: endPoint.y,
      texture: textureKey
    });
  }
  
  /**
   * Create the player character
   */
  private createPlayer(): void {
    // Use a type-safe texture key with fallback
    let textureKey: ImageKey = 'player';
    
    // Check if player texture exists
    if (!this.textures.exists(textureKey)) {
      console.warn('[GameScene] Player texture not found, creating temporary texture');
      // Use a known ImageKey as a fallback
      textureKey = 'terrain-tiles' as ImageKey;
      // Create a temporary visual representation
      this.createTemporaryTexture('player', 0x00ff00);
    } else {
      console.log('[GameScene] Using existing player texture:', textureKey);
    }
    
    // Create player at a sensible starting position (e.g., near the start of the path)
    const startPoint = new Phaser.Math.Vector2();
    this.path.getPoint(0, startPoint);
    
    console.log('[GameScene] Creating player with texture:', textureKey);
    this.player = new Player(this, startPoint.x + 50, startPoint.y - 50, textureKey);
    
    // Add player to the physics system for collisions if needed
    this.physics.add.existing(this.player);
  }
  
  /**
   * Initialize game managers
   */
  private initializeManagers(): void {
    // Create managers
    this.mapManager = new MapManager(this, DEFAULT_WIDTH, DEFAULT_HEIGHT, this.cellSize, this.path);
    this.waveManager = new WaveManager(this, this.path);
    this.playerManager = new PlayerManager();
    
    // Configure wave manager callbacks
    this.waveManager.onWaveStart = (waveNumber, _waveData) => {
      this.events.emit('updateWave', waveNumber);
      this.events.emit('waveStarted', waveNumber);
    };
    
    this.waveManager.onWaveComplete = (waveNumber) => {
      this.events.emit('waveCompleted', {
        waveNumber,
        reward: this.calculateWaveReward(waveNumber)
      });
    };
    
    // Setup the onAllWavesComplete callback
    this.waveManager.onAllWavesComplete = () => {
      this.gameOver(true);
    };
  }
  
  /**
   * Set up input handlers for the game
   */
  private setupInputHandlers(): void {
    // Handle mouse clicks for tower placement
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.isGamePaused) return;
      
      if (this.isBuildMode) {
        // Place tower at pointer position if in build mode
        const result = this.mapManager.handleTowerPlacement(
          pointer.x,
          pointer.y,
          this.selectedTowerType,
          this.resources
        );
        
        if (result.success && result.tower && result.cost) {
          // Spend resources
          this.resources -= result.cost;
          this.events.emit('updateResources', this.resources);
          
          // Exit build mode
          this.exitBuildMode();
        } else if (result.message) {
          // Show error message
          this.showMessage(result.message, 0xff0000);
        }
      }
    });
    
    // Setup escape key to exit build mode or deselect tower
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.isBuildMode) {
        this.exitBuildMode();
      } else {
        // Deselect any selected tower
        this.mapManager.deselectTower();
      }
    });
  }
  
  /**
   * Set up event listeners for communication with UI scene
   */
  private setupEventListeners(): void {
    // Listen for events from the UI scene
    this.events.on('startNextWave', this.startNextWave, this);
    this.events.on('selectTower', this.enterBuildMode, this);
    this.events.on('pauseGame', this.togglePause, this);
    this.events.on('sellTower', this.sellTower, this);
    this.events.on('upgradeTower', this.upgradeTower, this);
  }
  
  /**
   * Emit current game state to the UI scene
   */
  private emitGameState(): void {
    this.events.emit('updateResources', this.resources);
    this.events.emit('updateLives', this.lives);
    this.events.emit('updateWave', this.currentWave);
    this.events.emit('updateScore', this.playerManager.getScore());
  }
  
  /**
   * Game loop
   */
  update(time: number, delta: number): void {
    if (this.isGamePaused) return;
    
    // Update all entities
    this.children.list.forEach(child => {
      if (child instanceof Tower || 
          child instanceof Enemy || 
          child instanceof Player || 
          child instanceof PlayerBase) {
        child.update(time, delta);
      }
    });
    
    // Check for win/lose conditions
    this.checkGameConditions();
  }
  
  /**
   * Start the next wave of enemies
   */
  private startNextWave(): void {
    if (this.isGamePaused) return;
    
    this.currentWave++;
    console.log(`[GameScene] Starting wave ${this.currentWave}`);
    
    // Trigger wave start
    this.waveManager.skipToNextWave();
  }
  
  /**
   * Calculate reward for completing a wave
   */
  private calculateWaveReward(waveNumber: number): number {
    // Define default values in case WAVE_CONFIG doesn't have these properties
    const baseReward = 100; // Default base reward
    const rewardMultiplier = 1.1; // Default multiplier
    
    return Math.floor(baseReward * Math.pow(rewardMultiplier, waveNumber - 1));
  }
  
  /**
   * Enter build mode to place a tower
   */
  private enterBuildMode(towerType: string): void {
    console.log(`[GameScene] Entering build mode with tower type: ${towerType}`);
    
    this.isBuildMode = true;
    this.selectedTowerType = towerType as TowerType;
    
    // Set cursor to indicate build mode
    this.input.setDefaultCursor('crosshair');
  }
  
  /**
   * Exit build mode
   */
  private exitBuildMode(): void {
    console.log('[GameScene] Exiting build mode');
    
    this.isBuildMode = false;
    this.selectedTowerType = TowerType.BASIC;
    
    // Reset cursor
    this.input.setDefaultCursor('default');
  }
  
  /**
   * Toggle the game pause state
   */
  private togglePause(): void {
    this.isGamePaused = !this.isGamePaused;
    console.log(`[GameScene] Game ${this.isGamePaused ? 'paused' : 'resumed'}`);
    
    // Emit pause state change
    this.events.emit('pauseStateChanged', this.isGamePaused);
  }
  
  /**
   * Sell a tower
   */
  private sellTower(_towerId: number): void {
    const selectedTower = this.mapManager.getSelectedTower();
    if (!selectedTower) return;
    
    // Delegate to map manager
    const result = this.mapManager.sellSelectedTower();
    
    if (result.success && result.cost) {
      // Add refund to player resources
      this.playerManager.addGold(result.cost);
      
      // Emit tower sold event
      this.events.emit('towerSold', selectedTower, result.cost);
    }
  }
  
  /**
   * Upgrade a tower
   */
  private upgradeTower(_data: { towerId: number, upgradeType: string }): void {
    const selectedTower = this.mapManager.getSelectedTower();
    if (!selectedTower) return;
    
    // Check if player can afford upgrade
    const upgradeCost = Math.floor(selectedTower.cost * 0.5 * selectedTower.upgradeLevel);
    
    if (this.playerManager.canAfford(upgradeCost)) {
      // Delegate to map manager
      const result = this.mapManager.upgradeSelectedTower();
      
      if (result.success && result.cost) {
        // Spend resources
        this.playerManager.spendGold(result.cost);
        
        // Emit tower upgraded event
        this.events.emit('towerUpgraded', selectedTower, result.cost);
      }
    } else {
      this.showMessage('Not enough resources for upgrade!', 0xff0000);
    }
  }
  
  /**
   * Check for win/lose conditions
   */
  private checkGameConditions(): void {
    // Check if player has lost
    if (this.lives <= 0) {
      this.gameOver(false);
    }
    
    // Check if player has won (all waves completed)
    if (this.areAllWavesCompleted()) {
      this.gameOver(true);
    }
  }
  
  /**
   * Check if all waves have been completed
   */
  private areAllWavesCompleted(): boolean {
    return this.waveManager.getCurrentWave() > WAVE_CONFIG.waves.length;
  }
  
  /**
   * Handle game over state
   */
  private gameOver(isVictory: boolean): void {
    console.log(`[GameScene] Game over! ${isVictory ? 'Victory' : 'Defeat'}`);
    
    this.isGamePaused = true;
    this.events.emit('gameOver', isVictory);
  }
  
  /**
   * Handle enemy reaching the end of the path
   */
  public enemyReachedEnd(): void {
    this.lives--;
    console.log(`[GameScene] Enemy reached end. Lives remaining: ${this.lives}`);
    
    this.events.emit('updateLives', this.lives);
    
    if (this.lives <= 0) {
      this.gameOver(false);
    }
  }
  
  /**
   * Add resources when an enemy is killed
   */
  public enemyKilled(reward: number): void {
    this.resources += reward;
    this.events.emit('updateResources', this.resources);
  }
  
  /**
   * Show a temporary message on screen
   */
  private showMessage(message: string, color: number = 0xffffff): void {
    // Emit to UI scene instead of creating text directly
    this.events.emit('showMessage', { message, color });
  }
  
  /**
   * Create a temporary texture for placeholders
   * This is useful until proper assets are loaded
   */
  private createTemporaryTexture(key: string, color: number): Phaser.Textures.Texture {
    // Generate a simple colored rectangle texture
    const graphics = this.make.graphics({ x: 0, y: 0 });
    graphics.fillStyle(color, 1);
    graphics.fillRect(0, 0, this.cellSize, this.cellSize);
    
    // Generate a texture from the graphics
    graphics.generateTexture(key, this.cellSize, this.cellSize);
    
    return this.textures.get(key);
  }
  
  /**
   * Create a debug overlay with information about rendering issues
   */
  private createDebugOverlay(): void {
    // Get all texture keys
    const availableTextures = this.textures.getTextureKeys();
    const requiredTextures = ['base', 'normal-tower', 'basic-enemy', 'player', 'projectile'];
    const missingTextures = requiredTextures.filter(key => !availableTextures.includes(key));
    
    if (missingTextures.length > 0) {
      // Create a semi-transparent background
      const debugBg = this.add.rectangle(10, 10, 400, 160, 0x000000, 0.7);
      debugBg.setOrigin(0, 0);
      debugBg.setDepth(1000); // Above everything
      
      // Create message depending on which textures are missing
      let helpMessage = '';
      
      if (missingTextures.length === requiredTextures.length) {
        helpMessage = 'All textures missing. Check file paths and asset directory structure.';
      } else if (missingTextures.includes('base')) {
        helpMessage = 'Base texture missing. Check root assets directory.';
      } else if (missingTextures.some(t => t.includes('enemy'))) {
        helpMessage = 'Enemy textures missing. Check /enemies subdirectory.';
      } else if (missingTextures.some(t => t.includes('tower'))) {
        helpMessage = 'Tower textures missing. Check /towers subdirectory.';
      } else {
        helpMessage = 'Some textures missing. Check console for details.';
      }
      
      // Add debug text
      const debugText = this.add.text(
        20, 
        20, 
        `ASSET LOADING ISSUES DETECTED
Missing textures: ${missingTextures.join(', ')}
${helpMessage}

Entities will use colored rectangles as fallbacks.
Check browser console (F12) for detailed error logs.`, 
        { 
          fontSize: '14px', 
          color: '#ff0000',
          backgroundColor: '#000000',
          padding: { x: 5, y: 5 }
        }
      );
      debugText.setDepth(1001);
      
      // Add dismiss button
      const dismissButton = this.add.text(
        380, 
        15, 
        'X', 
        { 
          fontSize: '16px', 
          color: '#ffffff', 
          backgroundColor: '#880000',
          padding: { x: 5, y: 2 }
        }
      );
      dismissButton.setOrigin(1, 0);
      dismissButton.setDepth(1001);
      dismissButton.setInteractive({ useHandCursor: true });
      dismissButton.on('pointerdown', () => {
        debugBg.destroy();
        debugText.destroy();
        dismissButton.destroy();
      });
      
      // Add check assets button that opens a popup with more details
      const checkAssetsButton = this.add.text(
        200,
        130,
        'Show Asset Guide',
        {
          fontSize: '14px',
          color: '#ffffff',
          backgroundColor: '#005588',
          padding: { x: 10, y: 5 }
        }
      );
      checkAssetsButton.setOrigin(0.5);
      checkAssetsButton.setDepth(1001);
      checkAssetsButton.setInteractive({ useHandCursor: true });
      checkAssetsButton.on('pointerdown', () => {
        this.showAssetGuide(missingTextures);
      });
    }
  }
  
  /**
   * Show a detailed asset guide to help resolve texture issues
   */
  private showAssetGuide(missingTextures: string[]): void {
    // Create a larger semi-transparent background
    const guideBg = this.add.rectangle(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2,
      600, 400, 0x000000, 0.9
    );
    guideBg.setOrigin(0.5);
    guideBg.setDepth(1100);
    
    // Add title
    const guideTitle = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 - 180,
      'ASSET LOADING TROUBLESHOOTING GUIDE',
      {
        fontSize: '18px',
        color: '#ffffff',
        fontStyle: 'bold'
      }
    );
    guideTitle.setOrigin(0.5);
    guideTitle.setDepth(1101);
    
    // Create guide text
    const guideText = this.add.text(
      this.cameras.main.width / 2 - 280,
      this.cameras.main.height / 2 - 150,
      `The following textures are missing: ${missingTextures.join(', ')}
      
1. Check that all asset files exist in the correct locations:
   - Root assets: /public/assets/pngs/[name]_[size]x[size].png
   - Enemies: /public/assets/pngs/enemies/[name]_[size]x[size].png
   - Towers: /public/assets/pngs/towers/[name]_[size]x[size].png
   
2. Ensure filenames match exactly (case-sensitive):
   - Example: basic-enemy_64x64.png for size 64
   
3. Try clearing browser cache and reloading
   
4. Check browser console (F12) for specific file errors
   
5. Look for networking errors in browser dev tools
   
You can continue playing with fallback textures.
The game will automatically use colored shapes for any missing textures.`,
      {
        fontSize: '14px',
        color: '#cccccc',
        align: 'left',
        wordWrap: { width: 560 }
      }
    );
    guideText.setDepth(1101);
    
    // Add close button
    const closeButton = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 + 160,
      'CLOSE',
      {
        fontSize: '16px',
        color: '#ffffff',
        backgroundColor: '#880000',
        padding: { x: 20, y: 10 }
      }
    );
    closeButton.setOrigin(0.5);
    closeButton.setDepth(1101);
    closeButton.setInteractive({ useHandCursor: true });
    closeButton.on('pointerdown', () => {
      guideBg.destroy();
      guideTitle.destroy();
      guideText.destroy();
      closeButton.destroy();
    });
  }
} 