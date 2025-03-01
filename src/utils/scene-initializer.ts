import Phaser from "phaser";
import { GAME_SETTINGS } from "../settings";

export class SceneInitializer {
    private scene: Phaser.Scene;
    private assetsLoaded: { [key: string]: boolean } = {};

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    public preloadAssets(): void {
        console.log("[SceneInitializer] Preloading assets...");
        
        try {
            // Load all assets for the game with proper SVG handling
            this.preloadSprites();
            this.preloadAudio();
            this.preloadTiles();
            this.preloadItems();
            this.preloadUI();
            this.loadPowerUps();
            this.loadCrateAssets();
            
            console.log("[SceneInitializer] Asset preload started successfully");
        } catch (error) {
            console.error("[SceneInitializer] Error during asset preload:", error);
        }
    }

    private preloadSprites(): void {
        console.log("[SceneInitializer] Preloading sprite assets...");
        
        try {
            // Load sprites for entities with SVG options
            this.loadSvgAsset('player', 'assets/player.svg');
            this.loadSvgAsset('base', 'assets/base.svg'); 
            this.loadSvgAsset('projectile', 'assets/projectile.svg');

            // Tower sprites
            if (GAME_SETTINGS.towers) {
                Object.keys(GAME_SETTINGS.towers).forEach(towerType => {
                    this.loadSvgAsset(towerType, `assets/towers/${towerType}-tower.svg`);
                });
            } else {
                console.warn("[SceneInitializer] GAME_SETTINGS.towers is undefined, skipping tower assets");
                // Load some default tower types
                this.loadSvgAsset('normal', 'assets/towers/normal-tower.svg');
                this.loadSvgAsset('sniper', 'assets/towers/sniper-tower.svg');
                this.loadSvgAsset('area', 'assets/towers/area-tower.svg');
            }

            // Enemy sprites
            if (GAME_SETTINGS.enemies) {
                Object.keys(GAME_SETTINGS.enemies).forEach(enemyType => {
                    this.loadSvgAsset(`${enemyType}-enemy`, `assets/enemies/${enemyType}-enemy.svg`);
                });
            } else {
                console.warn("[SceneInitializer] GAME_SETTINGS.enemies is undefined, skipping enemy assets");
                // Load some default enemy types
                this.loadSvgAsset('normal-enemy', 'assets/enemies/normal-enemy.svg');
                this.loadSvgAsset('fast-enemy', 'assets/enemies/fast-enemy.svg');
                this.loadSvgAsset('heavy-enemy', 'assets/enemies/heavy-enemy.svg');
            }
        } catch (error) {
            console.error("[SceneInitializer] Error loading sprite assets:", error);
        }
    }
    
    /**
     * Helper method to load SVG assets with proper options
     */
    private loadSvgAsset(key: string, path: string): void {
        try {
            // Use XHR loader to get the SVG data directly
            this.scene.load.svg(key, path);
            this.assetsLoaded[key] = true;
            console.log(`[SceneInitializer] Queued SVG asset for loading: ${key} (${path})`);
        } catch (error) {
            console.error(`[SceneInitializer] Error queuing SVG asset ${key}:`, error);
            this.assetsLoaded[key] = false;
        }
    }

    private preloadAudio(): void {
        try {
            // Load sound effects
            this.scene.load.audio('shoot', 'assets/audio/shoot.wav');
            this.scene.load.audio('hit', 'assets/audio/hit.wav');
            this.scene.load.audio('explosion', 'assets/audio/explosion.wav');
            this.scene.load.audio('pickup', 'assets/audio/pickup.wav');
        } catch (error) {
            console.error("[SceneInitializer] Error loading audio assets:", error);
        }
    }

    private preloadTiles(): void {
        try {
            // Load tilemap assets
            this.loadSvgAsset('terrain-tiles', 'assets/terrain-tiles.svg');
        } catch (error) {
            console.error("[SceneInitializer] Error loading tile assets:", error);
        }
    }

    private preloadItems(): void {
        try {
            // Load item sprites
            this.loadSvgAsset('blueprint-area', 'assets/items/blueprint-area.svg');
            this.loadSvgAsset('blueprint-normal', 'assets/items/blueprint-normal.svg');
            this.loadSvgAsset('blueprint-sniper', 'assets/items/blueprint-sniper.svg');
            this.loadSvgAsset('health-small', 'assets/items/health-small.svg');
            this.loadSvgAsset('health-medium', 'assets/items/health-medium.svg');
            this.loadSvgAsset('health-large', 'assets/items/health-large.svg');
            this.loadSvgAsset('resource-large', 'assets/items/resource-large.svg');
            this.loadSvgAsset('resource-medium', 'assets/items/resource-medium.svg');
            this.loadSvgAsset('resource-small', 'assets/items/resource-small.svg');
            this.loadSvgAsset('upgrade-base-armor', 'assets/items/upgrade-base-armor.svg');
            this.loadSvgAsset('upgrade-player-speed', 'assets/items/upgrade-player-speed.svg');
            this.loadSvgAsset('upgrade-tower-damage', 'assets/items/upgrade-tower-damage.svg');
            
            // inventory
            this.loadSvgAsset("inventory-bg", "assets/ui/inventory-bg.svg");
            this.loadSvgAsset("inventory-slot", "assets/ui/inventory-slot.svg");

            // Weapon sprites
            this.loadSvgAsset('weapon-blaster', 'assets/items/weapon-blaster.svg');
            this.loadSvgAsset('weapon-rapid', 'assets/items/weapon-rapid.svg');
            this.loadSvgAsset('weapon-cannon', 'assets/items/weapon-cannon.svg');
        } catch (error) {
            console.error("[SceneInitializer] Error loading item assets:", error);
        }
    }

    private preloadUI(): void {
        try {
            // Load UI elements
            this.loadSvgAsset('button', 'assets/ui/button.svg');
            this.loadSvgAsset('panel', 'assets/ui/panel.svg');
            this.loadSvgAsset('health-bar', 'assets/ui/health-bar.svg');
            this.loadSvgAsset('health-bar-bg', 'assets/ui/health-bar-bg.svg');
        } catch (error) {
            console.error("[SceneInitializer] Error loading UI assets:", error);
        }
    }

    private loadPowerUps(): void {
        try {
            // Power-up assets
            this.loadSvgAsset('powerup-speed', 'assets/powerups/speed-powerup.svg');
            this.loadSvgAsset('powerup-damage', 'assets/powerups/damage-powerup.svg');
            this.loadSvgAsset('powerup-range', 'assets/powerups/range-powerup.svg');
            this.loadSvgAsset('powerup-health', 'assets/powerups/health-powerup.svg');
            this.loadSvgAsset('powerup-invincibility', 'assets/powerups/invincibility-powerup.svg');
            this.loadSvgAsset('powerup-resources', 'assets/powerups/resources-powerup.svg');
            this.loadSvgAsset('powerup-default', 'assets/powerups/default-powerup.svg');
        } catch (error) {
            console.error("[SceneInitializer] Error loading powerup assets:", error);
        }
    }

    private loadCrateAssets(): void {
        try {
            this.loadSvgAsset('crate-wood', 'assets/crates/wood-crate.svg');
            this.loadSvgAsset('crate-metal', 'assets/crates/metal-crate.svg');
            this.loadSvgAsset('crate-gold', 'assets/crates/gold-crate.svg');
        } catch (error) {
            console.error("[SceneInitializer] Error loading crate assets:", error);
        }
    }

    public setupWorld(): void {
        try {
            // Set up the physics world
            this.scene.physics.world.setBounds(
                0, 0,
                GAME_SETTINGS.map.width * GAME_SETTINGS.map.tileSize,
                GAME_SETTINGS.map.height * GAME_SETTINGS.map.tileSize
            );

            // Set camera bounds
            this.scene.cameras.main.setBounds(
                0, 0,
                GAME_SETTINGS.map.width * GAME_SETTINGS.map.tileSize,
                GAME_SETTINGS.map.height * GAME_SETTINGS.map.tileSize
            );
            
            console.log(`[SceneInitializer] World setup complete: ${GAME_SETTINGS.map.width * GAME_SETTINGS.map.tileSize}x${GAME_SETTINGS.map.height * GAME_SETTINGS.map.tileSize}`);
        } catch (error) {
            console.error("[SceneInitializer] Error setting up world:", error);
        }
    }

    public setupBackground(): void {
        try {
            // Create a simple background
            const bg = this.scene.add.rectangle(
                0, 0,
                GAME_SETTINGS.map.width * GAME_SETTINGS.map.tileSize * 2,
                GAME_SETTINGS.map.height * GAME_SETTINGS.map.tileSize * 2,
                0x87CEEB
            );
            bg.setOrigin(0);
            bg.setDepth(-10);
            
            // Add a grid for visual reference
            const gridGraphics = this.scene.add.graphics();
            gridGraphics.lineStyle(1, 0xffffff, 0.2);
            
            // Draw vertical lines
            for (let x = 0; x <= GAME_SETTINGS.map.width; x++) {
                gridGraphics.moveTo(x * GAME_SETTINGS.map.tileSize, 0);
                gridGraphics.lineTo(x * GAME_SETTINGS.map.tileSize, GAME_SETTINGS.map.height * GAME_SETTINGS.map.tileSize);
            }
            
            // Draw horizontal lines
            for (let y = 0; y <= GAME_SETTINGS.map.height; y++) {
                gridGraphics.moveTo(0, y * GAME_SETTINGS.map.tileSize);
                gridGraphics.lineTo(GAME_SETTINGS.map.width * GAME_SETTINGS.map.tileSize, y * GAME_SETTINGS.map.tileSize);
            }
            
            gridGraphics.strokePath();
            gridGraphics.setDepth(-9);
            
            console.log("[SceneInitializer] Background setup complete");
        } catch (error) {
            console.error("[SceneInitializer] Error setting up background:", error);
        }
    }
}