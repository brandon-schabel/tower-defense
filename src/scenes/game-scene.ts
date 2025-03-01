import Phaser from "phaser";
import { GAME_SETTINGS } from "../settings";
import { EntityManager } from "../managers/entity-manager";
import { SceneInitializer } from "../utils/scene-initializer";
import { UIManager } from "../managers/ui-manager";
import { InputManager } from "../managers/input-manger";
import { EventBus } from "../core/event-bus";
import { TileMapManager } from "../managers/tile-map-manager";
import { ItemDropManager } from "../managers/item-drop-manager";
import { InventoryManager } from "../managers/inventory-manager";
import { UnifiedEntityFactory } from "../factories/unified-entity-factory";
import { Player } from "../entities/player/player";
import { Base } from "../entities/base/base";
import { GameState } from "../utils/game-state";
import { CollisionSystem } from "../systems/collision-system";

// Forward declarations for managers we don't have direct imports for yet
// You should replace these with actual imports when available
class WaveManager {
    constructor(scene: Phaser.Scene, entityManager: EntityManager, eventBus: EventBus) { }
    update(delta: number) { }
    getCurrentRound(): number { return 0; }
}

class PowerUpManager {
    constructor(scene: Phaser.Scene, entityManager: EntityManager, eventBus: EventBus) { }
}

class SoundManager {
    constructor(scene: Phaser.Scene) { }
}

class EffectManager {
    constructor(scene: Phaser.Scene, entityManager: EntityManager, eventBus: EventBus) { }
    update(delta: number) { }
}

/**
 * The main game scene, responsible for setting up and managing the game world.
 */
export class GameScene extends Phaser.Scene {
    private entityManager!: EntityManager;
    private uiManager!: UIManager;
    private inputManager!: InputManager;
    private eventBus!: EventBus;
    private waveManager!: WaveManager;
    private itemDropManager!: ItemDropManager;
    private powerUpManager!: PowerUpManager;
    private soundManager!: SoundManager;
    private inventoryManager!: InventoryManager;
    private effectManager!: EffectManager;
    private sceneInitializer!: SceneInitializer;
    private entityFactory!: UnifiedEntityFactory;
    private tileMapManager!: TileMapManager;
    private gameState!: GameState;
    private collisionSystem!: CollisionSystem;

    constructor() {
        super({ key: 'GameScene' });
        console.log("[GameScene] Constructor called");
    }

    preload(): void {
        console.log("[GameScene] Preload started");

        // Create loading indicator
        const progressBar = this.add.graphics();
        const progressBox = this.add.graphics();
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);

        const loadingText = this.add.text(width / 2, height / 2 - 50, 'Loading...', {
            font: '20px Arial',
            color: '#ffffff'
        }).setOrigin(0.5, 0.5);

        // Add loading progress handlers
        this.load.on('progress', (value: number) => {
            console.log(`[GameScene] Loading progress: ${Math.floor(value * 100)}%`);
            progressBar.clear();
            progressBar.fillStyle(0xffffff, 1);
            progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
        });

        this.load.on('complete', () => {
            console.log("[GameScene] Asset loading complete");
            progressBar.destroy();
            progressBox.destroy();
            loadingText.destroy();

            // Verify key textures exist
            this.verifyKeyTextures();
        });

        // Add error handler for loading
        this.load.on('loaderror', (file: any) => {
            console.error(`[GameScene] Error loading asset: ${file.key} (${file.url})`);
            this.createFallbackForAsset(file.key);
        });

        // Initialize the scene
        this.sceneInitializer = new SceneInitializer(this);
        this.sceneInitializer.preloadAssets();
    }

    /**
     * Verify that essential textures exist, create fallbacks if needed
     */
    private verifyKeyTextures(): void {
        console.log("[GameScene] Verifying key textures...");
        const essentialTextures = ['player', 'base', 'projectile'];

        essentialTextures.forEach(key => {
            if (!this.textures.exists(key)) {
                console.warn(`[GameScene] Essential texture '${key}' is missing, creating fallback`);
                this.createFallbackForAsset(key);
            } else {
                console.log(`[GameScene] Verified texture: ${key}`);
            }
        });
    }

    /**
     * Create a fallback texture for a specific asset that failed to load
     */
    private createFallbackForAsset(key: string): void {
        const graphics = this.add.graphics();

        // Create specific fallbacks based on asset type
        switch (key) {
            case 'player':
                console.log("[GameScene] Creating fallback texture for player");
                graphics.fillStyle(0x0000ff, 1); // Blue
                graphics.fillCircle(32, 32, 30);
                graphics.generateTexture('player', 64, 64);
                break;

            case 'base':
                console.log("[GameScene] Creating fallback texture for base");
                graphics.fillStyle(0xff0000, 1); // Red
                graphics.fillRect(0, 0, 64, 64);
                graphics.generateTexture('base', 64, 64);
                break;

            case 'projectile':
                console.log("[GameScene] Creating fallback texture for projectile");
                graphics.fillStyle(0xffff00, 1); // Yellow
                graphics.fillCircle(8, 8, 8);
                graphics.generateTexture('projectile', 16, 16);
                break;

            default:
                // Generic fallback for other textures
                console.log(`[GameScene] Creating generic fallback texture for ${key}`);
                graphics.fillStyle(0xaaaaaa, 1); // Gray
                graphics.fillRect(0, 0, 32, 32);
                graphics.lineStyle(2, 0x000000, 1);
                graphics.strokeRect(0, 0, 32, 32);
                graphics.generateTexture(key, 32, 32);
        }

        graphics.destroy();
    }

    create(): void {
        console.log("[GameScene] Creating game scene");

        try {
            this.createFallbackTextures();

            // Set up the world
            this.sceneInitializer.setupWorld();
            this.sceneInitializer.setupBackground();

            // Initialize all managers in the correct order with proper dependencies

            // First, create the event bus for communication
            this.eventBus = new EventBus();

            // Create tile map manager
            this.tileMapManager = new TileMapManager(this);

            // Create game state (simple initialization for now)
            this.gameState = new GameState();

            // Create collision system
            this.collisionSystem = new CollisionSystem(this, this.entityManager, this.eventBus);

            // Create entity manager with required dependencies
            this.entityManager = new EntityManager(
                this,
                this.tileMapManager,
                this.eventBus,
                this.gameState
            );

            // Create entity factory with all required dependencies
            this.entityFactory = new UnifiedEntityFactory(
                this,
                this.tileMapManager,
                this.eventBus
            );

            // Create UI manager
            this.uiManager = new UIManager(this, this.entityManager, this.eventBus);

            // Create input manager with proper key mappings
            this.inputManager = new InputManager(
                this,
                {
                    up: 'W',
                    down: 'S',
                    left: 'A',
                    right: 'D',
                    fire: 'SPACE',
                    interact: 'E',
                    inventory: 'I',
                    pause: 'ESC'
                },
                this.eventBus
            );

            // Create item drop manager
            this.itemDropManager = new ItemDropManager(
                this,
                this.tileMapManager,
                this.eventBus
            );

            // Create other managers
            this.waveManager = new WaveManager(this, this.entityManager, this.eventBus);
            this.powerUpManager = new PowerUpManager(this, this.entityManager, this.eventBus);
            this.soundManager = new SoundManager(this);
            this.inventoryManager = new InventoryManager(GAME_SETTINGS.player.inventorySize || 20);
            this.effectManager = new EffectManager(this, this.entityManager, this.eventBus);

            // Create player and base with proper positions from settings
            console.log("[GameScene] Creating player and base");

            // Use initialX/initialY from GAME_SETTINGS.player if available, otherwise use default values
            // Note: Player constructor needs both scene and eventBus/collisionSystem
            const playerX = 100; // Default position
            const playerY = 100;
            const baseX = 300; // Default position
            const baseY = 300;

            // Create player with required dependencies
            const player = new Player(
                this,
                playerX,
                playerY,
                this.eventBus,
                this.collisionSystem,
                this.itemDropManager
            );

            // Create base (assuming it takes similar parameters)
            const base = this.entityFactory.createBase(baseX, baseY) as Base;

            // Set up camera to follow player - Player is already a sprite, no need for getSprite
            this.cameras.main.startFollow(player, true, 0.09, 0.09);

            console.log("[GameScene] Game scene creation complete");
        } catch (error) {
            console.error("[GameScene] Error during game scene creation:", error);
        }
    }

    /**
     * Create fallback textures for essential game elements
     */
    private createFallbackTextures(): void {
        // Check if essential textures exist, create them if they don't
        console.log("[GameScene] Creating fallback textures if needed");

        if (!this.textures.exists('player')) {
            console.log("[GameScene] Creating fallback player texture");
            const graphics = this.add.graphics();
            graphics.fillStyle(0x0000ff, 1); // Blue
            graphics.fillCircle(32, 32, 30);
            graphics.generateTexture('player', 64, 64);
            graphics.destroy();
        }

        if (!this.textures.exists('base')) {
            console.log("[GameScene] Creating fallback base texture");
            const graphics = this.add.graphics();
            graphics.fillStyle(0xff0000, 1); // Red
            graphics.fillRect(0, 0, 64, 64);
            graphics.generateTexture('base', 64, 64);
            graphics.destroy();
        }

        if (!this.textures.exists('projectile')) {
            console.log("[GameScene] Creating fallback projectile texture");
            const graphics = this.add.graphics();
            graphics.fillStyle(0xffff00, 1); // Yellow
            graphics.fillCircle(8, 8, 8);
            graphics.generateTexture('projectile', 16, 16);
            graphics.destroy();
        }
    }

    update(_time: number, delta: number): void {
        // Update all game systems - use optional chaining to prevent errors if not initialized
        this.entityManager?.update();
        this.inputManager?.update();
        this.waveManager?.update(delta);
        this.uiManager?.update();
        this.effectManager?.update(delta);
    }

    // Public API methods delegated to managers

    showMessage(text: string, color: number = 0xffffff, fontSize: string = '32px'): void {
        if (this.uiManager) {
            this.uiManager.showMessage(text, color, fontSize);
        } else {
            console.error("[GameScene] Cannot show message - ui manager not initialized");
        }
    }

    showPickupMessage(message: string): void {
        if (this.uiManager) {
            this.uiManager.showPickupMessage(message);
        }
    }

    removeTower(tower: any): void {
        if (this.entityManager) {
            this.entityManager.removeTower(tower);
        }
    }

    toggleInventoryUI(): void {
        if (this.uiManager) {
            this.uiManager.toggleInventoryUI();
        }
    }

    getEnemies(): Phaser.Physics.Arcade.Sprite[] {
        return this.entityManager ? this.entityManager.getEnemies() : [];
    }

    getCurrentRound(): number {
        return this.waveManager ? this.waveManager.getCurrentRound() : 0;
    }

    gameOver(): void {
        if (this.entityManager) {
            this.entityManager.gameOver();
        }
    }

    getGameState(): any {
        if (!this.gameState) {
            console.error("[GameScene] Game state not initialized");
            throw new Error("Game state not initialized");
        }
        return this.gameState;
    }
}