import { GAME_SETTINGS, DIFFICULTY_SETTINGS, DifficultyLevel } from "../settings";
import { EventBus } from "../core/event-bus";
import { UIManager } from "../managers/ui-manager";
import { RoundSystem } from "../systems/round-system";

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

// Define a type for game entity tracking
interface GameEntityTracker {
  enemiesAlive: number;
  enemiesKilled: number;
  enemiesSpawned: number;
  towersBuilt: number;
  baseHealth: number;
  playerHealth: number;
  wave: number;
  score: number;
  // Additional tracking properties
  towerUpgrades: number;
  playerShots: number;
  playerDamageDealt: number;
  playerDamageTaken: number;
  resourcesEarned: number;
  resourcesSpent: number;
  itemsCollected: number;
  timeElapsed: number;
}

// Define game flags for various states
interface GameFlags {
  isInventoryOpen: boolean;
  isEnemySpawningActive: boolean;
  isPlayerInvulnerable: boolean;
  hasCompletedTutorial: boolean;
  isDebugModeActive: boolean;
  isCollisionRefreshNeeded: boolean;
  // Additional flags
  isBuildModeActive: boolean;
  isPaused: boolean;
  isGameCompleted: boolean;
  areControlsEnabled: boolean;
  showTowerRanges: boolean;
  showEnemyPaths: boolean;
  showGrid: boolean;
}

// Define game settings that can be adjusted during play
interface GameSettings {
  difficulty: string;
  enemySpawnRate: number;
  enemySpeed: number;
  enemyHealth: number;
  playerDamageMultiplier: number;
  towerDamageMultiplier: number;
  resourceGainMultiplier: number;
}

/**
 * Type representing the entire game configuration from settings.ts
 */
export type GameConfig = typeof GAME_SETTINGS;

export class GameState {
  private resources: number = GAME_SETTINGS.resources.initialAmount; // Use from settings

  // Scene reference
  private scene: Phaser.Scene | null = null;

  // System references
  private roundSystem: RoundSystem | null = null;
  private uiManager: UIManager | null = null;

  // Enhanced state tracking
  private entities: GameEntityTracker = {
    enemiesAlive: 0,
    enemiesKilled: 0,
    enemiesSpawned: 0,
    towersBuilt: 0,
    baseHealth: 100,
    playerHealth: 100,
    wave: 0,
    score: 0,
    // Initialize additional tracking properties
    towerUpgrades: 0,
    playerShots: 0,
    playerDamageDealt: 0,
    playerDamageTaken: 0,
    resourcesEarned: 0,
    resourcesSpent: 0,
    itemsCollected: 0,
    timeElapsed: 0
  };

  // Game flags with enhanced properties
  private flags: GameFlags = {
    isInventoryOpen: false,
    isEnemySpawningActive: false,
    isPlayerInvulnerable: false,
    hasCompletedTutorial: false,
    isDebugModeActive: false,
    isCollisionRefreshNeeded: false,
    // Initialize additional flags
    isBuildModeActive: false,
    isPaused: false,
    isGameCompleted: false,
    areControlsEnabled: true,
    showTowerRanges: false,
    showEnemyPaths: false,
    showGrid: false
  };

  // Game settings - initialize with default values
  private settings: GameSettings = {
    difficulty: 'medium',
    enemySpawnRate: 1.0,
    enemySpeed: 1.0,
    enemyHealth: 1.0,
    playerDamageMultiplier: 1.0,
    towerDamageMultiplier: 1.0,
    resourceGainMultiplier: 1.0
  };

  // Configuration cache for direct access to game settings
  private config: GameConfig = GAME_SETTINGS;

  // Custom config overrides that can be set at runtime
  private configOverrides = new Map<string, any>();

  // State machine properties
  private currentState: GameStateEnum = GameStateEnum.MENU;
  private previousState: GameStateEnum | null = null;
  private stateHandlers: Map<GameStateEnum, (() => void)[]> = new Map();
  private globalStateChangeHandlers: StateChangeHandler[] = [];
  private eventBus?: EventBus;

  // Track initialization status
  private isInitialized: boolean = false;

  // Last update timestamp for time tracking
  private lastUpdateTime: number = 0;

  constructor(eventBus?: EventBus, scene?: Phaser.Scene) {
    // Initialize the state handlers map for each state
    Object.values(GameStateEnum).forEach(state => {
      this.stateHandlers.set(state as GameStateEnum, []);
    });

    this.eventBus = eventBus;
    this.scene = scene || null;
    this.isInitialized = true;
    this.lastUpdateTime = Date.now();

    // Setup global and state-specific handlers
    if (this.isInitialized) {
      this.setupGlobalHandlers();
      this.setupStateHandlers();
    }

    // Apply default settings from GAME_SETTINGS
    this.initializeDefaultSettings();
  }

  /**
   * Initialize settings from the GAME_SETTINGS defaults
   */
  private initializeDefaultSettings(): void {
    // Set defaults for basic settings
    this.settings.difficulty = 'medium';

    // Apply default difficulty settings
    this.applyDifficultySettings(this.settings.difficulty);
  }

  /**
   * Apply settings based on the selected difficulty
   */
  private applyDifficultySettings(difficulty: string): void {
    // Get the difficulty settings
    let diffSettings;

    switch (difficulty) {
      case 'easy':
        diffSettings = DIFFICULTY_SETTINGS[DifficultyLevel.Easy];
        break;
      case 'hard':
        diffSettings = DIFFICULTY_SETTINGS[DifficultyLevel.Hard];
        break;
      case 'medium':
      default:
        diffSettings = DIFFICULTY_SETTINGS[DifficultyLevel.Medium];
        break;
    }

    // Apply the multipliers
    this.settings.enemyHealth = diffSettings.enemyHealthMultiplier;
    this.settings.enemySpeed = diffSettings.enemySpeedMultiplier;
    this.settings.enemySpawnRate = diffSettings.enemyCountMultiplier;
    this.settings.resourceGainMultiplier = diffSettings.resourceMultiplier;
  }

  /**
   * Get a game setting from the configuration
   * @param key The path to the setting (e.g., 'player.movementSpeed')
   * @returns The setting value, or undefined if not found
   */
  public getConfigSetting<T>(key: string): T | undefined {
    // First check if there's an override value
    if (this.configOverrides.has(key)) {
      return this.configOverrides.get(key) as T;
    }

    // Otherwise, access the value from GAME_SETTINGS
    return this.getNestedProperty(this.config, key) as T;
  }

  /**
   * Set a custom override for a game setting
   * @param key The path to the setting (e.g., 'player.movementSpeed')
   * @param value The new value
   */
  public setConfigSetting<T>(key: string, value: T): void {
    this.configOverrides.set(key, value);

    // If this is a setting that affects our current GameSettings object,
    // we should update that too
    if (key === 'difficulty') {
      this.setDifficulty(value as unknown as string);
    }
  }

  /**
   * Reset all configuration overrides
   */
  public resetConfigOverrides(): void {
    this.configOverrides.clear();
    this.initializeDefaultSettings();
  }

  /**
   * Helper method to get a nested property from an object using a dot-separated path
   */
  private getNestedProperty(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current == null || typeof current !== 'object') {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }

  /**
   * Set the scene reference
   */
  public setScene(scene: Phaser.Scene): void {
    this.scene = scene;
  }

  /**
   * Get the scene reference
   */
  public getScene(): Phaser.Scene | null {
    return this.scene;
  }

  /**
   * Set the round system reference
   */
  public setRoundSystem(roundSystem: RoundSystem): void {
    this.roundSystem = roundSystem;
  }

  /**
   * Get the round system reference
   */
  public getRoundSystem(): RoundSystem | null {
    return this.roundSystem;
  }

  /**
   * Set the UI manager reference
   */
  public setUIManager(uiManager: UIManager): void {
    this.uiManager = uiManager;
  }

  /**
   * Get the UI manager reference
   */
  public getUIManager(): UIManager | null {
    return this.uiManager;
  }

  /**
   * Setup handlers that respond to any state change
   */
  private setupGlobalHandlers(): void {
    // Log all state transitions
    this.registerGlobalStateChangeHandler((prevState, newState) => {
      console.log(`GameState: State changed from ${prevState} to ${newState}`);
    });

    // Pause physics when entering PAUSED state, resume when leaving
    this.registerGlobalStateChangeHandler((prevState, newState) => {
      if (this.scene && this.scene.physics) {
        if (newState === GameStateEnum.PAUSED) {
          this.scene.physics.pause();
          // Don't pause the scene itself as we need UI interaction
        } else if (prevState === GameStateEnum.PAUSED) {
          this.scene.physics.resume();
        }
      }
    });

    // Update UI for state changes
    this.registerGlobalStateChangeHandler((prevState, newState) => {
      if (this.uiManager) {
        this.updateUIForState(newState);
      }
    });
  }

  /**
   * Update UI elements based on the current game state
   */
  private updateUIForState(state: GameStateEnum): void {
    if (!this.uiManager) return;

    switch (state) {
      case GameStateEnum.MENU:
        this.uiManager.showMainMenu();
        break;

      case GameStateEnum.BUILD_PHASE:
        this.uiManager.showBuildUI();
        break;

      case GameStateEnum.COMBAT_PHASE:
        this.uiManager.showCombatUI();
        break;

      case GameStateEnum.ROUND_END:
        this.uiManager.showRoundEndUI();
        break;

      case GameStateEnum.GAME_OVER:
        this.uiManager.showGameOverUI();
        break;

      case GameStateEnum.PAUSED:
        this.uiManager.showPauseMenu();
        break;
    }
  }

  /**
   * Setup handlers for specific game states
   */
  private setupStateHandlers(): void {
    // Setup for MENU state
    this.registerStateHandler(GameStateEnum.MENU, () => {
      // Show main menu UI
      if (this.uiManager) {
        this.uiManager.showMainMenu();
      }

      // Stop any active gameplay
      if (this.roundSystem) {
        this.roundSystem.reset();
      }

      // Other menu setup tasks
      this.eventBus?.emit('menu-opened');
    });

    // Setup for BUILD_PHASE state
    this.registerStateHandler(GameStateEnum.BUILD_PHASE, () => {
      // Show build UI
      if (this.uiManager) {
        this.uiManager.showBuildUI();
      }

      // Other build phase setup tasks
      if (this.scene && this.scene.input) {
        this.scene.input.enabled = true;
      }

      this.eventBus?.emit('build-phase-started');
    });

    // Setup for COMBAT_PHASE state
    this.registerStateHandler(GameStateEnum.COMBAT_PHASE, () => {
      // Update UI for combat
      if (this.uiManager) {
        this.uiManager.showCombatUI();
      }

      // Other combat setup tasks
      this.eventBus?.emit('combat-phase-started');
    });

    // Setup for ROUND_END state
    this.registerStateHandler(GameStateEnum.ROUND_END, () => {
      // Show round summary UI
      if (this.uiManager) {
        this.uiManager.showRoundEndUI();
      }

      // Save game state
      this.saveToLocalStorage();

      this.eventBus?.emit('round-end-phase-started');
    });

    // Setup for GAME_OVER state
    this.registerStateHandler(GameStateEnum.GAME_OVER, () => {
      // Show game over UI
      if (this.uiManager) {
        this.uiManager.showGameOverUI();
      }

      // Stop all active systems
      if (this.scene && this.scene.physics) {
        this.scene.physics.pause();
      }

      // Save final state
      this.saveToLocalStorage();

      this.eventBus?.emit('game-over');
    });

    // Setup for PAUSED state
    this.registerStateHandler(GameStateEnum.PAUSED, () => {
      // Show pause menu
      if (this.uiManager) {
        this.uiManager.showPauseMenu();
      }

      this.eventBus?.emit('game-paused');
    });
  }

  /**
   * Start a new game (transition from MENU to BUILD_PHASE)
   */
  public startNewGame(): void {
    // Reset game components
    if (this.roundSystem) {
      this.roundSystem.reset();
    }

    // Reset game state
    this.reset();

    // Transition to build phase
    this.transition(GameStateEnum.BUILD_PHASE);

    // Emit event for new game started
    this.eventBus?.emit('new-game-started');
  }

  /**
   * Return to the main menu
   */
  public returnToMenu(): void {
    // Save the current game state before returning to menu
    this.saveToLocalStorage();

    // Can transition to menu from any state
    this.transition(GameStateEnum.MENU);
  }

  /**
   * Transition to game over state
   */
  public gameOver(isVictory: boolean = false): void {
    if (this.roundSystem) {
      this.roundSystem.handleGameOver(isVictory);
    } else {
      // If no round system, just transition directly
      this.transition(GameStateEnum.GAME_OVER);
    }

    // Emit game over event with stats for UI display
    this.eventBus?.emit('game-over', {
      isVictory: isVictory,
      wave: this.getWave(),
      score: this.getScore(),
      enemiesKilled: this.getEnemiesKilled(),
      timeElapsed: this.getTimeElapsed()
    });
  }

  // Resource management methods
  public getResources(): number {
    return this.resources;
  }

  public spendResources(amount: number): boolean {
    if (this.resources >= amount) {
      this.resources -= amount;
      // Track resources spent
      this.entities.resourcesSpent += amount;
      this.eventBus?.emit('resources-changed', this.resources);
      return true;
    }
    return false;
  }

  public earnResources(amount: number): void {
    // Apply resource gain multiplier
    const actualAmount = Math.round(amount * this.settings.resourceGainMultiplier);
    this.resources += actualAmount;
    // Track resources earned
    this.entities.resourcesEarned += actualAmount;
    this.eventBus?.emit('resources-changed', this.resources);
  }

  public canAfford(amount: number): boolean {
    return this.resources >= amount;
  }

  // Enhanced flag management with consistent getter/setter pattern
  public setInventoryOpen(isOpen: boolean): void {
    if (this.flags.isInventoryOpen === isOpen) return; // No change

    this.flags.isInventoryOpen = isOpen;
    this.eventBus?.emit('inventory-state-changed', isOpen);
  }

  public isInventoryOpen(): boolean {
    return this.flags.isInventoryOpen;
  }

  public setBuildModeActive(active: boolean): void {
    if (this.flags.isBuildModeActive === active) return; // No change

    this.flags.isBuildModeActive = active;
    this.eventBus?.emit('build-mode-changed', active);
  }

  public isBuildModeActive(): boolean {
    return this.flags.isBuildModeActive;
  }

  public setPaused(paused: boolean): void {
    if (this.flags.isPaused === paused) return; // No change

    this.flags.isPaused = paused;
    // Only trigger state transition if we're properly initialized
    if (this.isInitialized) {
      if (paused) {
        this.transition(GameStateEnum.PAUSED);
      } else if (this.previousState) {
        this.transition(this.previousState);
      }
    }
  }

  public isPaused(): boolean {
    return this.flags.isPaused;
  }

  public setControlsEnabled(enabled: boolean): void {
    this.flags.areControlsEnabled = enabled;
    this.eventBus?.emit('controls-enabled-changed', enabled);
  }

  public areControlsEnabled(): boolean {
    return this.flags.areControlsEnabled;
  }

  public setCollisionRefreshNeeded(needed: boolean): void {
    this.flags.isCollisionRefreshNeeded = needed;
    if (needed) {
      this.eventBus?.emit('refresh-collisions', {});
    }
  }

  public isCollisionRefreshNeeded(): boolean {
    return this.flags.isCollisionRefreshNeeded;
  }

  public setPlayerInvulnerable(invulnerable: boolean): void {
    this.flags.isPlayerInvulnerable = invulnerable;
    this.eventBus?.emit('player-invulnerability-changed', invulnerable);
  }

  public isPlayerInvulnerable(): boolean {
    return this.flags.isPlayerInvulnerable;
  }

  public setDebugModeActive(active: boolean): void {
    this.flags.isDebugModeActive = active;
    this.eventBus?.emit('debug-mode-changed', active);
  }

  public isDebugModeActive(): boolean {
    return this.flags.isDebugModeActive;
  }

  public setShowTowerRanges(show: boolean): void {
    this.flags.showTowerRanges = show;
    this.eventBus?.emit('show-tower-ranges-changed', show);
  }

  public shouldShowTowerRanges(): boolean {
    return this.flags.showTowerRanges;
  }

  public setShowEnemyPaths(show: boolean): void {
    this.flags.showEnemyPaths = show;
    this.eventBus?.emit('show-enemy-paths-changed', show);
  }

  public shouldShowEnemyPaths(): boolean {
    return this.flags.showEnemyPaths;
  }

  public setShowGrid(show: boolean): void {
    this.flags.showGrid = show;
    this.eventBus?.emit('show-grid-changed', show);
  }

  public shouldShowGrid(): boolean {
    return this.flags.showGrid;
  }

  // Entity tracking methods with enhanced functionality
  public incrementEnemiesSpawned(): void {
    this.entities.enemiesSpawned++;
    this.entities.enemiesAlive++;
    this.flags.isCollisionRefreshNeeded = true;
    this.eventBus?.emit('enemy-spawned', {
      total: this.entities.enemiesSpawned,
      alive: this.entities.enemiesAlive
    });
  }

  public incrementEnemiesKilled(): void {
    this.entities.enemiesKilled++;
    this.entities.enemiesAlive = Math.max(0, this.entities.enemiesAlive - 1);

    // Update score based on enemy kill
    this.incrementScore(10); // Base points per enemy

    this.flags.isCollisionRefreshNeeded = true;
    this.eventBus?.emit('enemy-count-changed', {
      killed: this.entities.enemiesKilled,
      alive: this.entities.enemiesAlive
    });

    // Check if we should end the round
    if (this.entities.enemiesAlive === 0 && this.currentState === GameStateEnum.COMBAT_PHASE) {
      this.transition(GameStateEnum.ROUND_END);
    }
  }

  public getEnemiesAlive(): number {
    return this.entities.enemiesAlive;
  }

  public getEnemiesKilled(): number {
    return this.entities.enemiesKilled;
  }

  public getEnemiesSpawned(): number {
    return this.entities.enemiesSpawned;
  }

  public incrementWave(): void {
    this.entities.wave++;
    this.eventBus?.emit('wave-changed', this.entities.wave);
  }

  public getWave(): number {
    return this.entities.wave;
  }

  public incrementTowersBuilt(): void {
    this.entities.towersBuilt++;
    this.eventBus?.emit('tower-count-changed', this.entities.towersBuilt);
  }

  public getTowersBuilt(): number {
    return this.entities.towersBuilt;
  }

  public incrementTowerUpgrades(): void {
    this.entities.towerUpgrades++;
    this.eventBus?.emit('tower-upgrades-changed', this.entities.towerUpgrades);
  }

  public getTowerUpgrades(): number {
    return this.entities.towerUpgrades;
  }

  public incrementPlayerShots(): void {
    this.entities.playerShots++;
  }

  public getPlayerShots(): number {
    return this.entities.playerShots;
  }

  public addPlayerDamageDealt(damage: number): void {
    this.entities.playerDamageDealt += damage;
  }

  public getPlayerDamageDealt(): number {
    return this.entities.playerDamageDealt;
  }

  public addPlayerDamageTaken(damage: number): void {
    this.entities.playerDamageTaken += damage;
  }

  public getPlayerDamageTaken(): number {
    return this.entities.playerDamageTaken;
  }

  public incrementItemsCollected(): void {
    this.entities.itemsCollected++;
    this.eventBus?.emit('items-collected-changed', this.entities.itemsCollected);
  }

  public getItemsCollected(): number {
    return this.entities.itemsCollected;
  }

  public incrementScore(points: number): void {
    this.entities.score += points;
    this.eventBus?.emit('score-changed', this.entities.score);
  }

  public getScore(): number {
    return this.entities.score;
  }

  public setPlayerHealth(health: number): void {
    const previousHealth = this.entities.playerHealth;
    this.entities.playerHealth = health;
    this.eventBus?.emit('player-health-changed', health);

    // Track damage taken if health decreased
    if (health < previousHealth) {
      this.entities.playerDamageTaken += (previousHealth - health);
    }

    if (health <= 0 && this.currentState !== GameStateEnum.GAME_OVER) {
      this.transition(GameStateEnum.GAME_OVER);
    }
  }

  public getPlayerHealth(): number {
    return this.entities.playerHealth;
  }

  public setBaseHealth(health: number): void {
    this.entities.baseHealth = health;
    this.eventBus?.emit('base-health-changed', health);

    if (health <= 0 && this.currentState !== GameStateEnum.GAME_OVER) {
      this.transition(GameStateEnum.GAME_OVER);
    }
  }

  public getBaseHealth(): number {
    return this.entities.baseHealth;
  }

  // Game settings methods
  public setDifficulty(difficulty: string): void {
    this.settings.difficulty = difficulty;

    // Use our new method to apply difficulty settings from DIFFICULTY_SETTINGS
    this.applyDifficultySettings(difficulty);

    // Update config override
    this.configOverrides.set('difficulty', difficulty);

    this.eventBus?.emit('difficulty-changed', difficulty);
  }

  public getDifficulty(): string {
    return this.settings.difficulty;
  }

  public getEnemyHealthMultiplier(): number {
    return this.settings.enemyHealth;
  }

  public getEnemySpeedMultiplier(): number {
    return this.settings.enemySpeed;
  }

  public getEnemySpawnRateMultiplier(): number {
    return this.settings.enemySpawnRate;
  }

  public getPlayerDamageMultiplier(): number {
    return this.settings.playerDamageMultiplier;
  }

  public getTowerDamageMultiplier(): number {
    return this.settings.towerDamageMultiplier;
  }

  public getResourceGainMultiplier(): number {
    return this.settings.resourceGainMultiplier;
  }

  // Update method for time tracking and periodic tasks
  public update(): void {
    const currentTime = Date.now();
    const delta = (currentTime - this.lastUpdateTime) / 1000; // Convert to seconds

    // Only update time elapsed if we're in an active game state
    if (this.currentState !== GameStateEnum.MENU &&
      this.currentState !== GameStateEnum.PAUSED &&
      this.currentState !== GameStateEnum.GAME_OVER) {
      this.entities.timeElapsed += delta;
    }

    this.lastUpdateTime = currentTime;
  }

  public getTimeElapsed(): number {
    return this.entities.timeElapsed;
  }

  // State machine methods
  public getCurrentState(): GameStateEnum {
    return this.currentState;
  }

  public getPreviousState(): GameStateEnum | null {
    return this.previousState;
  }

  /**
   * Attempts to transition to a new game state
   * @param newState The state to transition to
   * @returns True if transition was successful, false if invalid
   */
  public transition(newState: GameStateEnum): boolean {
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
    this.previousState = this.currentState;

    // Update the state
    this.currentState = newState;

    // Log the transition
    console.log(`Game state transition: ${this.previousState} -> ${newState}`);

    // Update related flags based on the new state
    this.updateFlagsForState(newState);

    // Execute handlers for the new state
    this.executeStateHandlers(this.previousState, newState);

    // Emit event via EventBus if available
    if (this.eventBus) {
      this.eventBus.emit('game-state-changed', { prevState: this.previousState, newState });
    }

    // Handle state-specific logic
    this.handleStateLogic(newState);

    return true;
  }

  /**
   * Update related flags when state changes
   */
  private updateFlagsForState(newState: GameStateEnum): void {
    // Update pause state
    this.flags.isPaused = (newState === GameStateEnum.PAUSED);

    // Update build mode active flag
    this.flags.isBuildModeActive = (newState === GameStateEnum.BUILD_PHASE);

    // Update enemy spawning flag
    this.flags.isEnemySpawningActive = (newState === GameStateEnum.COMBAT_PHASE);

    // Enable/disable controls based on state
    this.flags.areControlsEnabled = (
      newState !== GameStateEnum.GAME_OVER &&
      newState !== GameStateEnum.PAUSED
    );
  }

  /**
   * Register a handler function to be called when entering a specific state
   */
  public registerStateHandler(state: GameStateEnum, handler: () => void): void {
    const handlers = this.stateHandlers.get(state) || [];
    handlers.push(handler);
    this.stateHandlers.set(state, handlers);
  }

  /**
   * Register a handler function to be called on any state change
   */
  public registerGlobalStateChangeHandler(handler: StateChangeHandler): void {
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
   * Handle state-specific logic on transitions
   */
  private handleStateLogic(newState: GameStateEnum): void {
    switch (newState) {
      case GameStateEnum.BUILD_PHASE:
        // Reset enemy spawning flag when entering build phase
        this.flags.isEnemySpawningActive = false;
        break;

      case GameStateEnum.COMBAT_PHASE:
        // Enable enemy spawning when combat starts
        this.flags.isEnemySpawningActive = true;
        break;

      case GameStateEnum.ROUND_END:
        // Stop enemy spawning at round end
        this.flags.isEnemySpawningActive = false;

        // Increment wave number for next round
        this.incrementWave();
        break;

      case GameStateEnum.GAME_OVER:
        // Clean up when game is over
        this.flags.isEnemySpawningActive = false;
        this.flags.isGameCompleted = true;
        break;
    }
  }

  /**
   * Checks if the current state matches the specified state
   */
  public isInState(state: GameStateEnum): boolean {
    return this.currentState === state;
  }

  /**
   * Get a snapshot of the current game state for analytics or saving
   */
  public getStateSnapshot(): object {
    return {
      resources: this.resources,
      entities: { ...this.entities },
      flags: { ...this.flags },
      settings: { ...this.settings },
      currentState: this.currentState,
      timeElapsed: this.entities.timeElapsed
    };
  }

  /**
   * Save game state to local storage
   */
  public saveToLocalStorage(): void {
    const saveData = JSON.stringify({
      resources: this.resources,
      entities: this.entities,
      flags: this.flags,
      settings: this.settings,
      currentState: this.currentState,
      timeElapsed: this.entities.timeElapsed,
      // Save configuration overrides
      configOverrides: Array.from(this.configOverrides.entries())
    });
    localStorage.setItem("game-state", saveData);

    // Emit save event
    this.eventBus?.emit('game-state-saved');
  }

  /**
   * Load game state from local storage
   */
  public loadFromLocalStorage(): void {
    const data = localStorage.getItem("game-state");
    if (data) {
      try {
        const parsed = JSON.parse(data);
        this.resources = parsed.resources || GAME_SETTINGS.resources.initialAmount;

        // Load entities if available
        if (parsed.entities) {
          this.entities = {
            ...this.entities, // Preserve defaults for any new properties
            ...parsed.entities // Override with saved values
          };
        }

        // Load flags if available
        if (parsed.flags) {
          this.flags = {
            ...this.flags, // Preserve defaults for any new properties
            ...parsed.flags // Override with saved values
          };
        }

        // Load settings if available
        if (parsed.settings) {
          this.settings = {
            ...this.settings, // Preserve defaults for any new properties
            ...parsed.settings // Override with saved values
          };
        }

        // Load config overrides if available
        if (parsed.configOverrides && Array.isArray(parsed.configOverrides)) {
          this.configOverrides.clear();
          parsed.configOverrides.forEach(([key, value]: [string, any]) => {
            this.configOverrides.set(key, value);
          });
        }

        // Only load the state if it's a valid state value
        if (Object.values(GameStateEnum).includes(parsed.currentState)) {
          this.currentState = parsed.currentState;
        } else {
          this.currentState = GameStateEnum.MENU;
        }

        // Load time elapsed
        if (typeof parsed.timeElapsed === 'number') {
          this.entities.timeElapsed = parsed.timeElapsed;
        }

        // Emit event with loaded state
        if (this.eventBus) {
          this.eventBus.emit('game-state-loaded', this.getStateSnapshot());
        }
      } catch (error) {
        console.error("Error parsing saved game state:", error);
        this.reset();
      }
    } else {
      this.reset();
    }
  }

  /**
   * Reset game state to initial values
   */
  public reset(): void {
    this.resources = GAME_SETTINGS.resources.initialAmount;

    // Reset entity tracking
    this.entities = {
      enemiesAlive: 0,
      enemiesKilled: 0,
      enemiesSpawned: 0,
      towersBuilt: 0,
      baseHealth: 100,
      playerHealth: 100,
      wave: 0,
      score: 0,
      towerUpgrades: 0,
      playerShots: 0,
      playerDamageDealt: 0,
      playerDamageTaken: 0,
      resourcesEarned: 0,
      resourcesSpent: 0,
      itemsCollected: 0,
      timeElapsed: 0
    };

    // Reset flags
    this.flags = {
      isInventoryOpen: false,
      isEnemySpawningActive: false,
      isPlayerInvulnerable: false,
      hasCompletedTutorial: false,
      isDebugModeActive: false,
      isCollisionRefreshNeeded: false,
      isBuildModeActive: false,
      isPaused: false,
      isGameCompleted: false,
      areControlsEnabled: true,
      showTowerRanges: false,
      showEnemyPaths: false,
      showGrid: false
    };

    // Reset config overrides
    this.configOverrides.clear();

    // Reset settings to default using our initialization method
    this.initializeDefaultSettings();

    // Reset state machine
    this.transition(GameStateEnum.MENU);

    // Update last update time
    this.lastUpdateTime = Date.now();

    if (this.eventBus) {
      this.eventBus.emit('game-state-reset');
    }
  }

  /**
   * Get the full game configuration
   */
  public getFullConfig(): GameConfig {
    return this.config;
  }

  /**
   * Get the current game settings
   */
  public getSettings(): GameSettings {
    return { ...this.settings };
  }

  public unpause(): void {
    this.flags.isPaused = false;
    this.eventBus?.emit('game-unpaused');
  }

  public pause(): void {
    this.flags.isPaused = true;
    this.eventBus?.emit('game-paused');
  }
}