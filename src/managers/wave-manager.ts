/**
 * WaveManager class
 * Handles the creation and management of enemy waves
 * 
 * Most Recent Changes:
 * - Updated texture usage to use type-safe ImageKey type
 * - Fixed linter error with texture parameter in enemy creation
 * - Added fallback mechanism for enemy textures
 * - Updated to use consolidated game-config.ts structure
 * - Fixed property access for the new WAVE_CONFIG format
 * - Updated enemy stats to use ENEMY_TYPES instead of ENEMY_STATS
 * - Added simplified difficulty scaling without relying on difficultyScaling property
 */
import Phaser from 'phaser';
import { Enemy } from '../entities/enemy';
import { EnemyType, ENEMY_TYPES, WAVE_CONFIG, DifficultySettings, Difficulty } from '../config/game-config';
import { ImageKey } from '../loaders/asset-loader/image-map';

// Simplified scaling factors for waves (formerly difficultyScaling)
const WAVE_SCALING = {
  countMultiplier: 1.25,  // Enemy count scaling per wave
  healthMultiplier: 1.1,  // Enemy health scaling per wave
  goldMultiplier: 1.05    // Gold reward scaling per wave
};

interface WaveData {
  waveNumber: number;
  enemies: {
    type: EnemyType;
    count: number;
  }[];
  totalEnemies: number;
}

export class WaveManager {
  private scene: Phaser.Scene;
  private path: Phaser.Curves.Path;
  private currentWave: number = 0;
  private enemiesSpawned: number = 0;
  private enemiesRemaining: number = 0;
  private totalEnemiesInWave: number = 0;
  private waveInProgress: boolean = false;
  private spawnTimer: Phaser.Time.TimerEvent | null = null;
  private waveTimer: Phaser.Time.TimerEvent | null = null;
  
  public onWaveComplete: (waveNumber: number) => void = () => {};
  public onWaveStart: (waveNumber: number, waveData: WaveData) => void = () => {};
  public onEnemySpawn: (enemy: Enemy) => void = () => {};
  public onAllWavesComplete: () => void = () => {};
  
  constructor(scene: Phaser.Scene, path: Phaser.Curves.Path) {
    this.scene = scene;
    this.path = path;
    
    // Listen for enemy death event
    this.scene.events.on('enemyDied', this.handleEnemyDeath, this);
    this.scene.events.on('enemyReachedEnd', this.handleEnemyReachedEnd, this);
  }
  
  /**
   * Start the first wave
   */
  public startWaves(): void {
    // Schedule the first wave
    this.waveTimer = this.scene.time.delayedCall(
      WAVE_CONFIG.initialDelay,
      () => {
        this.startNextWave();
      }
    );
    
    // Emit an event that waves will start soon
    this.scene.events.emit('wavesStartingSoon', WAVE_CONFIG.initialDelay);
  }
  
  /**
   * Start the next wave 
   */
  public startNextWave(): void {
    if (this.waveInProgress) {
      return;
    }
    
    this.currentWave++;
    this.waveInProgress = true;
    this.enemiesSpawned = 0;
    
    const waveData = this.generateWaveData(this.currentWave);
    this.totalEnemiesInWave = waveData.totalEnemies;
    this.enemiesRemaining = this.totalEnemiesInWave;
    
    // Call the wave start callback
    this.onWaveStart(this.currentWave, waveData);
    
    // Emit wave start event
    this.scene.events.emit('waveStarted', this.currentWave, waveData);
    
    // Start spawning enemies
    this.spawnEnemies(waveData);
  }
  
  /**
   * Generate data for a specific wave
   */
  private generateWaveData(waveNumber: number): WaveData {
    const wave: WaveData = {
      waveNumber,
      enemies: [],
      totalEnemies: 0
    };
    
    // Base number of enemies, scales with wave number
    let baseEnemyCount = Math.floor(WAVE_CONFIG.baseEnemyCount * Math.pow(WAVE_SCALING.countMultiplier, waveNumber - 1));
    
    // Distribute enemy types based on wave number
    if (waveNumber <= 3) {
      // Early waves - mostly basic enemies
      wave.enemies.push({
        type: EnemyType.BASIC,
        count: baseEnemyCount
      });
    } else if (waveNumber <= 6) {
      // Add fast enemies
      wave.enemies.push({
        type: EnemyType.BASIC,
        count: Math.floor(baseEnemyCount * 0.7)
      });
      wave.enemies.push({
        type: EnemyType.FAST,
        count: Math.floor(baseEnemyCount * 0.3)
      });
    } else if (waveNumber <= 10) {
      // Add strong enemies
      wave.enemies.push({
        type: EnemyType.BASIC,
        count: Math.floor(baseEnemyCount * 0.5)
      });
      wave.enemies.push({
        type: EnemyType.FAST,
        count: Math.floor(baseEnemyCount * 0.3)
      });
      wave.enemies.push({
        type: EnemyType.STRONG,
        count: Math.floor(baseEnemyCount * 0.2)
      });
    } else if (waveNumber <= 15) {
      // Add flying enemies
      wave.enemies.push({
        type: EnemyType.BASIC,
        count: Math.floor(baseEnemyCount * 0.4)
      });
      wave.enemies.push({
        type: EnemyType.FAST,
        count: Math.floor(baseEnemyCount * 0.3)
      });
      wave.enemies.push({
        type: EnemyType.STRONG,
        count: Math.floor(baseEnemyCount * 0.2)
      });
      wave.enemies.push({
        type: EnemyType.FLYING,
        count: Math.floor(baseEnemyCount * 0.1)
      });
    } else {
      // Later waves include all enemy types
      wave.enemies.push({
        type: EnemyType.BASIC,
        count: Math.floor(baseEnemyCount * 0.3)
      });
      wave.enemies.push({
        type: EnemyType.FAST,
        count: Math.floor(baseEnemyCount * 0.25)
      });
      wave.enemies.push({
        type: EnemyType.STRONG,
        count: Math.floor(baseEnemyCount * 0.25)
      });
      wave.enemies.push({
        type: EnemyType.FLYING,
        count: Math.floor(baseEnemyCount * 0.2)
      });
    }
    
    // Add a boss every 5 waves
    if (waveNumber % 5 === 0) {
      wave.enemies.push({
        type: EnemyType.BOSS,
        count: waveNumber >= 15 ? 2 : 1
      });
    }
    
    // Calculate total enemies
    wave.totalEnemies = wave.enemies.reduce((total, enemyGroup) => total + enemyGroup.count, 0);
    
    return wave;
  }
  
  /**
   * Spawn enemies for a wave
   */
  private spawnEnemies(waveData: WaveData): void {
    // Create a queue of enemies to spawn
    const spawnQueue: EnemyType[] = [];
    
    // Fill the spawn queue based on the wave data
    waveData.enemies.forEach(enemyGroup => {
      for (let i = 0; i < enemyGroup.count; i++) {
        spawnQueue.push(enemyGroup.type);
      }
    });
    
    // Shuffle the spawn queue for variety
    this.shuffleArray(spawnQueue);
    
    // Start the spawn timer
    this.spawnTimer = this.scene.time.addEvent({
      delay: WAVE_CONFIG.enemySpawnInterval,
      callback: () => {
        if (spawnQueue.length > 0) {
          // Spawn the next enemy
          const enemyType = spawnQueue.shift()!;
          this.spawnEnemy(enemyType, waveData.waveNumber);
          
          // We can't vary the delay since it's read-only, so we're using a fixed interval
          // If we need to vary it, we'd need to destroy and recreate the timer
        } else {
          // All enemies in queue have been spawned
          if (this.spawnTimer) {
            this.spawnTimer.destroy();
            this.spawnTimer = null;
          }
        }
      },
      callbackScope: this,
      loop: true
    });
  }
  
  /**
   * Spawn a single enemy
   */
  private spawnEnemy(type: EnemyType, waveNumber: number): void {
    // Clone the enemy stats from config
    const enemyConfig = ENEMY_TYPES[type];
    
    // Calculate health with scaling
    const health = Math.floor(
      enemyConfig.health * Math.pow(WAVE_SCALING.healthMultiplier, waveNumber - 1)
    );
    
    // Calculate gold reward with scaling
    const goldReward = Math.floor(
      enemyConfig.reward * Math.pow(WAVE_SCALING.goldMultiplier, waveNumber - 1)
    );
    
    // Get the starting point of the path
    const startPoint = new Phaser.Math.Vector2();
    this.path.getPoint(0, startPoint);
    
    // Handle texture - ensure it's a valid ImageKey
    const textureKey = this.getEnemyTextureKey(enemyConfig.texture, type);
    
    // Create the enemy
    const enemy = new Enemy({
      scene: this.scene,
      x: startPoint.x,
      y: startPoint.y,
      texture: textureKey,
      type,
      path: this.path
    });
    
    // Set properties after creation (these aren't part of the constructor)
    enemy.health = health;
    enemy.maxHealth = health;
    enemy.speed = enemyConfig.speed;
    enemy.damage = enemyConfig.damage;
    enemy.reward = goldReward;
    
    // Set enemy tint based on type for easier identification (temporary solution)
    switch (type) {
      case EnemyType.BASIC:
        enemy.setTint(0xFFFFFF); // White
        break;
      case EnemyType.FAST:
        enemy.setTint(0x00FF00); // Green
        break;
      case EnemyType.STRONG:
        enemy.setTint(0xFF0000); // Red
        break;
      case EnemyType.FLYING:
        enemy.setTint(0x0000FF); // Blue
        break;
      case EnemyType.BOSS:
        enemy.setTint(0xFFFF00); // Yellow
        break;
    }
    
    this.enemiesSpawned++;
    
    // Call the enemy spawn callback
    this.onEnemySpawn(enemy);
    
    // Emit enemy spawn event
    this.scene.events.emit('enemySpawned', enemy);
  }
  
  /**
   * Get a valid enemy texture key, with fallbacks if needed
   * @param configuredTexture The texture specified in the config
   * @param enemyType The type of enemy
   * @returns A valid ImageKey to use for the enemy
   */
  private getEnemyTextureKey(configuredTexture: string | undefined, enemyType: EnemyType): ImageKey {
    // First try to use the texture from config if it exists
    if (configuredTexture && this.scene.textures.exists(configuredTexture)) {
      return configuredTexture as ImageKey;
    }
    
    // Try a type-specific texture based on enemy type
    const typeSpecificKey = `${enemyType.toLowerCase()}-enemy` as ImageKey;
    if (this.scene.textures.exists(typeSpecificKey)) {
      return typeSpecificKey;
    }
    
    // Fall back to basic enemy texture
    const basicEnemyKey = 'basic-enemy' as ImageKey;
    if (this.scene.textures.exists(basicEnemyKey)) {
      return basicEnemyKey;
    }
    
    // Ultimate fallback to a known valid texture
    console.warn(`[WaveManager] No valid texture found for enemy type ${enemyType}, using fallback`);
    return 'terrain-tiles' as ImageKey;
  }
  
  /**
   * Handle enemy death event
   */
  private handleEnemyDeath(enemy: Enemy): void {
    this.enemiesRemaining--;
    this.checkWaveComplete();
  }
  
  /**
   * Handle enemy reaching end of path
   */
  private handleEnemyReachedEnd(enemy: Enemy): void {
    this.enemiesRemaining--;
    this.checkWaveComplete();
  }
  
  /**
   * Check if the current wave is complete
   */
  private checkWaveComplete(): void {
    if (this.waveInProgress && this.enemiesRemaining <= 0) {
      this.waveInProgress = false;
      
      // Call the wave complete callback
      this.onWaveComplete(this.currentWave);
      
      // Emit wave complete event
      this.scene.events.emit('waveCompleted', this.currentWave);
      
      // Schedule the next wave
      this.waveTimer = this.scene.time.delayedCall(
        WAVE_CONFIG.timeBetweenWaves,
        () => {
          this.startNextWave();
        }
      );
      
      // Emit an event that the next wave will start soon
      this.scene.events.emit('nextWaveStartingSoon', WAVE_CONFIG.timeBetweenWaves);
    }
  }
  
  /**
   * Helper function to shuffle an array
   */
  private shuffleArray(array: any[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
  
  /**
   * Skip the wait time and start the next wave immediately
   */
  public skipToNextWave(): void {
    if (this.waveTimer) {
      this.waveTimer.destroy();
      this.waveTimer = null;
    }
    
    if (!this.waveInProgress) {
      this.startNextWave();
    }
  }
  
  /**
   * Get the current wave number
   */
  public getCurrentWave(): number {
    return this.currentWave;
  }
  
  /**
   * Get the wave progress (enemies spawned / total enemies)
   */
  public getWaveProgress(): number {
    if (this.totalEnemiesInWave === 0) return 0;
    return this.enemiesSpawned / this.totalEnemiesInWave;
  }
  
  /**
   * Get whether a wave is currently in progress
   */
  public isWaveInProgress(): boolean {
    return this.waveInProgress;
  }
  
  /**
   * Cleanup the manager when no longer needed
   */
  public destroy(): void {
    if (this.spawnTimer) {
      this.spawnTimer.destroy();
      this.spawnTimer = null;
    }
    
    if (this.waveTimer) {
      this.waveTimer.destroy();
      this.waveTimer = null;
    }
    
    this.scene.events.off('enemyDied', this.handleEnemyDeath, this);
    this.scene.events.off('enemyReachedEnd', this.handleEnemyReachedEnd, this);
  }
} 