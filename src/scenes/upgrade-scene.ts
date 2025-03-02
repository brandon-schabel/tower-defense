/**
 * Upgrade Scene
 * Displayed when a player selects a tower to upgrade
 * Shows tower stats and upgrade options
 * 
 * Most Recent Changes:
 * - Fixed TypeScript type issues including uninitialized properties
 * - Added proper null checking for keyboard events
 * - Fixed type issues with tower properties and upgrade configurations
 * - Improved type safety for upgrade access using proper type assertions
 * - Updated imports to use consolidated game-config.ts
 */
import Phaser from 'phaser';
import { Tower } from '../entities/tower';
import { UI_CONFIG, TOWER_TYPES, TowerType } from '../config/game-config';
import { PlayerManager } from '../managers/player-manager';

// Type definition for upgrade object
type UpgradeLevel = {
  damage?: number;
  range?: number;
  attackSpeed?: number;
  cost: number;
};

// Type definition for upgrade levels
type UpgradesMap = {
  [level: number]: UpgradeLevel;
};

export class UpgradeScene extends Phaser.Scene {
  private selectedTower: Tower | null = null;
  private playerManager: PlayerManager | null = null;
  private panel!: Phaser.GameObjects.Container;
  private statsText!: Phaser.GameObjects.Text;
  private upgradeButton!: Phaser.GameObjects.Text;
  private sellButton!: Phaser.GameObjects.Text;
  private closeButton!: Phaser.GameObjects.Text;
  
  constructor() {
    super({ key: 'upgrade' });
  }
  
  init(data: { tower: Tower, playerManager: PlayerManager }): void {
    this.selectedTower = data.tower;
    this.playerManager = data.playerManager;
  }
  
  create(): void {
    if (!this.selectedTower || !this.playerManager) {
      this.scene.stop();
      return;
    }
    
    // Add semi-transparent background
    const { width, height } = this.cameras.main;
    const bg = this.add.rectangle(0, 0, width, height, 0x000000, 0.5);
    bg.setOrigin(0);
    bg.setInteractive(); // Block inputs to game scene
    
    // Create panel container for all UI elements
    this.createPanel();
    
    // Show tower range
    this.selectedTower.showRangeIndicator();
    
    // Listen for escape key to close
    const keyboard = this.input.keyboard;
    if (keyboard) {
      keyboard.on('keydown-ESC', this.closeUpgradePanel, this);
    }
    
    // Have the background close the panel when clicked
    bg.on('pointerdown', this.closeUpgradePanel, this);
  }
  
  private createPanel(): void {
    if (!this.selectedTower || !this.playerManager) return;
    
    const { width, height } = this.cameras.main;
    const panelWidth = 300;
    const panelHeight = 350;
    const panelX = width / 2;
    const panelY = height / 2;
    
    // Create panel background
    const panelBg = this.add.rectangle(0, 0, panelWidth, panelHeight, 0x333333);
    panelBg.setStrokeStyle(2, 0xffcc00);
    
    // Create panel title
    const titleText = this.add.text(
      0, 
      -panelHeight / 2 + 20, 
      `${this.selectedTower.type} TOWER (Level ${this.selectedTower.upgradeLevel})`, 
      {
        fontFamily: 'Arial',
        fontSize: UI_CONFIG.fontSize.large,
        color: UI_CONFIG.colors.highlight
      }
    );
    titleText.setOrigin(0.5);
    
    // Create tower icon/image
    const towerImage = this.add.image(
      0, 
      -panelHeight / 2 + 80, 
      this.selectedTower.texture.key
    );
    towerImage.setScale(2);
    
    // Create tower stats text
    this.statsText = this.add.text(
      0, 
      -20, 
      this.getTowerStatsText(), 
      {
        fontFamily: 'Arial',
        fontSize: UI_CONFIG.fontSize.medium,
        color: UI_CONFIG.colors.primary,
        align: 'center'
      }
    );
    this.statsText.setOrigin(0.5);
    
    // Create upgrade button
    const canUpgrade = this.canUpgradeTower();
    this.upgradeButton = this.add.text(
      0, 
      60, 
      `UPGRADE (${this.getUpgradeCost()} Gold)`, 
      {
        fontFamily: 'Arial',
        fontSize: UI_CONFIG.fontSize.medium,
        color: canUpgrade ? UI_CONFIG.colors.highlight : '#666666'
      }
    );
    this.upgradeButton.setOrigin(0.5);
    
    if (canUpgrade) {
      this.upgradeButton.setInteractive({ useHandCursor: true });
      this.upgradeButton.on('pointerdown', this.upgradeTower, this);
      this.upgradeButton.on('pointerover', () => this.upgradeButton.setColor(UI_CONFIG.colors.primary));
      this.upgradeButton.on('pointerout', () => this.upgradeButton.setColor(UI_CONFIG.colors.highlight));
    }
    
    // Create sell button
    const sellValue = Math.floor(TOWER_TYPES[this.selectedTower.type].cost * 0.7); // 70% refund
    this.sellButton = this.add.text(
      0, 
      100, 
      `SELL (${sellValue} Gold)`, 
      {
        fontFamily: 'Arial',
        fontSize: UI_CONFIG.fontSize.medium,
        color: UI_CONFIG.colors.highlight
      }
    );
    this.sellButton.setOrigin(0.5);
    this.sellButton.setInteractive({ useHandCursor: true });
    this.sellButton.on('pointerdown', this.sellTower, this);
    this.sellButton.on('pointerover', () => this.sellButton.setColor(UI_CONFIG.colors.primary));
    this.sellButton.on('pointerout', () => this.sellButton.setColor(UI_CONFIG.colors.highlight));
    
    // Create close button
    this.closeButton = this.add.text(
      panelWidth / 2 - 20, 
      -panelHeight / 2 + 20, 
      'X', 
      {
        fontFamily: 'Arial',
        fontSize: UI_CONFIG.fontSize.large,
        color: UI_CONFIG.colors.highlight
      }
    );
    this.closeButton.setOrigin(0.5);
    this.closeButton.setInteractive({ useHandCursor: true });
    this.closeButton.on('pointerdown', this.closeUpgradePanel, this);
    this.closeButton.on('pointerover', () => this.closeButton.setColor(UI_CONFIG.colors.primary));
    this.closeButton.on('pointerout', () => this.closeButton.setColor(UI_CONFIG.colors.highlight));
    
    // Add all elements to the panel container
    this.panel = this.add.container(panelX, panelY, [
      panelBg,
      titleText,
      towerImage,
      this.statsText,
      this.upgradeButton,
      this.sellButton,
      this.closeButton
    ]);
    
    // Add a subtle appear animation
    this.panel.setScale(0.9);
    this.tweens.add({
      targets: this.panel,
      scale: 1,
      duration: 200,
      ease: 'Back.easeOut'
    });
  }
  
  private getTowerStatsText(): string {
    if (!this.selectedTower) return '';
    
    return [
      `Damage: ${this.selectedTower.damage}`,
      `Range: ${this.selectedTower.range}`,
      `Attack Speed: ${this.selectedTower.attackSpeed?.toFixed(1) || "0.0"}/sec`,
      `Kills: 0` // TODO: Track kills in Tower class
    ].join('\n');
  }
  
  private getUpgradeStats(): string {
    if (!this.selectedTower) return '';
    
    const nextLevel = this.selectedTower.upgradeLevel + 1;
    const towerType = this.selectedTower.type;
    const towerTypeConfig = TOWER_TYPES[towerType];
    const upgrades = towerTypeConfig.upgrades as UpgradesMap | undefined;
    
    if (!upgrades || !upgrades[nextLevel]) {
      return 'MAX LEVEL REACHED';
    }
    
    const upgradeConfig = upgrades[nextLevel];
    
    const currentDamage = this.selectedTower.damage;
    const currentRange = this.selectedTower.range;
    const currentSpeed = this.selectedTower.attackSpeed || 0;
    
    const newDamage = upgradeConfig.damage || currentDamage;
    const newRange = upgradeConfig.range || currentRange;
    const newSpeed = upgradeConfig.attackSpeed || currentSpeed;
    
    return [
      `Damage: ${currentDamage} → ${newDamage}`,
      `Range: ${currentRange} → ${newRange}`,
      `Attack Speed: ${currentSpeed.toFixed(1)} → ${newSpeed.toFixed(1)}/sec`
    ].join('\n');
  }
  
  private canUpgradeTower(): boolean {
    if (!this.selectedTower || !this.playerManager) return false;
    
    const nextLevel = this.selectedTower.upgradeLevel + 1;
    const towerType = this.selectedTower.type;
    const towerTypeConfig = TOWER_TYPES[towerType];
    const upgrades = towerTypeConfig.upgrades as UpgradesMap | undefined;
    
    if (!upgrades || !upgrades[nextLevel]) {
      return false; // Max level reached
    }
    
    const cost = upgrades[nextLevel].cost || 0;
    return this.playerManager.gold >= cost;
  }
  
  private getUpgradeCost(): number {
    if (!this.selectedTower) return 0;
    
    const nextLevel = this.selectedTower.upgradeLevel + 1;
    const towerType = this.selectedTower.type;
    const towerTypeConfig = TOWER_TYPES[towerType];
    const upgrades = towerTypeConfig.upgrades as UpgradesMap | undefined;
    
    if (!upgrades || !upgrades[nextLevel]) {
      return 0; // Max level reached
    }
    
    return upgrades[nextLevel].cost || 0;
  }
  
  private upgradeTower(): void {
    if (!this.selectedTower || !this.playerManager) return;
    
    const cost = this.getUpgradeCost();
    
    if (this.playerManager.gold >= cost) {
      // Deduct gold
      this.playerManager.gold -= cost;
      
      // Upgrade the tower
      this.selectedTower.upgrade();
      
      // Update the stats display
      this.statsText.setText(this.getTowerStatsText());
      
      // Update the upgrade button
      const canUpgrade = this.canUpgradeTower();
      this.upgradeButton.setText(`UPGRADE (${this.getUpgradeCost()} Gold)`);
      
      if (!canUpgrade) {
        this.upgradeButton.setColor('#666666');
        this.upgradeButton.disableInteractive();
      }
      
      // Emit tower upgraded event
      this.events.emit('towerUpgraded', this.selectedTower);
    }
  }
  
  private sellTower(): void {
    if (!this.selectedTower || !this.playerManager) return;
    
    // Calculate sell value (70% of tower cost)
    const sellValue = Math.floor(TOWER_TYPES[this.selectedTower.type].cost * 0.7);
    
    // Add gold to player
    this.playerManager.gold += sellValue;
    
    // Emit sell tower event
    this.events.emit('towerSold', this.selectedTower);
    
    // Close the upgrade panel
    this.closeUpgradePanel();
  }
  
  private closeUpgradePanel(): void {
    // Hide tower range indicator
    if (this.selectedTower) {
      this.selectedTower.hideRangeIndicator();
    }
    
    // Animate panel disappearing
    this.tweens.add({
      targets: this.panel,
      scale: 0.9,
      alpha: 0,
      duration: 200,
      ease: 'Back.easeIn',
      onComplete: () => {
        // Stop this scene
        this.scene.stop();
        // Resume game scene if it's paused
        if (this.scene.isPaused('game')) {
          this.scene.resume('game');
        }
      }
    });
  }
  
  public shutdown(): void {
    // Clean up any listeners
    const keyboard = this.input.keyboard;
    if (keyboard) {
      keyboard.off('keydown-ESC', this.closeUpgradePanel, this);
    }
    
    // Ensure tower range is hidden
    if (this.selectedTower) {
      this.selectedTower.hideRangeIndicator();
    }
  }
} 