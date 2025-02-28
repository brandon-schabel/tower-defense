import Phaser from "phaser";
import Player from "../entities/player";
import Base from "../entities/base";
import HUD from "../ui/hud";
import GameState from "../utils/game-state";
import Tower from "../entities/tower";
import { GAME_SETTINGS, TowerType } from "../settings";
import { DifficultyLevel } from "../settings";
import TileMapManager from "../managers/tile-map-manager";
import ItemDropManager from "../managers/item-drop-manager";
import { GameItem } from "../types/item";
import InventoryUI from "../ui/inventory-ui";
import CameraController from "../utils/camera-controller";
import { BaseScene } from "./base-scene";
import { EventBus } from "../utils/event-bus";
import { InputManager } from "../managers/input-manger";
import { EnemyType } from "../types/enemy-type";
import { gameConfig } from "../utils/app-config";
import BuildController from "../managers/build-controller";
import RoundManager from "../managers/round-manager";
import EntityManager from "../managers/entity-manager";
import TowerManager from "../managers/tower-manager";
import CombatSystem from "../systems/combat-system";
import ServiceLocator from "../utils/service-locator";
import GameCoordinator from "../coordinators/game-coordinator";

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
    private buildController!: BuildController;
    private roundManager!: RoundManager;
    private entityManager!: EntityManager;
    private towerManager!: TowerManager;
    private combatSystem!: CombatSystem;
    
    // New coordinator
    private gameCoordinator!: GameCoordinator;

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
        // Clear service locator to avoid stale references
        ServiceLocator.getInstance().clear();
        
        // Initialize game state
        this.gameState = new GameState();
        
        // Set difficulty level
        if (data && data.isNewGame) {
            this.difficultyLevel = DifficultyLevel.Medium;
        }
        
        this.game.events.emit('start-game');
    }

    create() {
        // Register this scene with service locator
        ServiceLocator.getInstance().register('gameScene', this);
        ServiceLocator.getInstance().register('gameState', this.gameState);
        
        this.setupPhysics();
        this.setupCamera();

        this.debugText = this.add.text(10, 10, '', { fontSize: '16px', color: '#ffffff' });
        this.physicsDebugGraphic = this.physics.world.createDebugGraphic();
        this.physicsDebugGraphic.setVisible(false);
        this.debugGraphics = this.add.graphics();

        console.log('[GameScene] Scene created, available textures:', this.textures.getTextureKeys());

        // Load configurations
        Object.entries(GAME_SETTINGS).forEach(([key, value]) => {
            gameConfig.loadConfig(key as keyof typeof GAME_SETTINGS, value);
        });

        // Initialize tile map
        this.tileMapManager = new TileMapManager(this);
        ServiceLocator.getInstance().register('tileMapManager', this.tileMapManager);

        // Place decorative tiles
        this.placeDecorativeTiles();

        // Initialize Entity Manager
        this.entityManager = new EntityManager(this);
        ServiceLocator.getInstance().register('entityManager', this.entityManager);

        // Set up camera to follow player
        this.cameras.main.startFollow(this.entityManager.getUser());
        this.cameraController = new CameraController(this, this.entityManager.getUser());

        // Initialize other managers
        this.itemDropManager = new ItemDropManager(this, this.tileMapManager);
        this.inventoryUI = new InventoryUI(this, this.entityManager.getUser().getInventory());
        this.inventoryUI.hide();
        this.hud = new HUD(this);

        this.buildController = new BuildController(this);
        this.roundManager = new RoundManager(this);
        this.towerManager = new TowerManager(this);
        this.combatSystem = new CombatSystem(this);
        
        // Register all managers with service locator
        // Note: Most managers self-register in their constructors now
        ServiceLocator.getInstance().register('eventBus', this.eventBus);
        
        // Initialize game coordinator after all managers
        this.gameCoordinator = new GameCoordinator(this);
        
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
            if (this.buildController.isBuildMode()) {
                if (pointer.leftButtonDown()) {
                    this.buildController.handlePlacement(pointer.worldX, pointer.worldY);
                }
                return;
            }

            const worldPoint = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
            const clickedTower = this.towerManager.findTowerAt(worldPoint.x, worldPoint.y);
            if (clickedTower) this.towerManager.selectTower(clickedTower);
            else this.towerManager.deselectTower();
        });
    }

    // Getter methods for managers and systems
    public getTileMapManager(): TileMapManager {
        return this.tileMapManager;
    }

    public getEntityManager(): EntityManager {
        return this.entityManager;
    }

    public getRoundManager(): RoundManager {
        return this.roundManager;
    }

    public getBuildController(): BuildController {
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

        if (this.isInventoryVisible) {
            this.inventoryUI.show();
        } else {
            this.inventoryUI.hide();
        }
    }

    public addItemToInventory(item: GameItem): boolean {
        return this.getUser().getInventory().addItem(item);
    }

    private togglePause(): void {
        if (this.scene.isPaused()) {
            this.scene.resume();
        } else {
            this.scene.pause();
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
            this.showDebugInfo();
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
        return this.getUser().getInventory().getInventory().filter((slot): slot is any => slot !== null);
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
        const text = this.add.text(
            this.cameras.main.worldView.centerX,
            this.cameras.main.worldView.centerY - 50,
            message,
            { fontSize: '24px', color: '#ffffff' }
        ).setOrigin(0.5);

        this.tweens.add({
            targets: text,
            alpha: 0,
            y: text.y - 50,
            duration: 1000,
            onComplete: () => text.destroy()
        });
    }

    public getEnemiesGroup(): Phaser.Physics.Arcade.Group | undefined {
        return this.entityManager.getEnemiesGroup();
    }

    public getTowers(): Phaser.Physics.Arcade.Group | undefined {
        return this.entityManager.getTowers();
    }
}