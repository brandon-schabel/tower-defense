/**
 * PlayerManager
 * Manages the player's resources, score, and other player-specific stats
 * 
 * Most Recent Changes:
 * - Added getGold(), getLives(), getScore() methods for backwards compatibility
 * - Added canAfford() method to check if player has enough gold for a purchase
 * - Updated imports to use consolidated game-config.ts
 */
import { PLAYER_CONFIG } from '../config/game-config';

// Simple event emitter implementation
class EventEmitter {
  private events: Record<string, Function[]> = {};
  
  on(event: string, callback: Function): void {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }
  
  off(event: string, callback: Function): void {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(cb => cb !== callback);
  }
  
  emit(event: string, ...args: any[]): void {
    if (!this.events[event]) return;
    this.events[event].forEach(callback => callback(...args));
  }
}

export class PlayerManager {
  private _gold: number;
  private _lives: number;
  private _score: number = 0;
  private _waveNumber: number = 0;
  private _interestRate: number;
  private events: EventEmitter;
  
  constructor() {
    this._gold = PLAYER_CONFIG.startingGold;
    this._lives = PLAYER_CONFIG.startingLives;
    this._interestRate = PLAYER_CONFIG.interestRate;
    this.events = new EventEmitter();
  }
  
  /**
   * Current gold amount
   */
  get gold(): number {
    return this._gold;
  }
  
  set gold(value: number) {
    const oldValue = this._gold;
    this._gold = value;
    
    // Emit event if value changed
    if (oldValue !== this._gold) {
      this.events.emit('goldChanged', this._gold, oldValue);
    }
  }
  
  /**
   * Get current gold (for backward compatibility)
   */
  public getGold(): number {
    return this._gold;
  }
  
  /**
   * Current lives remaining
   */
  get lives(): number {
    return this._lives;
  }
  
  set lives(value: number) {
    const oldValue = this._lives;
    this._lives = Math.max(0, value); // Cannot go below 0
    
    // Emit event if value changed
    if (oldValue !== this._lives) {
      this.events.emit('livesChanged', this._lives, oldValue);
      
      // If lives reached 0, emit game over event
      if (this._lives === 0) {
        this.events.emit('gameOver', { score: this._score });
      }
    }
  }
  
  /**
   * Get current lives (for backward compatibility)
   */
  public getLives(): number {
    return this._lives;
  }
  
  /**
   * Current game score
   */
  get score(): number {
    return this._score;
  }
  
  set score(value: number) {
    const oldValue = this._score;
    this._score = value;
    
    // Emit event if value changed
    if (oldValue !== this._score) {
      this.events.emit('scoreChanged', this._score, oldValue);
    }
  }
  
  /**
   * Get current score (for backward compatibility)
   */
  public getScore(): number {
    return this._score;
  }
  
  /**
   * Current wave number
   */
  get waveNumber(): number {
    return this._waveNumber;
  }
  
  set waveNumber(value: number) {
    const oldValue = this._waveNumber;
    this._waveNumber = value;
    
    // Emit event if value changed
    if (oldValue !== this._waveNumber) {
      this.events.emit('waveChanged', this._waveNumber, oldValue);
      
      // Apply interest on wave change
      this.applyInterest();
    }
  }
  
  /**
   * Check if player can afford a given amount
   * @param amount Amount of gold to check
   * @returns Whether player has enough gold
   */
  public canAfford(amount: number): boolean {
    return this._gold >= amount;
  }
  
  /**
   * Add gold to the player
   * @param amount Amount of gold to add
   */
  public addGold(amount: number): void {
    this.gold += amount;
  }
  
  /**
   * Deduct gold from the player if sufficient funds are available
   * @param amount Amount of gold to spend
   * @returns Whether the purchase was successful
   */
  public spendGold(amount: number): boolean {
    if (this.canAfford(amount)) {
      this.gold -= amount;
      return true;
    }
    return false;
  }
  
  /**
   * Deal damage to the player (reduce lives)
   * @param amount Amount of damage to take
   */
  public takeDamage(amount: number): void {
    this.lives -= amount;
  }
  
  /**
   * Add points to the player's score
   * @param points Points to add
   */
  public addScore(points: number): void {
    this.score += points;
  }
  
  /**
   * Apply interest to the player's gold based on the current wave
   * Interest is applied at the start of each new wave
   */
  private applyInterest(): void {
    if (this._waveNumber > 1) { // Don't apply interest on the first wave
      const interest = Math.floor(this._gold * this._interestRate);
      if (interest > 0) {
        this.addGold(interest);
        this.events.emit('interestEarned', interest);
      }
    }
  }
  
  /**
   * Register a callback for a player event
   * @param event Event name
   * @param callback Callback function
   */
  public on(event: string, callback: Function): void {
    this.events.on(event, callback);
  }
  
  /**
   * Unregister a callback for a player event
   * @param event Event name
   * @param callback Callback function
   */
  public off(event: string, callback: Function): void {
    this.events.off(event, callback);
  }
  
  /**
   * Reset the player stats to starting values
   */
  public reset(): void {
    this._gold = PLAYER_CONFIG.startingGold;
    this._lives = PLAYER_CONFIG.startingLives;
    this._score = 0;
    this._waveNumber = 0;
    
    // Emit events for all changed values
    this.events.emit('goldChanged', this._gold, 0);
    this.events.emit('livesChanged', this._lives, 0);
    this.events.emit('scoreChanged', this._score, 0);
    this.events.emit('waveChanged', this._waveNumber, 0);
    this.events.emit('playerReset');
  }
} 