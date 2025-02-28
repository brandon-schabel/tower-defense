import { EventBus } from '../core/event-bus';
import GameScene from '../scenes/game-scene';
import RoundSystem from '../systems/round-system';
import UIManager from '../managers/ui-manager';
import GameState, { GameStateEnum } from '../utils/game-state';

/**
 * GameStateManager serves as a central coordinator for game state transitions
 * and connects the various game systems to respond to state changes.
 */
export default class GameStateManager {
    private scene: GameScene;
    private gameState: GameState;
    private eventBus: EventBus;
    private roundSystem: RoundSystem | null = null;
    private uiManager: UIManager | null = null;
    
    constructor(scene: GameScene, gameState: GameState, eventBus: EventBus) {
        this.scene = scene;
        this.gameState = gameState;
        this.eventBus = eventBus;
        
        // Register global state change handlers
        this.setupGlobalHandlers();
        
        // Register state-specific handlers
        this.setupStateHandlers();
    }
    
    /**
     * Set the RoundSystem reference
     */
    setRoundSystem(roundSystem: RoundSystem): void {
        this.roundSystem = roundSystem;
    }
    
    /**
     * Set the UIManager reference
     */
    setUIManager(uiManager: UIManager): void {
        this.uiManager = uiManager;
    }
    
    /**
     * Setup handlers that respond to any state change
     */
    private setupGlobalHandlers(): void {
        // Log all state transitions
        this.gameState.registerGlobalStateChangeHandler((prevState, newState) => {
            console.log(`GameStateManager: State changed from ${prevState} to ${newState}`);
        });
        
        // Pause physics when entering PAUSED state, resume when leaving
        this.gameState.registerGlobalStateChangeHandler((prevState, newState) => {
            if (newState === GameStateEnum.PAUSED) {
                this.scene.physics.pause();
                this.scene.scene.pause();
            } else if (prevState === GameStateEnum.PAUSED) {
                this.scene.physics.resume();
                this.scene.scene.resume();
            }
        });
    }
    
    /**
     * Setup handlers for specific game states
     */
    private setupStateHandlers(): void {
        // Setup for MENU state
        this.gameState.registerStateHandler(GameStateEnum.MENU, () => {
            // Show main menu UI
            if (this.uiManager) {
                this.uiManager.showMainMenu();
            }
            
            // Stop any active gameplay
            if (this.roundSystem) {
                this.roundSystem.reset();
            }
            
            // Other menu setup tasks
            this.eventBus.emit('menu-opened');
        });
        
        // Setup for BUILD_PHASE state
        this.gameState.registerStateHandler(GameStateEnum.BUILD_PHASE, () => {
            // Show build UI
            if (this.uiManager) {
                this.uiManager.showBuildUI();
            }
            
            // Other build phase setup tasks
            this.scene.input.enabled = true;
            
            this.eventBus.emit('build-phase-started');
        });
        
        // Setup for COMBAT_PHASE state
        this.gameState.registerStateHandler(GameStateEnum.COMBAT_PHASE, () => {
            // Update UI for combat
            if (this.uiManager) {
                this.uiManager.showCombatUI();
            }
            
            // Other combat setup tasks
            this.eventBus.emit('combat-phase-started');
        });
        
        // Setup for ROUND_END state
        this.gameState.registerStateHandler(GameStateEnum.ROUND_END, () => {
            // Show round summary UI
            if (this.uiManager) {
                this.uiManager.showRoundEndUI();
            }
            
            // Save game state
            this.gameState.saveToLocalStorage();
            
            this.eventBus.emit('round-end-phase-started');
        });
        
        // Setup for GAME_OVER state
        this.gameState.registerStateHandler(GameStateEnum.GAME_OVER, () => {
            // Show game over UI
            if (this.uiManager) {
                this.uiManager.showGameOverUI();
            }
            
            // Stop all active systems
            this.scene.physics.pause();
            
            // Save final state
            this.gameState.saveToLocalStorage();
            
            this.eventBus.emit('game-over');
        });
        
        // Setup for PAUSED state
        this.gameState.registerStateHandler(GameStateEnum.PAUSED, () => {
            // Show pause menu
            if (this.uiManager) {
                this.uiManager.showPauseMenu();
            }
            
            this.eventBus.emit('game-paused');
        });
    }
    
    /**
     * Start a new game (transition from MENU to BUILD_PHASE)
     */
    startNewGame(): void {
        // Reset game components
        if (this.roundSystem) {
            this.roundSystem.reset();
        }
        
        // Transition to build phase
        this.gameState.transition(GameStateEnum.BUILD_PHASE);
    }
    
    /**
     * Pause the game
     */
    pauseGame(): void {
        // Only allow pausing during active gameplay states
        if (this.gameState.isInState(GameStateEnum.BUILD_PHASE) || 
            this.gameState.isInState(GameStateEnum.COMBAT_PHASE)) {
            this.gameState.transition(GameStateEnum.PAUSED);
        }
    }
    
    /**
     * Resume the game from pause
     */
    resumeGame(): void {
        // Only handle if actually paused
        if (this.gameState.isInState(GameStateEnum.PAUSED)) {
            // Get previous state from event bus or fallback to BUILD_PHASE
            const prevState = this.getPreviousGameState() || GameStateEnum.BUILD_PHASE;
            this.gameState.transition(prevState);
        }
    }
    
    /**
     * Helper to get previous game state
     */
    private getPreviousGameState(): GameStateEnum | null {
        // This is a placeholder - in a real implementation, you would track the previous state
        // For now, we'll just return BUILD_PHASE as a fallback
        return GameStateEnum.BUILD_PHASE;
    }
    
    /**
     * Transition to game over state
     */
    gameOver(isVictory: boolean = false): void {
        if (this.roundSystem) {
            this.roundSystem.handleGameOver(isVictory);
        } else {
            // If no round system, just transition directly
            this.gameState.transition(GameStateEnum.GAME_OVER);
        }
    }
    
    /**
     * Return to the main menu
     */
    returnToMenu(): void {
        // Can transition to menu from any state
        this.gameState.transition(GameStateEnum.MENU);
    }
} 