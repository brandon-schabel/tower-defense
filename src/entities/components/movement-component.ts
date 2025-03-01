import Phaser from 'phaser';
import { TileMapManager } from '../../managers/tile-map-manager';
import { Enemy }  from '../enemy/enemy';
import { Tower } from '../tower/tower';
import { Player } from '../player/player';

/**
 * Manages complex movement behavior for game entities 
 */
export class MovementComponent {
  private entity: Phaser.GameObjects.Sprite;
  private scene: Phaser.Scene;
  private tileMapManager: TileMapManager;
  private speed: number;
  private path: Phaser.Math.Vector2[] = [];
  private currentPathIndex: number = 0;
  private targetPosition: Phaser.Math.Vector2 | null = null;
  private pathfindingCooldown: number = 0;
  private isMoving: boolean = false;
  private lastPathfindingTime: number = 0;
  private pathfindingThrottleTime: number = 500; // in ms

  /**
   * Creates a movement component to handle entity motion
   */
  constructor(
    entity: Phaser.GameObjects.Sprite,
    scene: Phaser.Scene,
    tileMapManager: TileMapManager,
    speed: number = 100
  ) {
    this.entity = entity;
    this.scene = scene;
    this.tileMapManager = tileMapManager;
    this.speed = speed;
  }

  /**
   * Updates the entity's position based on current movement
   */
  update(time: number, delta: number): void {
    if (!this.isMoving || !this.entity.active) return;
    
    // If we have a path to follow
    if (this.path.length > 0 && this.currentPathIndex < this.path.length) {
      const targetPoint = this.path[this.currentPathIndex];
      const distance = Phaser.Math.Distance.Between(
        this.entity.x, this.entity.y,
        targetPoint.x, targetPoint.y
      );
      
      // If we're close enough to the target point
      if (distance < 2) {
        this.currentPathIndex++;
        
        // If we've reached the end of the path
        if (this.currentPathIndex >= this.path.length) {
          this.isMoving = false;
          
          // If this is an enemy reaching a target
          if (this.entity instanceof Enemy && this.targetPosition) {
            // Handle reaching target based on target type
            const enemy = this.entity as Enemy;
            const target = enemy.getTarget();
            
            // Use optional chaining to safely call methods if they exist
            if (target instanceof Tower) {
              // Call attack method if it exists
              (enemy as any).attack?.(target);
            } else if (target instanceof Player) {
              // Call attackPlayer method if it exists
              (enemy as any).attackPlayer?.();
            }
          }
          return;
        }
      }
      
      // Move towards the current target point
      const angle = Phaser.Math.Angle.Between(
        this.entity.x, this.entity.y,
        targetPoint.x, targetPoint.y
      );
      
      // Calculate velocity based on angle and speed
      const vx = Math.cos(angle) * this.speed;
      const vy = Math.sin(angle) * this.speed;
      
      // Apply velocity if entity has a body (physics)
      if (this.entity.body) {
        (this.entity.body as Phaser.Physics.Arcade.Body).setVelocity(vx, vy);
      } else {
        // Direct position update if no physics body
        this.entity.x += (vx * delta) / 1000;
        this.entity.y += (vy * delta) / 1000;
      }

      // Update entity rotation to face movement direction
      this.entity.setRotation(angle + Math.PI/2);
    }
  }

  /**
   * Sets a new movement target
   */
  moveTo(targetX: number, targetY: number): void {
    this.targetPosition = new Phaser.Math.Vector2(targetX, targetY);
    const now = Date.now();
    
    // Throttle pathfinding requests
    if (now - this.lastPathfindingTime < this.pathfindingThrottleTime) {
      return;
    }
    
    this.lastPathfindingTime = now;
    
    // Use any type assertion since findPath might not be defined in the interface
    const path = (this.tileMapManager as any).findPath?.(
      Math.floor(this.entity.x / 32),
      Math.floor(this.entity.y / 32),
      Math.floor(targetX / 32),
      Math.floor(targetY / 32)
    ) || [];
    
    if (path && path.length > 0) {
      // Convert path to world coordinates
      this.path = path.map((point: {x: number, y: number}) => new Phaser.Math.Vector2(
        point.x * 32 + 16, // Center of tile
        point.y * 32 + 16
      ));
      
      this.currentPathIndex = 0;
      this.isMoving = true;
      
      if (this.entity instanceof Enemy) {
        this.entity.onPathfindingComplete(true);
      }
    } else {
      if (this.entity instanceof Enemy) {
        this.entity.onPathfindingComplete(false);
      }
      console.log("No path found");
      this.isMoving = false;
    }
  }

  /**
   * Sets a new movement target using a game object
   */
  moveToObject(target: Phaser.GameObjects.GameObject): void {
    // Cast to any to access x and y properties that might not be in the interface
    const targetObj = target as any;
    if (targetObj.x !== undefined && targetObj.y !== undefined) {
      this.moveTo(targetObj.x, targetObj.y);
    }
  }

  /**
   * Stops all movement
   */
  stop(): void {
    this.isMoving = false;
    this.path = [];
    this.currentPathIndex = 0;
    
    // Stop physics velocity
    if (this.entity.body) {
      (this.entity.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    }
  }

  /**
   * Set movement speed
   */
  setSpeed(speed: number): void {
    this.speed = speed;
  }

  /**
   * Get current movement speed
   */
  getSpeed(): number {
    return this.speed;
  }

  /**
   * Check if currently moving
   */
  getIsMoving(): boolean {
    return this.isMoving;
  }

  /**
   * Get the current target position
   */
  getTargetPosition(): Phaser.Math.Vector2 | null {
    return this.targetPosition;
  }
} 