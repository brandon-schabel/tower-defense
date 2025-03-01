import { GameScene } from "../scenes/game-scene";
import { EntityManager } from "../managers/entity-manager";
import { BuildSystem } from "../systems/build-system";
import { RoundSystem } from "../systems/round-system";
import { CollisionSystem } from "../systems/collision-system";
import { ItemDropManager } from "../managers/item-drop-manager";
import { TileMapManager } from "../managers/tile-map-manager";
import { InputManager } from "../managers/input-manger";
import { UIManager } from "../managers/ui-manager";
import { TowerManager } from "../managers/tower-manager";
import { GameState } from "../utils/game-state";
import { EventBus } from "./event-bus";

/**
 * Responsible for building and connecting all game systems and managers.
 * Simplifies the initialization process and keeps GameCoordinator clean.
 */
export class GameSystemBuilder {
    private scene: GameScene;
    private eventBus: EventBus;
    private gameState: GameState;

    // Managers
    private tileMapManager!: TileMapManager;
    private entityManager!: EntityManager;
    private itemDropManager!: ItemDropManager;
    private inputManager!: InputManager;
    private uiManager!: UIManager;
    private towerManager!: TowerManager;

    // Systems
    private buildSystem!: BuildSystem;
    private roundSystem!: RoundSystem;
    private collisionSystem!: CollisionSystem;

    constructor(scene: GameScene, eventBus: EventBus, gameState: GameState) {
        this.scene = scene;
        this.eventBus = eventBus;
        this.gameState = gameState;
    }

    /**
     * Build all managers in the correct order, handling dependencies
     */
    public buildManagers(): this {
        // Create in dependency order
        this.tileMapManager = new TileMapManager(this.scene);

        this.entityManager = new EntityManager(
            this.scene,
            this.tileMapManager,
            this.eventBus,
            this.gameState
        );

        this.itemDropManager = new ItemDropManager(
            this.scene,
            this.tileMapManager,
            this.eventBus
        );

        // Connect managers to each other
        this.entityManager.setItemDropManager(this.itemDropManager);

        // Create input manager with default key mappings
        const defaultKeyMappings = {
            'up': 'W',
            'down': 'S',
            'left': 'A',
            'right': 'D',
            'shoot': 'SPACE',
            'inventory': 'I',
            'interact': 'E',
            'pause': 'ESC'
        };
        this.inputManager = new InputManager(this.scene, defaultKeyMappings, this.eventBus);

        return this;
    }

    /**
     * Build all systems in the correct order, handling dependencies
     */
    public buildSystems(): this {
        // Create collision system first as many other systems need it
        this.collisionSystem = new CollisionSystem(
            this.scene,
            this.entityManager,
            this.eventBus
        );

        // Set collision system in entity manager
        this.entityManager.setCombatSystem(this.collisionSystem);

        // Now that all dependencies are set, complete initialization
        this.entityManager.completeInitialization();

        // Other systems
        this.buildSystem = new BuildSystem(
            this.scene,
            this.tileMapManager,
            this.gameState,
            this.eventBus,
            this.entityManager,
            this.collisionSystem
        );

        this.roundSystem = new RoundSystem(
            this.scene,
            this.entityManager,
            this.eventBus,
            this.gameState
        );

        return this;
    }

    /**
     * Build UI components after other systems are ready
     */
    public buildUIComponents(): this {
        // UI-related managers (depend on other systems)
        this.uiManager = new UIManager(
            this.scene,
            this.entityManager,
            this.eventBus
        );

        this.towerManager = new TowerManager(
            this.scene,
            this.entityManager,
            this.eventBus,
            this.gameState
        );

        return this;
    }

    /**
     * Returns all built components as a unified object
     */
    public getResult(): {
        managers: {
            tileMapManager: TileMapManager;
            entityManager: EntityManager;
            itemDropManager: ItemDropManager;
            inputManager: InputManager;
            uiManager: UIManager;
            towerManager: TowerManager;
        };
        systems: {
            buildSystem: BuildSystem;
            roundSystem: RoundSystem;
            collisionSystem: CollisionSystem;
        };
    } {
        return {
            managers: {
                tileMapManager: this.tileMapManager,
                entityManager: this.entityManager,
                itemDropManager: this.itemDropManager,
                inputManager: this.inputManager,
                uiManager: this.uiManager,
                towerManager: this.towerManager
            },
            systems: {
                buildSystem: this.buildSystem,
                roundSystem: this.roundSystem,
                collisionSystem: this.collisionSystem
            }
        };
    }
}