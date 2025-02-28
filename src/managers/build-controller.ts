import Phaser from 'phaser';
import GameScene from '../scenes/game-scene';
import { GAME_SETTINGS, TowerType } from '../settings';
import Tower from '../entities/tower';
import ServiceLocator from '../utils/service-locator';
import TileMapManager from './tile-map-manager';
import GameState from '../utils/game-state';
import TowerManager from './tower-manager';
import UIManager from './ui-manager';

export default class BuildController {
    private scene: GameScene;
    private isBuildModeActive: boolean = false;
    private ghostTower: Phaser.GameObjects.Sprite | null = null;
    private selectedTowerType: TowerType | null = null;
    private pointerMoveHandler: ((pointer: Phaser.Input.Pointer) => void) | null = null;
    private rightPointerHandler: ((pointer: Phaser.Input.Pointer) => void) | null = null;
    private escKeyHandler: (() => void) | null = null;

    constructor(scene: GameScene) {
        this.scene = scene;
        
        // Register with service locator
        ServiceLocator.getInstance().register('buildController', this);
    }

    /**
     * Enter build mode
     */
    public enterBuildMode(towerType: TowerType): void {
        if (this.isBuildModeActive) return;

        const towerData = GAME_SETTINGS.towers[towerType];
        if (!towerData) {
            console.log('Invalid tower type selected');
            this.exitBuildMode();
            return;
        }

        const gameState = ServiceLocator.getInstance().get<GameState>('gameState');
        if (!gameState || !gameState.canAfford(towerData.price)) {
            // Show visual feedback for insufficient resources
            const text = this.scene.add.text(
                this.scene.cameras.main.worldView.centerX,
                this.scene.cameras.main.worldView.centerY - 50,
                'Not enough resources!',
                { fontSize: '24px', color: '#ff0000' }
            ).setOrigin(0.5);

            this.scene.tweens.add({
                targets: text,
                alpha: 0,
                y: text.y - 50,
                duration: 1000,
                onComplete: () => text.destroy()
            });

            this.exitBuildMode();
            return;
        }

        this.isBuildModeActive = true;
        this.selectedTowerType = towerType;

        if (this.ghostTower) {
            this.ghostTower.destroy();
        }

        // Create ghost tower with proper sizing
        this.ghostTower = this.scene.add.sprite(0, 0, towerType)
            .setAlpha(0.5)
            .setScale(towerData.scale);

        // Add a range indicator circle
        const rangeCircle = this.scene.add.graphics();
        rangeCircle.lineStyle(2, 0xffffff, 0.5);
        rangeCircle.strokeCircle(0, 0, towerData.range);
        this.ghostTower.setData('rangeCircle', rangeCircle);

        // Add grid indicator
        const gridIndicator = this.scene.add.graphics();
        this.ghostTower.setData('gridIndicator', gridIndicator);

        // Set up pointer move handler
        this.pointerMoveHandler = (pointer: Phaser.Input.Pointer) => {
            if (this.ghostTower) {
                const tileMapManager = ServiceLocator.getInstance().get<TileMapManager>('tileMapManager');
                if (!tileMapManager) return;
                
                const tilePos = tileMapManager.worldToTile(pointer.worldX, pointer.worldY);
                const worldPos = tileMapManager.tileToWorld(tilePos.tileX, tilePos.tileY);

                this.ghostTower.setPosition(worldPos.x, worldPos.y);
                const rangeCircle = this.ghostTower.getData('rangeCircle') as Phaser.GameObjects.Graphics;
                rangeCircle.setPosition(worldPos.x, worldPos.y);

                // Update grid indicator
                const gridIndicator = this.ghostTower.getData('gridIndicator') as Phaser.GameObjects.Graphics;
                gridIndicator.clear();
                gridIndicator.lineStyle(2, 0xffffff, 0.3);

                const tileSize = tileMapManager.getTileSize();
                const width = towerData.size.width * tileSize;
                const height = towerData.size.height * tileSize;

                // Draw grid
                for (let x = 0; x <= width; x += tileSize) {
                    gridIndicator.lineBetween(
                        worldPos.x - width / 2 + x,
                        worldPos.y - height / 2,
                        worldPos.x - width / 2 + x,
                        worldPos.y + height / 2
                    );
                }
                for (let y = 0; y <= height; y += tileSize) {
                    gridIndicator.lineBetween(
                        worldPos.x - width / 2,
                        worldPos.y - height / 2 + y,
                        worldPos.x + width / 2,
                        worldPos.y - height / 2 + y
                    );
                }

                const isValid = tileMapManager.isTileAvailable(
                    tilePos.tileX, tilePos.tileY,
                    towerData.size.width, towerData.size.height
                );

                // Update visuals based on validity
                this.ghostTower.setTint(isValid ? 0x00ff00 : 0xff0000);
                rangeCircle.setVisible(isValid);
                gridIndicator.setVisible(isValid);

                // Show cost indicator
                if (!this.ghostTower.getData('costText')) {
                    const costText = this.scene.add.text(0, 0, `Cost: ${towerData.price}`, {
                        fontSize: '16px',
                        color: '#ffffff',
                        backgroundColor: '#000000',
                        padding: { x: 4, y: 2 }
                    }).setOrigin(0.5);
                    this.ghostTower.setData('costText', costText);
                }

                const costText = this.ghostTower.getData('costText') as Phaser.GameObjects.Text;
                costText.setPosition(worldPos.x, worldPos.y - height / 2 - 20);
            }
        };

        // Add the pointer move listener
        this.scene.input.on('pointermove', this.pointerMoveHandler);

        // Show build mode instructions
        const instructions = this.scene.add.text(
            this.scene.cameras.main.worldView.centerX,
            50,
            'Left-click to place tower\nRight-click or ESC to cancel',
            {
                fontSize: '20px',
                color: '#ffffff',
                backgroundColor: '#000000',
                padding: { x: 10, y: 5 }
            }
        ).setOrigin(0.5);
        this.ghostTower.setData('instructions', instructions);

        // Setup right-click cancellation
        this.rightPointerHandler = (pointer: Phaser.Input.Pointer) => {
            if (pointer.rightButtonDown()) {
                this.exitBuildMode();
            }
        };
        this.scene.input.on('pointerdown', this.rightPointerHandler);

        // Setup ESC key cancellation
        this.escKeyHandler = () => this.exitBuildMode();
        this.scene.input.keyboard?.addKey('ESC').on('down', this.escKeyHandler);
    }

    /**
     * Exit build mode
     */
    public exitBuildMode(): void {
        this.isBuildModeActive = false;
        this.selectedTowerType = null;

        if (this.ghostTower) {
            const rangeCircle = this.ghostTower.getData('rangeCircle') as Phaser.GameObjects.Graphics;
            if (rangeCircle) {
                rangeCircle.destroy();
            }

            const gridIndicator = this.ghostTower.getData('gridIndicator') as Phaser.GameObjects.Graphics;
            if (gridIndicator) {
                gridIndicator.destroy();
            }

            const costText = this.ghostTower.getData('costText') as Phaser.GameObjects.Text;
            if (costText) {
                costText.destroy();
            }

            const instructions = this.ghostTower.getData('instructions') as Phaser.GameObjects.Text;
            if (instructions) {
                instructions.destroy();
            }

            this.ghostTower.destroy();
            this.ghostTower = null;
        }

        // Remove event listeners
        if (this.pointerMoveHandler) {
            this.scene.input.off('pointermove', this.pointerMoveHandler);
            this.pointerMoveHandler = null;
        }

        if (this.rightPointerHandler) {
            this.scene.input.off('pointerdown', this.rightPointerHandler);
            this.rightPointerHandler = null;
        }

        if (this.escKeyHandler) {
            this.scene.input.keyboard?.removeKey('ESC');
            this.escKeyHandler = null;
        }
    }

    /**
     * Handle tower placement
     */
    public handlePlacement(x: number, y: number): void {
        if (!this.isBuildModeActive || !this.selectedTowerType) return;

        const towerData = GAME_SETTINGS.towers[this.selectedTowerType];
        if (!towerData) {
            console.error(`[BuildController] Failed to get tower data for type: ${this.selectedTowerType}`);
            this.exitBuildMode();
            return;
        }

        const gameState = ServiceLocator.getInstance().get<GameState>('gameState');
        if (!gameState || !gameState.spendResources(towerData.price)) {
            // Show visual feedback for insufficient resources
            const text = this.scene.add.text(
                this.scene.cameras.main.worldView.centerX,
                this.scene.cameras.main.worldView.centerY - 50,
                'Not enough resources!',
                { fontSize: '24px', color: '#ff0000' }
            ).setOrigin(0.5);

            this.scene.tweens.add({
                targets: text,
                alpha: 0,
                y: text.y - 50,
                duration: 1000,
                onComplete: () => text.destroy()
            });

            this.exitBuildMode();
            return;
        }

        const tileMapManager = ServiceLocator.getInstance().get<TileMapManager>('tileMapManager');
        if (!tileMapManager) return;
        
        const tilePos = tileMapManager.worldToTile(x, y);
        const worldPos = tileMapManager.tileToWorld(tilePos.tileX, tilePos.tileY);

        if (!tileMapManager.isTileAvailable(
            tilePos.tileX, tilePos.tileY,
            towerData.size.width, towerData.size.height
        )) {
            // Show visual feedback for invalid placement
            const text = this.scene.add.text(
                worldPos.x,
                worldPos.y - 20,
                'Invalid placement!',
                { fontSize: '20px', color: '#ff0000' }
            ).setOrigin(0.5);

            this.scene.tweens.add({
                targets: text,
                alpha: 0,
                y: text.y - 30,
                duration: 1000,
                onComplete: () => text.destroy()
            });
            return;
        }

        // Create and place the tower
        const tower = this.createTower(tilePos.tileX, tilePos.tileY, this.selectedTowerType);

        // Show placement success effect
        const flash = this.scene.add.graphics();
        flash.lineStyle(2, 0x00ff00, 1);
        flash.strokeCircle(worldPos.x, worldPos.y, towerData.range);

        this.scene.tweens.add({
            targets: flash,
            alpha: 0,
            duration: 500,
            onComplete: () => flash.destroy()
        });

        // Show resources spent
        const costText = this.scene.add.text(
            worldPos.x,
            worldPos.y - 40,
            `-${towerData.price}`,
            { fontSize: '20px', color: '#ff0000' }
        ).setOrigin(0.5);

        this.scene.tweens.add({
            targets: costText,
            alpha: 0,
            y: costText.y - 30,
            duration: 1000,
            onComplete: () => costText.destroy()
        });

        // Update HUD
        const uiManager = ServiceLocator.getInstance().get<UIManager>('uiManager');
        if (uiManager) {
            uiManager.updateResources();
        }
        
        this.exitBuildMode();
    }

    /**
     * Create a new tower
     */
    private createTower(tileX: number, tileY: number, towerType: TowerType): Tower {
        const tower = new Tower(this.scene, tileX, tileY, towerType);
        
        const towerManager = ServiceLocator.getInstance().get<TowerManager>('towerManager');
        if (towerManager) {
            const towers = this.scene.getTowers();
            if (towers) {
                towers.add(tower, true);
            }
        }
        
        return tower;
    }

    /**
     * Check if build mode is active
     */
    public isBuildMode(): boolean {
        return this.isBuildModeActive;
    }

    /**
     * Get the selected tower type
     */
    public getSelectedTowerType(): TowerType | null {
        return this.selectedTowerType;
    }

    /**
     * Clean up resources
     */
    public destroy(): void {
        this.exitBuildMode();
    }
}