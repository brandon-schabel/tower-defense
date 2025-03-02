/**
 * PreloadScene
 * Handles asset loading and displays a loading bar.
 * 
 * Most Recent Changes:
 * - Removed non-existent tilemapTiledJSON loading for test-map.json
 * - Added comment indicating that maps are currently defined in MAP_CONFIG
 */

import Phaser from 'phaser';
import { AvailableSize } from '../loaders/asset-loader/image-map';
import { AssetLoader } from '../loaders/asset-loader/asset-loader';

export class PreloadScene extends Phaser.Scene {
  private loadingBar!: Phaser.GameObjects.Graphics;
  private loadingText!: Phaser.GameObjects.Text;
  private loadingPercentage!: Phaser.GameObjects.Text;
  private assetLoader!: AssetLoader;
  
  constructor() {
    super({ key: 'preload' });
  }
  
  preload(): void {
    this.createLoadingBar();
    
    // Create asset loader
    this.assetLoader = new AssetLoader(this);
    
    // Determine best image resolution for the device
    const optimalSize = this.assetLoader.determineOptimalSize();
    console.log(`[PreloadScene] Selected resolution: ${optimalSize}px`);
    
    // Register loading events
    this.load.on('progress', this.updateLoadingBar, this);
    this.load.on('complete', this.onLoadComplete, this);
    
    this.loadAssets(optimalSize);
  }
  
  /**
   * Create the loading bar UI elements
   */
  private createLoadingBar(): void {
    // Create loading bar graphics
    this.loadingBar = this.add.graphics();
    
    // Loading text
    this.loadingText = this.add.text(
      this.cameras.main.width / 2, 
      this.cameras.main.height / 2 - 50,
      'Loading Game Assets...', 
      { 
        fontFamily: 'Arial', 
        fontSize: '24px', 
        color: '#ffffff' 
      }
    ).setOrigin(0.5);
    
    // Percentage text
    this.loadingPercentage = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 + 30,
      '0%',
      {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#ffffff'
      }
    ).setOrigin(0.5);
  }
  
  /**
   * Update loading bar based on load progress
   */
  private updateLoadingBar(value: number): void {
    // Update loading bar progress
    this.loadingBar.clear();
    
    // Draw background bar
    this.loadingBar.fillStyle(0x222222, 0.8);
    this.loadingBar.fillRect(
      this.cameras.main.width / 2 - 160,
      this.cameras.main.height / 2 - 25,
      320,
      50
    );
    
    // Draw progress bar
    this.loadingBar.fillStyle(0x00aa00, 1);
    this.loadingBar.fillRect(
      this.cameras.main.width / 2 - 150,
      this.cameras.main.height / 2 - 15,
      300 * value,
      30
    );
    
    // Update percentage text
    this.loadingPercentage.setText(`${Math.floor(value * 100)}%`);
  }
  
  /**
   * Load all game assets
   */
  private loadAssets(imageSize: AvailableSize): void {
    console.log(`[PreloadScene] Loading assets at ${imageSize}px resolution`);
    
    // Register for load errors
    this.load.on('loaderror', (file: any) => {
      console.error(`[PreloadScene] Error loading file: ${file.key} from ${file.url}`);
    });
    
    // Log which specific files are requested
    this.load.on('filerequest', (file: any) => {
      console.log(`[PreloadScene] Requesting file: ${file.key} from ${file.url}`);
    });
    
    // Log every successful file load
    this.load.on('filecomplete', (key: string, type: string, data: any) => {
      console.log(`[PreloadScene] Successfully loaded ${type} asset: ${key}`);
    });
    
    // Load all images using the asset loader
    try {
      this.assetLoader.preloadAllImages(this.updateLoadingBar.bind(this));
      console.log('[PreloadScene] Started loading all images');
    } catch (error) {
      console.error('[PreloadScene] Error loading images:', error);
    }
    
    // For audio and other non-image assets, load them directly
    try {
      this.load.audio('button-click', 'assets/sounds/ui/button-click.mp3');
      this.load.audio('game-music', 'assets/music/game-music.mp3');
    } catch (error) {
      console.error('[PreloadScene] Error loading audio:', error);
    }
  }
  
  /**
   * Called when all assets have been loaded
   */
  private onLoadComplete(): void {
    console.log('[PreloadScene] All assets loaded');
    
    // Debug: Check which textures are available
    const textureKeys = this.textures.getTextureKeys();
    console.log('[PreloadScene] Available textures:', textureKeys);
    
    // Check specifically for entity textures to verify they loaded
    const keyEntities = ['base', 'normal-tower', 'basic-enemy', 'player'];
    const missingEntityTextures = keyEntities.filter(key => !this.textures.exists(key));
    
    if (missingEntityTextures.length > 0) {
      console.warn('[PreloadScene] Critical textures missing:', missingEntityTextures);
      
      // Force reload of missing textures
      missingEntityTextures.forEach(key => {
        if (this.assetLoader) {
          console.log(`[PreloadScene] Attempting to reload: ${key}`);
          // Try to reload the missing textures with a specific size
          this.assetLoader.preloadSpecificImages([key as any], undefined);
        }
      });
      
      // Add a longer delay to ensure assets load
      this.time.delayedCall(1000, () => {
        this.scene.start('MenuScene');
      });
    } else {
      console.log('[PreloadScene] All critical entity textures loaded successfully');
      
      // Delay the transition to create a smoother experience
      this.time.delayedCall(500, () => {
        this.scene.start('MenuScene');
      });
    }
  }
  
  create(): void {
    // Create animations if needed
    this.createAnimations();
  }

  /**
   * Create any animations needed for the game
   */
  private createAnimations(): void {
    // Animation examples:
    // this.anims.create({
    //   key: 'enemy-walk',
    //   frames: this.anims.generateFrameNumbers('enemy', { start: 0, end: 7 }),
    //   frameRate: 10,
    //   repeat: -1
    // });
  }
} 