/**
 * Boot Scene
 * First scene loaded when the game starts
 * Handles initial setup like loading screen and any global configurations
 * 
 * Most Recent Changes:
 * - Updated scale manager to use Phaser 3 API instead of legacy properties
 */
import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'boot' });
  }

  preload(): void {
    // Load minimal assets needed for the loading screen
    this.load.image('loading-background', 'assets/ui/loading-background.png');
    this.load.image('loading-bar', 'assets/ui/loading-bar.png');
    
    // Set up any global game settings using modern Phaser 3 scale manager
    this.scale.setGameSize(this.scale.width, this.scale.height);
    this.scale.scaleMode = Phaser.Scale.FIT;
    this.scale.autoCenter = Phaser.Scale.CENTER_BOTH;
  }

  create(): void {
    // Apply any global configurations
    this.input.setDefaultCursor('url(assets/ui/cursor.png), pointer');
    
    // Set up any physics configurations
    this.physics.world.setBounds(0, 0, this.cameras.main.width, this.cameras.main.height);

    // Move to the preload scene
    this.scene.start('preload');
  }
} 