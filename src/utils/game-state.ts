import { GAME_SETTINGS } from "../settings"; // Import
import { EventBus } from "../core/event-bus";

// Define the game states
export enum GameStateEnum {
  MENU = 'menu',
  BUILD_PHASE = 'build',
  COMBAT_PHASE = 'combat',
  ROUND_END = 'roundEnd',
  GAME_OVER = 'gameOver',
  PAUSED = 'paused'
}

// Define a type for state transition handlers
type StateChangeHandler = (prevState: GameStateEnum, newState: GameStateEnum) => void;

export default class GameState {
  private resources: number = GAME_SETTINGS.resources.initialAmount; // Use from settings
  public isInventoryOpen: boolean = false;
  
  // State machine properties
  private currentState: GameStateEnum = GameStateEnum.MENU;
  private stateHandlers: Map<GameStateEnum, (() => void)[]> = new Map();
  private globalStateChangeHandlers: StateChangeHandler[] = [];
  private eventBus?: EventBus;

  constructor(eventBus?: EventBus) {
    // Initialize the state handlers map for each state
    Object.values(GameStateEnum).forEach(state => {
      this.stateHandlers.set(state as GameStateEnum, []);
    });
    
    this.eventBus = eventBus;
  }

  getResources() {
    return this.resources;
  }

  spendResources(amount: number): boolean {
    if (this.resources >= amount) {
      this.resources -= amount;
      console.log(`Spent ${amount}. New total: ${this.resources}`);
      return true;
    }
    console.log(`Not enough resources. Need ${amount}, have ${this.resources}`);
    return false;
  }

  earnResources(amount: number) {
    this.resources += amount;
  }

  canAfford(amount: number): boolean {
    return this.resources >= amount;
  }

  setInventoryOpen(isOpen: boolean): void {
    this.isInventoryOpen = isOpen;
  }

  // State machine methods
  getCurrentState(): GameStateEnum {
    return this.currentState;
  }

  /**
   * Attempts to transition to a new game state
   * @param newState The state to transition to
   * @returns True if transition was successful, false if invalid
   */
  transition(newState: GameStateEnum): boolean {
    // Don't transition if we're already in this state
    if (this.currentState === newState) {
      console.log(`Already in state ${newState}`);
      return true;
    }

    // Check if the transition is valid
    if (!this.isValidTransition(newState)) {
      console.warn(`Invalid state transition from ${this.currentState} to ${newState}`);
      return false;
    }

    // Store the previous state before changing
    const prevState = this.currentState;
    
    // Update the state
    this.currentState = newState;
    
    // Log the transition
    console.log(`Game state transition: ${prevState} -> ${newState}`);
    
    // Execute handlers for the new state
    this.executeStateHandlers(prevState, newState);
    
    // Emit event via EventBus if available
    if (this.eventBus) {
      this.eventBus.emit('game-state-changed', { prevState, newState });
    }
    
    return true;
  }

  /**
   * Register a handler function to be called when entering a specific state
   */
  registerStateHandler(state: GameStateEnum, handler: () => void): void {
    const handlers = this.stateHandlers.get(state) || [];
    handlers.push(handler);
    this.stateHandlers.set(state, handlers);
  }

  /**
   * Register a handler function to be called on any state change
   */
  registerGlobalStateChangeHandler(handler: StateChangeHandler): void {
    this.globalStateChangeHandlers.push(handler);
  }

  /**
   * Check if a transition from current state to new state is valid
   */
  private isValidTransition(newState: GameStateEnum): boolean {
    // PAUSED state can be entered from any state except GAME_OVER
    if (newState === GameStateEnum.PAUSED && this.currentState !== GameStateEnum.GAME_OVER) {
      return true;
    }
    
    // And we can return from PAUSED to the previous state
    if (this.currentState === GameStateEnum.PAUSED) {
      // Can return to any state except GAME_OVER from PAUSED
      return newState !== GameStateEnum.GAME_OVER;
    }

    // Define valid transitions for each state
    switch (this.currentState) {
      case GameStateEnum.MENU:
        return newState === GameStateEnum.BUILD_PHASE;
        
      case GameStateEnum.BUILD_PHASE:
        return newState === GameStateEnum.COMBAT_PHASE || newState === GameStateEnum.GAME_OVER;
        
      case GameStateEnum.COMBAT_PHASE:
        return newState === GameStateEnum.ROUND_END || newState === GameStateEnum.GAME_OVER;
        
      case GameStateEnum.ROUND_END:
        return newState === GameStateEnum.BUILD_PHASE || newState === GameStateEnum.GAME_OVER;
        
      case GameStateEnum.GAME_OVER:
        // Only valid transition from GAME_OVER is back to MENU
        return newState === GameStateEnum.MENU;
        
      default:
        // Unknown state - allow only transitions to GAME_OVER or MENU as fallback
        return newState === GameStateEnum.GAME_OVER || newState === GameStateEnum.MENU;
    }
  }

  /**
   * Execute handlers for the new state
   */
  private executeStateHandlers(prevState: GameStateEnum, newState: GameStateEnum): void {
    // Execute global state change handlers
    this.globalStateChangeHandlers.forEach(handler => {
      try {
        handler(prevState, newState);
      } catch (error) {
        console.error('Error in global state change handler:', error);
      }
    });
    
    // Execute state-specific handlers
    const handlers = this.stateHandlers.get(newState) || [];
    handlers.forEach(handler => {
      try {
        handler();
      } catch (error) {
        console.error(`Error in handler for state ${newState}:`, error);
      }
    });
  }

  /**
   * Checks if the current state matches the specified state
   */
  isInState(state: GameStateEnum): boolean {
    return this.currentState === state;
  }

  saveToLocalStorage() {
    localStorage.setItem("game-state", JSON.stringify({ 
      resources: this.resources,
      isInventoryOpen: this.isInventoryOpen,
      currentState: this.currentState
    }));
  }

  loadFromLocalStorage() {
    const data = localStorage.getItem("game-state");
    if (data) {
      const parsed = JSON.parse(data);
      this.resources = parsed.resources || GAME_SETTINGS.resources.initialAmount;
      this.isInventoryOpen = parsed.isInventoryOpen || false;
      
      // Only load the state if it's a valid state value
      if (Object.values(GameStateEnum).includes(parsed.currentState)) {
        this.currentState = parsed.currentState;
      } else {
        this.currentState = GameStateEnum.MENU;
      }
    } else {
      this.resources = GAME_SETTINGS.resources.initialAmount;
      this.isInventoryOpen = false;
      this.currentState = GameStateEnum.MENU;
    }
  }

  /**
   * Reset game state to initial values
   */
  reset(): void {
    this.resources = GAME_SETTINGS.resources.initialAmount;
    this.isInventoryOpen = false;
    this.transition(GameStateEnum.MENU);
  }
}