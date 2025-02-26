import Phaser from "phaser";
import { GAME_SETTINGS } from "../settings";

/**
 * Manages the tile map for the game, handling placement validation and coordinate conversion
 */
export default class TileMapManager {
    private scene: Phaser.Scene;
    private tileSize: number;
    private mapWidth: number;
    private mapHeight: number;
    private occupancyMap: Map<string, { type: string, id: string }>;
    
    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.tileSize = GAME_SETTINGS.map.tileSize || 32;
        this.mapWidth = GAME_SETTINGS.map.width;
        this.mapHeight = GAME_SETTINGS.map.height;
        this.occupancyMap = new Map();
        
        this.initializeMap();
    }
    
    /**
     * Initialize the map with terrain tiles
     */
    private initializeMap(): void {
        // Create the tilemap
        const map = this.scene.make.tilemap({
            tileWidth: this.tileSize,
            tileHeight: this.tileSize,
            width: this.mapWidth,
            height: this.mapHeight
        });
        
        // Add the tileset - updated to properly handle SVG
        const tileset = map.addTilesetImage('terrain-tiles', 'terrain-tiles', this.tileSize, this.tileSize, 0, 0);
        if (!tileset) {
            console.error('Failed to load terrain-tiles tileset');
            return;
        }
        
        // Create the main ground layer
        const groundLayer = map.createBlankLayer('ground', tileset);
        if (!groundLayer) {
            console.error('Failed to create ground layer');
            return;
        }
        
        // Fill the ground layer with grass tiles
        const grassTile = 0; // The index of the grass tile in your tileset
        groundLayer.fill(grassTile);
        
        // Add some random variation to make the map more interesting
        for (let y = 0; y < this.mapHeight; y++) {
            for (let x = 0; x < this.mapWidth; x++) {
                // 10% chance of a different tile
                if (Phaser.Math.RND.between(0, 100) < 10) {
                    const variationTile = Phaser.Math.RND.between(1, 3); // Assuming indices 1-3 are variations
                    groundLayer.putTileAt(variationTile, x, y);
                }
            }
        }
    }
    
    /**
     * Convert tile coordinates to world coordinates
     */
    public tileToWorld(tileX: number, tileY: number): { x: number, y: number } {
        return {
            x: tileX * this.tileSize + this.tileSize / 2,
            y: tileY * this.tileSize + this.tileSize / 2
        };
    }
    
    /**
     * Convert world coordinates to tile coordinates
     */
    public worldToTile(worldX: number, worldY: number): { tileX: number, tileY: number } {
        const tileX = Math.floor(worldX / this.tileSize);
        const tileY = Math.floor(worldY / this.tileSize);
        return { tileX, tileY };
    }
    
    /**
     * Check if a rectangle of tiles is available for placement
     */
    public isTileAvailable(tileX: number, tileY: number, width: number, height: number): boolean {
        // Check bounds
        if (tileX < 0 || tileY < 0 || tileX + width > this.mapWidth || tileY + height > this.mapHeight) {
            return false;
        }
        
        // Check if any tile in the area is occupied
        for (let y = tileY; y < tileY + height; y++) {
            for (let x = tileX; x < tileX + width; x++) {
                const key = `${x},${y}`;
                if (this.occupancyMap.has(key)) {
                    return false;
                }
            }
        }
        
        return true;
    }
    
    /**
     * Mark a rectangle of tiles as occupied
     */
    public occupyTiles(tileX: number, tileY: number, width: number, height: number, type: string, id: string): void {
        for (let x = tileX; x < tileX + width; x++) {
            for (let y = tileY; y < tileY + height; y++) {
                if (this.isValidTile(x, y)) {
                    this.occupancyMap.set(`${x},${y}`, { type, id });
                }
            }
        }
    }
    
    /**
     * Release tiles previously marked as occupied
     */
    public releaseTiles(tileX: number, tileY: number, width: number, height: number): void {
        for (let x = tileX; x < tileX + width; x++) {
            for (let y = tileY; y < tileY + height; y++) {
                if (this.isValidTile(x, y)) {
                    this.occupancyMap.delete(`${x},${y}`);
                }
            }
        }
    }
    
    /**
     * Find a valid placement position for an object of the given size
     */
    public findValidPlacement(width: number, height: number): { tileX: number, tileY: number } | null {
        for (let tileY = 0; tileY <= this.mapHeight - height; tileY++) {
            for (let tileX = 0; tileX <= this.mapWidth - width; tileX++) {
                if (!this.isAreaOccupied(tileX, tileY, width, height)) {
                    return { tileX, tileY };
                }
            }
        }
        return null; // No valid placement found
    }
    
    /**
     * Get the size of tiles in pixels
     */
    public getTileSize(): number {
        return this.tileSize;
    }
    
    /**
     * Get the map width in tiles
     */
    public getMapWidth(): number {
        return this.mapWidth;
    }
    
    /**
     * Get the map height in tiles
     */
    public getMapHeight(): number {
        return this.mapHeight;
    }
    
    /**
     * Get information about what's at a specific tile
     */
    public getTileInfo(tileX: number, tileY: number): { type: string, id: string } | null {
        const key = `${tileX},${tileY}`;
        return this.occupancyMap.get(key) || null;
    }
    
    /**
     * Checks if an area is occupied.
     */
    isAreaOccupied(tileX: number, tileY: number, width: number, height: number): boolean {
        for (let x = tileX; x < tileX + width; x++) {
            for (let y = tileY; y < tileY + height; y++) {
                if (this.occupancyMap.has(`${x},${y}`)) {
                    return true; // Area is occupied
                }
            }
        }
        return false; // Area is not occupied
    }
    
    /**
     * Checks if a tile is within the map bounds.
     */
    isValidTile(tileX: number, tileY: number): boolean {
        return tileX >= 0 && tileX < this.mapWidth && tileY >= 0 && tileY < this.mapHeight;
    }
    
    /**
     * Gets a random valid tile for enemy spawning.
     */
    getEnemySpawnPoint(): { x: number, y: number } | null {
        const spawnTile = this.findValidPlacement(1, 1); // Assuming 1x1 enemy size
        return spawnTile ? this.tileToWorld(spawnTile.tileX, spawnTile.tileY) : null;
    }
}