import GameScene from "../scenes/game-scene";
import EntityManager from "../managers/entity-manager";
import RoundSystem from "../systems/round-system";
import BuildSystem from "../systems/build-system";
import TowerManager from "../managers/tower-manager";
import CombatSystem from "../systems/combat-system";
import ItemDropManager from "../managers/item-drop-manager";
import UIManager from "../managers/ui-manager";
import GameState from "../utils/game-state";
import { EventBus } from "./event-bus";
import { DifficultyLevel } from "../settings";
import TileMapManager from '../managers/tile-map-manager';
import GameStateManager from '../managers/game-state-manager';
import { GameStateEnum } from '../utils/game-state';

/**
 * GameCoordinator acts as a central hub for accessing all game managers
 * through dependency injection.
 */
export default class GameCoordinator {
    private scene: GameScene;
    private entityManager: EntityManager;
    private roundManager: RoundSystem;
    private buildController: BuildSystem;
    private towerManager: TowerManager;
    private combatSystem: CombatSystem;
    private itemDropManager: ItemDropManager;
    private uiManager: UIManager;
    private gameState: GameState;
    private eventBus: EventBus;
    private difficultyLevel: DifficultyLevel;
    private tileMapManager: TileMapManager;
    private gameStateManager: GameStateManager;
    
    constructor(
        scene: GameScene,
        entityManager: EntityManager,
        roundManager: RoundSystem,
        buildController: BuildSystem,
        towerManager: TowerManager,
        combatSystem: CombatSystem,
        itemDropManager: ItemDropManager,
        gameState: GameState,
        eventBus: EventBus,
        tileMapManager: TileMapManager,
        uiManager: UIManager
    ) {
        this.scene = scene;
        this.gameState = gameState;
        this.entityManager = entityManager;
        this.roundManager = roundManager;
        this.buildController = buildController;
        this.towerManager = towerManager;
        this.combatSystem = combatSystem;
        this.itemDropManager = itemDropManager;
        this.eventBus = eventBus;
        this.difficultyLevel = scene.getDifficultyLevel();
        this.tileMapManager = tileMapManager;
        this.uiManager = uiManager;
        
        // Create game state manager
        this.gameStateManager = new GameStateManager(scene, gameState, eventBus);
        this.gameStateManager.setRoundSystem(roundManager);
        this.gameStateManager.setUIManager(uiManager);
        
        // Setup event handlers
        this.setupEventHandlers();
    }
    
    private setupEventHandlers(): void {
        // Handle enemy defeat
        this.eventBus.on('enemy-defeated', () => {
            this.roundManager.enemyDefeated();
        });
        
        // Handle base damage
        this.eventBus.on('base-damaged', () => {
            this.checkGameOver();
        });
        
        // Handle player health change
        this.eventBus.on('player-health-changed', (health: number) => {
            if (health <= 0) {
                this.gameOver(false);
            }
        });

        // Handle game state change events from UI
        this.eventBus.on('start-new-game', () => {
            this.startNewGame();
        });
        
        this.eventBus.on('return-to-menu', () => {
            this.returnToMenu();
        });
        
        this.eventBus.on('resume-game', () => {
            this.resumeGame();
        });
        
        this.eventBus.on('start-round', () => {
            this.startRound();
        });
        
        this.eventBus.on('start-next-round', () => {
            this.startNextRound();
        });
        
        // Listen for game-state-changed events
        this.eventBus.on('game-state-changed', (data: { prevState: GameStateEnum, newState: GameStateEnum }) => {
            console.log(`Game state changed from ${data.prevState} to ${data.newState}`);
            
            // Perform any global state change actions here
            if (data.newState === GameStateEnum.GAME_OVER) {
                console.log('Game over state entered');
                // Any additional game over actions
            }
        });
    }

    /**
     * Check if the game is over
     */
    private checkGameOver(): void {
        const base = this.entityManager.getBase();
        if (base && base.getHealth() <= 0) {
            this.gameOver(false);
        }
    }
    
    public initGame(isNewGame: boolean): void {
        if (!isNewGame) {
            this.gameState.loadFromLocalStorage();
        }
        
        // Apply research effects
        this.applyResearchEffects();
    }
    
    private applyResearchEffects(): void {
        const researchTree = this.uiManager.getHUD().getResearchTree();
        const towerDamageLevel = researchTree.getResearchLevel('tower-damage-1');
        if (towerDamageLevel > 0) {
            console.log(`Applying tower damage research level: ${towerDamageLevel}`);
        }
    }
    
    public update(): void {
        // Update all systems that need per-frame updates
        this.entityManager.update();
        this.towerManager.update();
        this.uiManager.update();
        
        // Check round completion
        this.roundManager.checkRoundCompletion();
    }
    
    // Getters for managers
    public getUIManager(): UIManager {
        return this.uiManager;
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
    
    public setDifficulty(level: DifficultyLevel): void {
        this.difficultyLevel = level;
    }
    
    public getDifficultyLevel(): DifficultyLevel {
        return this.difficultyLevel;
    }

    public getItemDropManager(): ItemDropManager {
        return this.itemDropManager;
    }

    public getTileMapManager(): TileMapManager {
        return this.tileMapManager;
    }

    public getEventBus(): EventBus {
        return this.eventBus;
    }

    /**
     * Start a new round
     */
    public startRound(): void {
        // Verify we're in build phase before starting a round
        if (this.gameState.isInState(GameStateEnum.BUILD_PHASE)) {
            this.roundManager.startRound();
        } else {
            console.warn('Cannot start round: Not in build phase');
        }
    }

    /**
     * Start the next round
     */
    public startNextRound(): void {
        // Verify we're in build phase before starting a round
        if (this.gameState.isInState(GameStateEnum.BUILD_PHASE)) {
            this.roundManager.startNextRound();
        } else {
            console.warn('Cannot start next round: Not in build phase');
        }
    }

    /**
     * Handle game over
     */
    public gameOver(isVictory: boolean = false): void {
        this.gameStateManager.gameOver(isVictory);
    }

    /**
     * Pause the game
     */
    public pauseGame(): void {
        this.gameStateManager.pauseGame();
    }

    /**
     * Resume the game from pause
     */
    public resumeGame(): void {
        this.gameStateManager.resumeGame();
    }

    /**
     * Return to the main menu
     */
    public returnToMenu(): void {
        this.gameStateManager.returnToMenu();
    }

    /**
     * Start a new game
     */
    public startNewGame(): void {
        this.gameStateManager.startNewGame();
    }

    /**
     * Get the game state manager
     */
    public getGameStateManager(): GameStateManager {
        return this.gameStateManager;
    }
}