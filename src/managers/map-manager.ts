/**
 * MapManager class
 * Manages the game map, grid, and tower placement
 * 
 * Most Recent Changes:
 * - Updated to use type-safe ImageKey for tower textures
 * - Added texture lookup for towers based on type
 * - Added fallback handling for missing textures
 * - Added handleTowerPlacement method to consolidate tower placement logic
 * - Improved tower management functionality with better error handling
 * - Added methods to check if all waves are complete
 */
import Phaser from 'phaser';
import { Tower, TowerConfig } from '../entities/tower';
import { TowerType, TOWER_TYPES } from '../config/game-config';
import { ImageKey } from '../loaders/asset-loader/image-map';

interface GridCell {
  x: number;
  y: number;
  worldX: number;
  worldY: number;
  occupied: boolean;
  tower: Tower | null;
  cost?: number;
}

export interface PlacementResult {
  success: boolean;
  tower?: Tower;
  cost?: number;
  message?: string;
}

export class MapManager {
  private scene: Phaser.Scene;
  private grid: GridCell[][] = [];
  private cellSize: number;
  private gridWidth: number;
  private gridHeight: number;
  private pathCells: GridCell[] = [];
  private gridGraphics: Phaser.GameObjects.Graphics;
  private placementRangeGraphics: Phaser.GameObjects.Graphics;
  private selectedTower: Tower | null = null;
  private path: Phaser.Curves.Path;
  
  constructor(
    scene: Phaser.Scene, 
    width: number, 
    height: number, 
    cellSize: number, 
    path: Phaser.Curves.Path
  ) {
    this.scene = scene;
    this.cellSize = cellSize;
    this.gridWidth = Math.floor(width / cellSize);
    this.gridHeight = Math.floor(height / cellSize);
    this.path = path;
    
    // Create graphics for grid and range visualization
    this.gridGraphics = this.scene.add.graphics();
    this.placementRangeGraphics = this.scene.add.graphics();
    
    // Initialize the grid
    this.initGrid();
    
    // Mark cells along the path as occupied
    this.markPathCells();
    
    // Draw the grid
    this.drawGrid();
    
    // Listen for pointer events
    this.scene.input.on('pointerdown', this.handlePointerDown, this);
    this.scene.input.on('pointermove', this.handlePointerMove, this);
  }
  
  /**
   * Handle tower placement at a given position
   * Consolidates logic from GameScene for placing towers
   */
  public handleTowerPlacement(
    x: number, 
    y: number, 
    towerType: TowerType, 
    availableGold: number
  ): PlacementResult {
    const gridCoords = this.worldToGrid(x, y);
    
    // Check if valid placement
    if (!this.isValidPlacement(x, y)) {
      return {
        success: false,
        message: 'Invalid placement location'
      };
    }
    
    // Check if player can afford the tower
    const towerCost = TOWER_TYPES[towerType].cost;
    
    if (availableGold < towerCost) {
      return {
        success: false,
        message: 'Not enough gold!'
      };
    }
    
    // Place the tower
    return this.placeTower(gridCoords.x, gridCoords.y, towerType);
  }
  
  /**
   * Initialize the grid with empty cells
   */
  private initGrid(): void {
    for (let y = 0; y < this.gridHeight; y++) {
      this.grid[y] = [];
      for (let x = 0; x < this.gridWidth; x++) {
        const worldX = x * this.cellSize + this.cellSize / 2;
        const worldY = y * this.cellSize + this.cellSize / 2;
        
        this.grid[y][x] = {
          x,
          y,
          worldX,
          worldY,
          occupied: false,
          tower: null
        };
      }
    }
  }
  
  /**
   * Mark grid cells that are part of the enemy path as occupied
   */
  private markPathCells(): void {
    // Sample points along the path
    const pathPoints: Phaser.Math.Vector2[] = [];
    const pathLength = this.path.getLength();
    const numPoints = Math.ceil(pathLength / (this.cellSize / 2));
    
    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      const point = new Phaser.Math.Vector2();
      this.path.getPoint(t, point);
      pathPoints.push(point);
    }
    
    // Mark cells as occupied
    pathPoints.forEach(point => {
      const gridX = Math.floor(point.x / this.cellSize);
      const gridY = Math.floor(point.y / this.cellSize);
      
      // Check if within grid bounds
      if (
        gridX >= 0 && 
        gridX < this.gridWidth && 
        gridY >= 0 && 
        gridY < this.gridHeight
      ) {
        this.grid[gridY][gridX].occupied = true;
        this.pathCells.push(this.grid[gridY][gridX]);
      }
    });
  }
  
  /**
   * Draw the grid on screen (debug mode)
   */
  private drawGrid(): void {
    this.gridGraphics.clear();
    
    // Grid lines
    this.gridGraphics.lineStyle(1, 0x333333, 0.3);
    
    // Vertical lines
    for (let x = 0; x <= this.gridWidth; x++) {
      this.gridGraphics.moveTo(x * this.cellSize, 0);
      this.gridGraphics.lineTo(x * this.cellSize, this.gridHeight * this.cellSize);
    }
    
    // Horizontal lines
    for (let y = 0; y <= this.gridHeight; y++) {
      this.gridGraphics.moveTo(0, y * this.cellSize);
      this.gridGraphics.lineTo(this.gridWidth * this.cellSize, y * this.cellSize);
    }
    
    this.gridGraphics.strokePath();
    
    // Highlight occupied cells (path cells)
    this.gridGraphics.fillStyle(0xff0000, 0.2);
    for (const cell of this.pathCells) {
      this.gridGraphics.fillRect(
        cell.x * this.cellSize,
        cell.y * this.cellSize,
        this.cellSize,
        this.cellSize
      );
    }
  }
  
  /**
   * Handle pointer down event (select tower or place tower)
   */
  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    // Get the grid cell at the pointer position
    const gridX = Math.floor(pointer.x / this.cellSize);
    const gridY = Math.floor(pointer.y / this.cellSize);
    
    // Check if within grid bounds
    if (
      gridX >= 0 && 
      gridX < this.gridWidth && 
      gridY >= 0 && 
      gridY < this.gridHeight
    ) {
      const cell = this.grid[gridY][gridX];
      
      // If the cell has a tower, select it
      if (cell.tower) {
        this.selectTower(cell.tower);
      } else {
        // Otherwise, deselect any selected tower
        this.deselectTower();
      }
    }
  }
  
  /**
   * Handle pointer move event (show tower range preview)
   */
  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    this.placementRangeGraphics.clear();
    
    // Get the grid cell at the pointer position
    const gridX = Math.floor(pointer.x / this.cellSize);
    const gridY = Math.floor(pointer.y / this.cellSize);
    
    // Check if within grid bounds and cell is not occupied
    if (
      gridX >= 0 && 
      gridX < this.gridWidth && 
      gridY >= 0 && 
      gridY < this.gridHeight &&
      !this.grid[gridY][gridX].occupied
    ) {
      const cell = this.grid[gridY][gridX];
      
      // Show placement preview for the currently selected tower type
      // (Range would come from UI selection or similar)
      const range = 150; // Default range for preview
      
      // Draw range circle
      this.placementRangeGraphics.lineStyle(2, 0x00ff00, 0.5);
      this.placementRangeGraphics.fillStyle(0x00ff00, 0.1);
      this.placementRangeGraphics.strokeCircle(cell.worldX, cell.worldY, range);
      this.placementRangeGraphics.fillCircle(cell.worldX, cell.worldY, range);
    }
  }
  
  /**
   * Place a tower at the specified grid coordinates
   */
  public placeTower(gridX: number, gridY: number, towerType: TowerType): PlacementResult {
    // Check if coordinates are within bounds
    if (
      gridX < 0 || 
      gridX >= this.gridWidth || 
      gridY < 0 || 
      gridY >= this.gridHeight
    ) {
      return {
        success: false,
        message: 'Invalid placement: Out of bounds'
      };
    }
    
    const cell = this.grid[gridY][gridX];
    
    // Check if the cell is already occupied
    if (cell.occupied) {
      return {
        success: false,
        message: 'Invalid placement: Cell is occupied'
      };
    }
    
    // Get tower stats
    const towerStats = TOWER_TYPES[towerType];
    const cost = towerStats.cost;
    
    // Get the appropriate texture key for this tower type
    const textureKey = this.getTowerTextureKey(towerType);
    
    // Create the tower
    const towerConfig: TowerConfig = {
      scene: this.scene,
      x: cell.worldX,
      y: cell.worldY,
      texture: textureKey,
      type: towerType,
      range: towerStats.range,
      damage: towerStats.damage,
      attackSpeed: towerStats.attackSpeed,
      cost: towerStats.cost
    };
    
    const tower = new Tower(towerConfig);
    
    // Mark the cell as occupied
    cell.occupied = true;
    cell.tower = tower;
    
    // Emit tower placed event
    this.scene.events.emit('towerPlaced', tower, towerType, cell);
    
    return {
      success: true,
      tower,
      cost
    };
  }
  
  /**
   * Get a valid texture key for a tower type
   * @param towerType The type of tower to get a texture for
   * @returns A valid ImageKey to use for the tower
   */
  private getTowerTextureKey(towerType: TowerType): ImageKey {
    // Try to get the texture from the tower config
    const configTexture = TOWER_TYPES[towerType].texture;
    
    if (configTexture && this.scene.textures.exists(configTexture)) {
      return configTexture as ImageKey;
    }
    
    // Try tower type specific texture naming convention
    const typeSpecificKey = `${towerType.toLowerCase()}-tower` as ImageKey;
    if (this.scene.textures.exists(typeSpecificKey)) {
      return typeSpecificKey;
    }
    
    // Fall back to basic tower texture
    const basicTowerKey = 'basic-tower' as ImageKey;
    if (this.scene.textures.exists(basicTowerKey)) {
      return basicTowerKey;
    }
    
    // Ultimate fallback to a known valid texture
    console.warn(`[MapManager] No valid texture found for tower type ${towerType}, using fallback`);
    return 'terrain-tiles' as ImageKey;
  }
  
  /**
   * Remove a tower from the grid
   */
  public removeTower(tower: Tower): boolean {
    // Find the cell containing this tower
    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        if (this.grid[y][x].tower === tower) {
          // Mark cell as unoccupied
          this.grid[y][x].tower = null;
          
          // Check if it's not a path cell
          if (!this.pathCells.includes(this.grid[y][x])) {
            this.grid[y][x].occupied = false;
          }
          
          // Deselect if this was the selected tower
          if (this.selectedTower === tower) {
            this.deselectTower();
          }
          
          // Destroy the tower
          tower.destroy();
          
          // Emit tower removed event
          this.scene.events.emit('towerRemoved', tower);
          
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Select a tower to show its range and upgrade options
   */
  public selectTower(tower: Tower): void {
    // Deselect previous tower if any
    this.deselectTower();
    
    this.selectedTower = tower;
    
    // Show the tower's range
    tower.showRange(true);
    
    // Emit tower selected event
    this.scene.events.emit('towerSelected', tower);
  }
  
  /**
   * Deselect the currently selected tower
   */
  public deselectTower(): void {
    if (this.selectedTower) {
      this.selectedTower.showRange(false);
      this.selectedTower = null;
      
      // Emit tower deselected event
      this.scene.events.emit('towerDeselected');
    }
  }
  
  /**
   * Upgrade the selected tower
   */
  public upgradeSelectedTower(): PlacementResult {
    if (!this.selectedTower) {
      return {
        success: false,
        message: 'No tower selected'
      };
    }
    
    // Calculate upgrade cost (50% of original cost * upgrade level)
    const baseCost = this.selectedTower.cost;
    const upgradeCost = Math.floor(baseCost * 0.5 * this.selectedTower.upgradeLevel);
    
    // Upgrade the tower
    this.selectedTower.upgrade();
    
    // Emit tower upgraded event
    this.scene.events.emit('towerUpgraded', this.selectedTower, upgradeCost);
    
    return {
      success: true,
      tower: this.selectedTower,
      cost: upgradeCost
    };
  }
  
  /**
   * Sell the selected tower
   */
  public sellSelectedTower(): PlacementResult {
    if (!this.selectedTower) {
      return {
        success: false,
        message: 'No tower selected'
      };
    }
    
    // Calculate sell value (70% of cost)
    const sellValue = Math.floor(this.selectedTower.cost * 0.7);
    
    // Store reference before removing
    const tower = this.selectedTower;
    
    // Remove the tower
    this.removeTower(tower);
    
    // Emit tower sold event
    this.scene.events.emit('towerSold', tower, sellValue);
    
    return {
      success: true,
      cost: sellValue
    };
  }
  
  /**
   * Check if a position is valid for tower placement
   */
  public isValidPlacement(x: number, y: number): boolean {
    const gridX = Math.floor(x / this.cellSize);
    const gridY = Math.floor(y / this.cellSize);
    
    return (
      gridX >= 0 && 
      gridX < this.gridWidth && 
      gridY >= 0 && 
      gridY < this.gridHeight &&
      !this.grid[gridY][gridX].occupied
    );
  }
  
  /**
   * Get the selected tower
   */
  public getSelectedTower(): Tower | null {
    return this.selectedTower;
  }
  
  /**
   * Convert world coordinates to grid coordinates
   */
  public worldToGrid(x: number, y: number): { x: number; y: number } {
    return {
      x: Math.floor(x / this.cellSize),
      y: Math.floor(y / this.cellSize)
    };
  }
  
  /**
   * Convert grid coordinates to world coordinates (center of cell)
   */
  public gridToWorld(gridX: number, gridY: number): { x: number; y: number } {
    return {
      x: gridX * this.cellSize + this.cellSize / 2,
      y: gridY * this.cellSize + this.cellSize / 2
    };
  }
  
  /**
   * Show or hide the grid
   */
  public setGridVisible(visible: boolean): void {
    this.gridGraphics.setVisible(visible);
  }
  
  /**
   * Clean up when no longer needed
   */
  public destroy(): void {
    // Remove event listeners
    this.scene.input.off('pointerdown', this.handlePointerDown, this);
    this.scene.input.off('pointermove', this.handlePointerMove, this);
    
    // Destroy graphics
    this.gridGraphics.destroy();
    this.placementRangeGraphics.destroy();
    
    // Clear references
    this.selectedTower = null;
    this.grid = [];
    this.pathCells = [];
  }
} 