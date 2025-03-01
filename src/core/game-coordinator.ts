import { GameScene } from "../scenes/game-scene";
import { EntityManager } from "../managers/entity-manager";
import { BuildSystem } from "../systems/build-system";
import { RoundSystem } from "../systems/round-system";
import { CollisionSystem } from "../systems/collision-system";
import { UIManager } from "../managers/ui-manager";
import { TowerManager } from "../managers/tower-manager";
import { GameState, GameStateEnum } from "../utils/game-state";
import { EventBus } from "./event-bus";
import { TowerType } from "../settings";
import { GameSystemBuilder } from "./game-system-builder"; 

/**
 * GameCoordinator orchestrates all game systems and managers.
 * It focuses on coordinating interactions between systems rather than initialization.
 */
export class GameCoordinator {
    private scene: GameScene;
    private eventBus: EventBus;
    private gameState: GameState;

    // Managers
    private entityManager!: EntityManager;
    private uiManager!: UIManager;
    private towerManager!: TowerManager;

    // Systems
    private buildSystem!: BuildSystem;
    private roundSystem!: RoundSystem;
    private collisionSystem!: CollisionSystem;

    constructor(scene: GameScene) {
        this.scene = scene;
        this.eventBus = new EventBus();
        this.gameState = new GameState(this.eventBus);

        // Use builder to handle initialization
        this.initializeGameSystems();
        this.setupEventHandlers();
    }

    private initializeGameSystems(): void {
        // Use the builder to construct all systems in the right order
        const builder = new GameSystemBuilder(this.scene, this.eventBus, this.gameState)
            .buildManagers()
            .buildSystems()
            .buildUIComponents();

        // Get references to built components
        const { managers, systems } = builder.getResult();

        // Store direct references to frequently used managers/systems
        this.entityManager = managers.entityManager;
        this.uiManager = managers.uiManager;
        this.towerManager = managers.towerManager;
        this.buildSystem = systems.buildSystem;
        this.roundSystem = systems.roundSystem;
        this.collisionSystem = systems.collisionSystem;

        // Connect game state to key systems
        this.gameState.setRoundSystem(this.roundSystem);
        this.gameState.setUIManager(this.uiManager);
    }

    private setupEventHandlers(): void {
        // Game state transitions
        this.eventBus.on('start-game', () => {
            this.gameState.transition(GameStateEnum.BUILD_PHASE);
        });

        this.eventBus.on('start-round', () => {
            this.roundSystem.startRound();
        });

        this.eventBus.on('start-next-round', () => {
            this.roundSystem.startNextRound();
        });

        this.eventBus.on('enemy-defeated', () => {
            this.roundSystem.enemyDefeated();
        });

        // Handle new game requests
        this.eventBus.on('start-new-game', () => {
            this.gameState.startNewGame();
        });

        // Handle menu return requests
        this.eventBus.on('return-to-menu', () => {
            this.gameState.returnToMenu();
        });

        // Handle resume game requests
        this.eventBus.on('resume-game', () => {
            this.gameState.unpause();
            this.uiManager.hidePauseMenu();
        });

        // Tower placement
        this.eventBus.on('tower-selected', (towerType: TowerType) => {
            this.buildSystem.enterBuildMode(towerType);
        });
    }

    public update(time: number, delta: number): void {
        // Skip updates if game is paused
        if (this.gameState.isPaused()) return;

        // Update game state
        this.gameState.update();

        // Update all managers and systems
        this.entityManager.update();
        this.collisionSystem.update();
        this.towerManager.update();

        // Update round system last as it might depend on entity states
        this.roundSystem.checkRoundCompletion();
    }

    public togglePause(): void {
        if (this.gameState.isPaused()) {
            this.gameState.unpause();
            this.uiManager.hidePauseMenu();
        } else {
            this.gameState.pause();
            this.uiManager.showPauseMenu();
        }
    }

    // Accessor methods for GameScene to use
    public getEntityManager(): EntityManager {
        return this.entityManager;
    }

    public getBuildSystem(): BuildSystem {
        return this.buildSystem;
    }

    public getRoundSystem(): RoundSystem {
        return this.roundSystem;
    }

    public getUIManager(): UIManager {
        return this.uiManager;
    }

    public getTowerManager(): TowerManager {
        return this.towerManager;
    }

    public getEventBus(): EventBus {
        return this.eventBus;
    }

    public getGameState(): GameState {
        return this.gameState;
    }

    public cleanup(): void {
        // Clean up all systems and managers
        this.collisionSystem.destroy();
        this.buildSystem.destroy();
    }
}