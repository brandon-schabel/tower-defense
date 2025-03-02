/**
 * State Machine Implementation
 * Provides a flexible way to manage entity states and transitions between them.
 */

/**
 * Interface for all state implementations
 */
export interface State {
  /**
   * Called when entering the state
   */
  enter: (entity: any) => void;
  
  /**
   * Called each frame/update while in the state
   */
  execute: (entity: any, deltaTime: number) => void;
  
  /**
   * Called when exiting the state
   */
  exit: (entity: any) => void;
}

/**
 * State Machine class that manages states and transitions
 */
export class StateMachine {
  private owner: any;
  private states: Map<string, State>;
  private currentState: string | null = null;
  private previousState: string | null = null;
  
  /**
   * Create a new StateMachine
   * @param owner The entity that owns this state machine
   */
  constructor(owner: any) {
    this.owner = owner;
    this.states = new Map<string, State>();
  }
  
  /**
   * Add a new state to the machine
   * @param name Unique identifier for the state
   * @param state The state implementation
   */
  public addState(name: string, state: State): void {
    this.states.set(name, state);
  }
  
  /**
   * Transition to a new state
   * @param stateName The name of the state to transition to
   */
  public transition(stateName: string): void {
    // Don't transition to the same state
    if (stateName === this.currentState) {
      return;
    }
    
    console.log(`[StateMachine] Transitioning from ${this.currentState} to ${stateName}`);
    
    // Exit current state if exists
    if (this.currentState && this.states.has(this.currentState)) {
      this.states.get(this.currentState)!.exit(this.owner);
    }
    
    // Save previous state
    this.previousState = this.currentState;
    
    // Set new state
    this.currentState = stateName;
    
    // Enter new state if exists
    if (this.states.has(stateName)) {
      this.states.get(stateName)!.enter(this.owner);
    } else {
      console.warn(`State '${stateName}' does not exist`);
      this.currentState = null;
    }
  }
  
  /**
   * Return to the previous state
   */
  public revertToPreviousState(): void {
    if (this.previousState) {
      this.transition(this.previousState);
    }
  }
  
  /**
   * Update the current state
   * @param deltaTime Time elapsed since last update in milliseconds
   */
  public update(deltaTime: number): void {
    // Execute current state if exists
    if (this.currentState && this.states.has(this.currentState)) {
      this.states.get(this.currentState)!.execute(this.owner, deltaTime);
    }
  }
  
  /**
   * Get the name of the current state
   */
  public getCurrentState(): string | null {
    return this.currentState;
  }
  
  /**
   * Get the name of the previous state
   */
  public getPreviousState(): string | null {
    return this.previousState;
  }
  
  /**
   * Check if the machine is in a specific state
   * @param stateName State name to check
   */
  public isInState(stateName: string): boolean {
    return this.currentState === stateName;
  }
} 