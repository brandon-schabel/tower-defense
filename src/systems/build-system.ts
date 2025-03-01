import Phaser from 'phaser';
import { GameScene } from '../scenes/game-scene';
import { GAME_SETTINGS, TowerType } from '../settings';
import { Tower } from '../entities/tower/tower';
import { TileMapManager } from '../managers/tile-map-manager';
import { GameState } from '../utils/game-state';
import { EventBus } from '../core/event-bus';
import { EntityManager } from '../managers/entity-manager';
import { CollisionSystem }  from '../systems/collision-system';

export class BuildSystem {
    private scene: GameScene;
    private isBuildModeActive: boolean = false;
    private ghostTower: Phaser.GameObjects.Sprite | null = null;
    private selectedTowerType: TowerType | null = null;
    private pointerMoveHandler: ((pointer: Phaser.Input.Pointer) => void) | null = null;
    private rightPointerHandler: ((pointer: Phaser.Input.Pointer) => void) | null = null;
    private escKeyHandler: (() => void) | null = null;
    private tileMapManager: TileMapManager;
    private gameState: GameState;
    private eventBus: EventBus;
    private entityManager: EntityManager;
    private combatSystem: CollisionSystem;

    constructor(
        scene: GameScene,
        tileMapManager: TileMapManager,
        gameState: GameState,
        eventBus: EventBus,
        entityManager: EntityManager,
        combatSystem: CollisionSystem
    ) {
        this.scene = scene;
        this.tileMapManager = tileMapManager;
        this.gameState = gameState;
        this.eventBus = eventBus;
        this.entityManager = entityManager;
        this.combatSystem = combatSystem;
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

        if (!this.gameState.canAfford(towerData.price)) {
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
                const tilePos = this.tileMapManager.worldToTile(pointer.worldX, pointer.worldY);
                const worldPos = this.tileMapManager.tileToWorld(tilePos.tileX, tilePos.tileY);

                this.ghostTower.setPosition(worldPos.x, worldPos.y);
                const rangeCircle = this.ghostTower.getData('rangeCircle') as Phaser.GameObjects.Graphics;
                rangeCircle.setPosition(worldPos.x, worldPos.y);

                // Update grid indicator
                const gridIndicator = this.ghostTower.getData('gridIndicator') as Phaser.GameObjects.Graphics;
                gridIndicator.clear();
                gridIndicator.lineStyle(2, 0xffffff, 0.3);

                // Get tower size
                const towerWidth = towerData.size.width;
                const towerHeight = towerData.size.height;
                const tileSize = this.tileMapManager.getTileSize();

                // Check if placement is valid
                const isValid = this.tileMapManager.isTileAvailable(
                    tilePos.tileX, tilePos.tileY,
                    towerWidth, towerHeight
                );

                // Draw grid outline
                const color = isValid ? 0x00ff00 : 0xff0000;
                gridIndicator.lineStyle(2, color, 0.5);
                gridIndicator.strokeRect(
                    worldPos.x - (towerWidth * tileSize) / 2,
                    worldPos.y - (towerHeight * tileSize) / 2,
                    towerWidth * tileSize,
                    towerHeight * tileSize
                );
            }
        };

        // Set up right-click handler to exit build mode
        this.rightPointerHandler = (pointer: Phaser.Input.Pointer) => {
            if (pointer.rightButtonDown()) {
                this.exitBuildMode();
            }
        };

        // Set up ESC key handler
        this.escKeyHandler = () => {
            this.exitBuildMode();
        };

        // Register handlers
        this.scene.input.on('pointermove', this.pointerMoveHandler);
        this.scene.input.on('pointerdown', this.rightPointerHandler);
        this.scene.input.keyboard?.on('keydown-ESC', this.escKeyHandler);

        // Emit event for UI updates
        this.eventBus.emit('build-mode-entered', towerType);
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

        // Emit event for UI updates
        this.eventBus.emit('build-mode-exited');
    }

    /**
     * Handle tower placement
     */
    public handlePlacement(x: number, y: number): void {
        if (!this.isBuildModeActive || !this.selectedTowerType) return;

        const towerData = GAME_SETTINGS.towers[this.selectedTowerType];
        if (!towerData) return;

        const tilePos = this.tileMapManager.worldToTile(x, y);
        const towerWidth = towerData.size.width;
        const towerHeight = towerData.size.height;

        // Check if placement is valid
        if (!this.tileMapManager.isTileAvailable(tilePos.tileX, tilePos.tileY, towerWidth, towerHeight)) {
            // Show error message
            const text = this.scene.add.text(
                x, y - 20,
                'Invalid placement!',
                { fontSize: '16px', color: '#ff0000' }
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

        // Check if player can afford the tower
        if (!this.gameState.canAfford(towerData.price)) {
            // Show error message
            const text = this.scene.add.text(
                x, y - 20,
                'Not enough resources!',
                { fontSize: '16px', color: '#ff0000' }
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

        // Spend resources
        this.gameState.spendResources(towerData.price);

        // Create tower
        const tower = this.createTower(tilePos.tileX, tilePos.tileY, this.selectedTowerType);

        // Add to towers group
        const towersGroup = this.entityManager.getTowers();
        if (towersGroup) {
            towersGroup.add(tower);
        }

        // Emit event
        this.eventBus.emit('tower-placed', {
            x: tower.x,
            y: tower.y,
            type: this.selectedTowerType,
            cost: towerData.price
        });

        // Update UI
        this.eventBus.emit('update-resources');

        // Exit build mode
        this.exitBuildMode();
    }

    /**
     * Create a tower at the specified tile position
     */
    private createTower(tileX: number, tileY: number, towerType: TowerType): Tower {
        // Create tower using entity factory
        const tower = new Tower(
            this.scene, 
            tileX, 
            tileY, 
            towerType,
            this.tileMapManager,
            this.eventBus,
            this.entityManager,
            this.combatSystem
        );
        
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