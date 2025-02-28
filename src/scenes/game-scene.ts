import Phaser from "phaser";
import Player from "../entities/player/player";
import Base from "../entities/base/base";
import HUD from "../ui/hud";
import GameState from "../utils/game-state";
import Tower from "../entities/tower/tower";
import { GAME_SETTINGS, TowerType, DifficultyLevel } from "../settings";
import TileMapManager from "../managers/tile-map-manager";
import ItemDropManager from "../managers/item-drop-manager";
import { GameItem } from "../types/item";
import InventoryUI from "../ui/inventory-ui";
import CameraController from "../utils/camera-controller";
import { BaseScene } from "./base-scene";
import { EventBus } from "../core/event-bus";
import { InputManager } from "../managers/input-manger";
import { EnemyType } from "../entities/enemy/enemy-type";
import BuildSystem from "../systems/build-system";
import RoundSystem from "../systems/round-system";
import EntityManager from "../managers/entity-manager";
import TowerManager from "../managers/tower-manager";
import CombatSystem from "../systems/combat-system";
import GameCoordinator from "../core/game-coordinator";
import UIManager from "../managers/ui-manager";
import { GameStateEnum } from "../utils/game-state";
import Enemy from "../entities/enemy/enemy";

// Remove constant for debug settings
const DEFAULT_DROP_CHANCE = 0.3; // Default item drop chance

type SceneInitData = {
    isNewGame: boolean;
};

export default class GameScene extends BaseScene {
    private gameState!: GameState;
    private hud!: HUD;
    private debugMode: boolean = false;
    private difficultyLevel: DifficultyLevel = DifficultyLevel.Medium;
    private tileMapManager!: TileMapManager;
    private itemDropManager!: ItemDropManager;
    private inventoryUI!: InventoryUI;
    private isInventoryVisible: boolean = false;
    private cameraController!: CameraController;
    public eventBus = new EventBus();
    private inputManager: InputManager;
    private debugGraphics!: Phaser.GameObjects.Graphics;
    private debugSettings = GAME_SETTINGS.debug;
    private debugText!: Phaser.GameObjects.Text;
    private physicsDebugGraphic!: Phaser.GameObjects.Graphics;

    // Managers
    private buildController!: BuildSystem;
    private roundManager!: RoundSystem;
    private entityManager!: EntityManager;
    private towerManager!: TowerManager;
    private combatSystem!: CombatSystem;
    
    // New coordinator
    private gameCoordinator!: GameCoordinator;
    private uiManager!: UIManager;

    // New UI manager
    constructor() {
        super({ key: "GameScene" });
        this.inputManager = new InputManager(this, {
            pause: "P",
            inventory: "I",
            debug: "F3"
        });
    }

    preload() {
        this.loadAssets();
    }

    init(data: SceneInitData) {
        // Initialize event bus first
        this.eventBus = new EventBus();
        
        // Initialize game state with event bus
        this.gameState = new GameState(this.eventBus);
        
        // Load saved state if this isn't a new game
        if (data && !data.isNewGame) {
            this.gameState.loadFromLocalStorage();
        }
        
        // Set difficulty level
        if (data && data.isNewGame) {
            this.difficultyLevel = DifficultyLevel.Medium;
        }
        
        // Don't emit 'start-game' here - we'll properly initialize the game in create()
    }

    create() {
        this.setupPhysics();
        this.setupCamera();

        this.debugText = this.add.text(10, 10, '', { fontSize: '16px', color: '#ffffff' });
        this.physicsDebugGraphic = this.physics.world.createDebugGraphic();
        this.physicsDebugGraphic.setVisible(false);
        this.debugGraphics = this.add.graphics();

        console.log('[GameScene] Scene created, available textures:', this.textures.getTextureKeys());

        // Initialize tile map
        this.tileMapManager = new TileMapManager(this);

        // Place decorative tiles
        this.placeDecorativeTiles();

        // Initialize managers and systems with dependency injection
        this.entityManager = new EntityManager(
            this, 
            this.tileMapManager, 
            this.eventBus, 
            this.gameState
        );

        // Initialize other managers with dependencies
        this.itemDropManager = new ItemDropManager(this, this.tileMapManager, this.eventBus);
        
        // Initialize systems with dependencies
        this.combatSystem = new CombatSystem(
            this,
            this.entityManager,
            this.eventBus
        );

        // Set combat system in entity manager
        this.entityManager.setCombatSystem(this.combatSystem);
        
        // Set item drop manager in entity manager
        this.entityManager.setItemDropManager(this.itemDropManager);
        
        // Complete entity manager initialization now that dependencies are set
        this.entityManager.completeInitialization();
        
        // NOW set up camera to follow player AFTER player is created
        this.cameras.main.startFollow(this.entityManager.getUser());
        this.cameraController = new CameraController(this, this.entityManager.getUser());
        
        // Get the player's inventory manager AFTER player is created
        const playerInventory = this.entityManager.getUser().getInventory() as any;
        this.inventoryUI = new InventoryUI(this, playerInventory);
        this.inventoryUI.hide();
        this.hud = new HUD(this);

        this.towerManager = new TowerManager(
            this,
            this.entityManager,
            this.eventBus,
            this.gameState
        );

        this.buildController = new BuildSystem(
            this,
            this.tileMapManager,
            this.gameState,
            this.eventBus,
            this.entityManager,
            this.combatSystem
        );

        this.roundManager = new RoundSystem(
            this,
            this.entityManager,
            this.eventBus,
            this.gameState
        );
        
        // Initialize UI manager with dependencies
        this.uiManager = new UIManager(
            this,
            this.entityManager,
            this.eventBus
        );
        
        // Initialize game coordinator with all dependencies
        this.gameCoordinator = new GameCoordinator(
            this,
            this.entityManager,
            this.roundManager,
            this.buildController,
            this.towerManager,
            this.combatSystem,
            this.itemDropManager,
            this.gameState,
            this.eventBus,
            this.tileMapManager,
            this.uiManager
        );
        
        // Register input handlers
        this.setupInputHandlers();
        
        // Initialize input actions
        this.inputManager.onAction("pause", () => this.togglePause());
        this.inputManager.onAction("inventory", () => this.gameCoordinator.getUIManager().toggleInventoryUI());
        this.inputManager.onAction("debug", () => this.toggleDebugMode());
        
        // Setup event handler for enemy kills
        this.eventBus.on('enemy-killed', (x: number, y: number) => {
            if (Math.random() < GAME_SETTINGS.itemDropChance) {
                this.itemDropManager.dropRandomItem(x, y);
            }
        });

        this.applyResearchEffects();

        // Properly initialize the game state
        this.gameCoordinator.getGameStateManager().startNewGame();
        
        // Now that everything is set up, emit 'start-game'
        this.game.events.emit('start-game');
    }

    private applyResearchEffects() {
        const researchTree = this.hud.getResearchTree();
        const towerDamageLevel = researchTree.getResearchLevel('tower-damage-1');
        if (towerDamageLevel > 0) {
            console.log(`Applying tower damage research level: ${towerDamageLevel}`);
        }
    }

    private placeDecorativeTiles() {
        for (let i = 0; i < GAME_SETTINGS.map.decorationCount; i++) {
            const decorType = Phaser.Math.RND.pick(['bush', 'tree', 'rock']);
            const decorSize = decorType === 'tree' ? 2 : 1;

            const position = this.tileMapManager.findValidPlacement(decorSize, decorSize);
            if (position) {
                const worldPos = this.tileMapManager.tileToWorld(position.tileX, position.tileY);

                this.add.image(worldPos.x, worldPos.y, decorType);

                this.tileMapManager.occupyTiles(
                    position.tileX, position.tileY,
                    decorSize, decorSize,
                    'decoration', `decor_${i}`
                );
            }
        }
    }

    private setupInputHandlers(): void {
        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            // Skip processing if we're in inventory mode
            if (this.gameState.isInventoryOpen) {
                return;
            }
            
            // Handle build mode placement
            if (this.buildController.isBuildMode()) {
                if (pointer.leftButtonDown()) {
                    this.buildController.handlePlacement(pointer.worldX, pointer.worldY);
                }
                return;
            }

            // If not in build mode, check if we clicked on a tower
            const worldPoint = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
            const clickedTower = this.towerManager.findTowerAt(worldPoint.x, worldPoint.y);
            if (clickedTower) {
                this.towerManager.selectTower(clickedTower);
            } else {
                this.towerManager.deselectTower();
                
                // Note: We don't need to handle shooting here since the Player.update() 
                // handles shooting toward mouse on pointer down
            }
        });
        
        // Add mouse move handler to update aim direction constantly
        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            // No specific handling needed here, as the player update will get the position
            // Just emit an event in case we want to react elsewhere
            this.eventBus.emit('pointer-moved', {
                x: pointer.worldX,
                y: pointer.worldY
            });
        });
    }

    // Getter methods for managers and systems
    public getTileMapManager(): TileMapManager {
        return this.tileMapManager;
    }

    public getEntityManager(): EntityManager {
        return this.entityManager;
    }

    public getRoundManager(): RoundSystem {
        return this.roundManager;
    }

    public getBuildController(): BuildSystem {
        return this.buildController;
    }

    public getTowerManager(): TowerManager {
        return this.towerManager;
    }

    public getCombatSystem(): CombatSystem {
        return this.combatSystem;
    }

    public getGameCoordinator(): GameCoordinator {
        return this.gameCoordinator;
    }

    // Delegated methods to maintain compatibility
    public enterBuildMode(towerType: TowerType): void {
        this.buildController.enterBuildMode(towerType);
    }

    public exitBuildMode(): void {
        this.buildController.exitBuildMode();
    }

    public isBuildMode(): boolean {
        return this.buildController.isBuildMode();
    }

    public getBase(): Base {
        return this.entityManager.getBase();
    }

    public getUser(): Player {
        return this.entityManager.getUser();
    }

    public getCurrentRound(): number {
        return this.roundManager.getCurrentRound();
    }

    public getEnemies(): Phaser.Physics.Arcade.Sprite[] {
        return this.entityManager.getEnemies();
    }

    public getGameState() {
        return this.gameState;
    }

    public gameOver() {
        this.entityManager.gameOver();
    }

    public removeTower(tower: Tower) {
        this.entityManager.removeTower(tower);
    }

    public forceEnemyUpdate() {
        this.entityManager.updateEnemies();
    }

    public selectTower(tower: Tower) {
        this.towerManager.selectTower(tower);
    }

    public deselectTower() {
        this.towerManager.deselectTower();
    }

    public getSelectedTower(): Tower | null {
        return this.towerManager.getSelectedTower();
    }

    public setDifficulty(level: DifficultyLevel) {
        this.difficultyLevel = level;
        if (this.gameCoordinator) {
            this.gameCoordinator.setDifficulty(level);
        }
    }

    public getDifficultyLevel(): DifficultyLevel {
        return this.difficultyLevel;
    }

    public getItemDropManager(): ItemDropManager {
        return this.itemDropManager;
    }

    public toggleInventoryUI(): void {
        this.isInventoryVisible = !this.isInventoryVisible;
        
        this.gameState.setInventoryOpen(this.isInventoryVisible);
        
        if (this.isInventoryVisible) {
            this.inventoryUI.show();
            
            const dimBackground = this.add.rectangle(
                0, 0, 
                this.cameras.main.width * 2, 
                this.cameras.main.height * 2, 
                0x000000, 0.5
            ).setOrigin(0).setDepth(90);
            
            this.inventoryUI.setBackground(dimBackground);
            
            this.eventBus.emit('inventory-opened');
        } else {
            this.inventoryUI.hide();
            
            this.eventBus.emit('inventory-closed');
        }
    }

    public addItemToInventory(item: GameItem): boolean {
        return this.getUser().getInventory().addItem(item);
    }

    private togglePause(): void {
        if (this.gameCoordinator) {
            if (this.gameState.isInState(GameStateEnum.PAUSED)) {
                this.gameCoordinator.resumeGame();
            } else {
                this.gameCoordinator.pauseGame();
            }
        }
    }

    public toggleDebugMode() {
        this.debugMode = !this.debugMode;

        if (this.debugGraphics) {
            this.debugGraphics.clear();
        }

        // Toggle physics debug visibility
        if (this.physicsDebugGraphic) {
            this.physicsDebugGraphic.setVisible(this.debugMode && this.debugSettings.showPhysics);
        }

        if (this.debugMode) {
            // Count active enemies and report
            const activeEnemies = this.entityManager.getEnemies().length;
            console.log(`Debug mode enabled - Active enemies: ${activeEnemies}`);
            
            // Report on all physics bodies
            const bodies = this.physics.world.bodies.entries;
            console.log(`Total physics bodies: ${bodies.length}`);
            
            // Log some info about each body type
            let enemyBodies = 0;
            let projectileBodies = 0;
            let otherBodies = 0;
            
            bodies.forEach(body => {
                const gameObject = body.gameObject;
                if (gameObject instanceof Enemy) {
                    enemyBodies++;
                } else if (gameObject && gameObject.getData && gameObject.getData('type') === 'projectile') {
                    projectileBodies++;
                } else {
                    otherBodies++;
                }
            });
            
            console.log(`Body types - Enemies: ${enemyBodies}, Projectiles: ${projectileBodies}, Other: ${otherBodies}`);
            
            // Add a debug button to force refresh collision detection
            const refreshButton = this.add.text(
                this.cameras.main.width - 200,
                10,
                'Refresh Collisions',
                { 
                    backgroundColor: '#333',
                    padding: { left: 10, right: 10, top: 5, bottom: 5 },
                    color: '#fff'
                }
            ).setOrigin(0, 0).setScrollFactor(0).setDepth(1000).setName('refresh-collisions-button');
            
            refreshButton.setInteractive({ useHandCursor: true });
            refreshButton.on('pointerdown', () => {
                console.log("Manual collision refresh triggered");
                this.combatSystem.recreateColliders();
            });
            
            this.showDebugInfo();
        } else {
            console.log("Debug mode disabled");
            
            // Remove debug button if it exists
            const oldButton = this.children.getByName('refresh-collisions-button');
            if (oldButton) {
                oldButton.destroy();
            }
        }
    }

    private showDebugInfo() {
        if (!this.debugMode || !this.debugSettings.enabled || !this.debugGraphics) return;

        this.debugGraphics.clear();

        // Draw base range
        this.debugGraphics.lineStyle(2, 0x00ff00, 0.5);
        this.debugGraphics.strokeCircle(this.entityManager.getBase().x, this.entityManager.getBase().y, 200);

        // Draw enemy paths if enabled
        if (this.debugSettings.showPaths) {
            this.entityManager.getEnemies().forEach((enemy) => {
                const target = enemy.getData('target') as Phaser.Physics.Arcade.Sprite;
                if (!target) return;

                this.debugGraphics.lineStyle(2, 0xff0000, 0.5);
                this.debugGraphics.lineBetween(enemy.x, enemy.y, target.x, target.y);
                
                // Draw enemy hitbox
                this.debugGraphics.lineStyle(1, 0xff8800, 0.8);
                if (enemy.body) {
                    const body = enemy.body as Phaser.Physics.Arcade.Body;
                    this.debugGraphics.strokeRect(
                        body.x, body.y, body.width, body.height
                    );
                }
            });
        }

        // Draw tower ranges if enabled
        if (this.debugSettings.showRanges && this.entityManager.getTowers()) {
            this.entityManager.getTowers()?.getChildren().forEach((obj) => {
                const tower = obj as Tower;
                if (!tower.active) return;

                this.debugGraphics.lineStyle(2, 0x0000ff, 0.3);
                this.debugGraphics.strokeCircle(tower.x, tower.y, tower.getCurrentRange());
            });
        }
        
        // Draw projectile paths
        const projectiles = this.entityManager.getProjectiles();
        if (projectiles) {
            projectiles.getChildren().forEach((proj) => {
                const projectile = proj as Phaser.Physics.Arcade.Sprite;
                if (!projectile.active) return;
                
                // Draw projectile hitbox
                this.debugGraphics.lineStyle(1, 0xffff00, 0.8);
                if (projectile.body) {
                    const body = projectile.body as Phaser.Physics.Arcade.Body;
                    this.debugGraphics.strokeRect(
                        body.x, body.y, body.width, body.height
                    );
                }
            });
        }
    }

    update() {
        // Update via game coordinator
        if (this.gameCoordinator) {
            this.gameCoordinator.update();
        }
        
        // Update other systems not yet integrated with coordinator
        if (this.itemDropManager) this.itemDropManager.update();
        
        this.inputManager.update();
        this.cameraController.update();

        if (this.debugMode && this.debugSettings.enabled) {
            let debugInfo = '';
            if (this.debugSettings.showFPS) debugInfo += `FPS: ${Math.round(this.game.loop.actualFps)}\n`;
            if (this.debugSettings.showInput) {
                const pointer = this.input.activePointer;
                debugInfo += `Mouse: ${pointer.x.toFixed(0)}, ${pointer.y.toFixed(0)}\n`;
            }
            this.debugText.setText(debugInfo);
            this.showDebugInfo();
        } else {
            this.debugText.setText('');
        }
    }

    // Remaining methods for compatibility
    public startRound(): void {
        this.roundManager.startRound();
    }

    public startNextRound(): void {
        this.roundManager.startNextRound();
    }

    public getInventory(): any[] {
        const inventory = this.getUser().getInventory() as any;
        return inventory.getInventory().filter((slot: any): slot is any => slot !== null);
    }

    public equipItem(item: GameItem): void {
        this.getUser().equipItem(item);
        this.eventBus.emit('update-inventory');
        this.hud.updatePlayerStats();
    }

    public unequipItem(slot: string): void {
        // Implementation depends on your inventory system
        this.eventBus.emit('update-inventory');
        this.hud.updatePlayerStats();
    }

    public getHUD(): HUD {
        return this.hud;
    }

    public getDifficulty(): string {
        return this.difficultyLevel.toString();
    }

    public createProjectile(x: number, y: number, texture: string): Phaser.Physics.Arcade.Sprite {
        return this.entityManager.createProjectile(x, y, texture);
    }

    public shootProjectile(
        source: Phaser.Physics.Arcade.Sprite,
        targetX: number,
        targetY: number,
        damage: number,
        projectileType: string = 'normal'
    ): void {
        this.combatSystem.shootProjectile(source, targetX, targetY, damage, projectileType);
    }

    public spawnEnemyPublic(enemyType: EnemyType): void {
        this.entityManager.spawnEnemy(enemyType);
    }

    public showMessage(text: string, color: number = 0xffffff, fontSize: string = '32px'): void {
        const message = this.add.text(
            this.cameras.main.worldView.centerX,
            this.cameras.main.worldView.centerY - 50,
            text,
            {
                fontSize,
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 6,
                align: 'center'
            }
        ).setOrigin(0.5);

        message.setTint(color);

        this.tweens.add({
            targets: message,
            alpha: 0,
            y: message.y - 100,
            duration: 1000,
            onComplete: () => message.destroy()
        });
    }

    public showPickupMessage(message: string): void {
        const messageText = this.add.text(
            this.cameras.main.width / 2, 
            this.cameras.main.height - 100, 
            message, 
            { 
                fontSize: '20px', 
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 3,
                shadow: { color: '#000', fill: true, offsetX: 2, offsetY: 2, blur: 4 }
            }
        ).setOrigin(0.5).setDepth(100);
        
        this.tweens.add({
            targets: messageText,
            y: this.cameras.main.height - 150,
            alpha: 0,
            duration: 2000,
            ease: 'Power2',
            onComplete: () => messageText.destroy()
        });
    }

    public getEnemiesGroup(): Phaser.Physics.Arcade.Group | undefined {
        return this.entityManager.getEnemiesGroup();
    }

    public getTowers(): Phaser.Physics.Arcade.Group | undefined {
        return this.entityManager.getTowers();
    }

    // Add this new method for toggling game states
    public changeGameState(state: GameStateEnum): void {
        if (this.gameCoordinator) {
            const stateManager = this.gameCoordinator.getGameStateManager();
            if (state === GameStateEnum.BUILD_PHASE) {
                stateManager.startNewGame();
            } else if (state === GameStateEnum.MENU) {
                stateManager.returnToMenu();
            } else if (state === GameStateEnum.GAME_OVER) {
                stateManager.gameOver();
            } else {
                // For other states, try direct transition
                this.gameState.transition(state);
            }
        }
    }
}