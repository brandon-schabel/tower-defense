import Phaser from "phaser";
import { GameScene } from "../scenes/game-scene";
import { GameCoordinator } from "../core/game-coordinator";
import { GameState } from "./game-state";

/**
 * Responsible for bootstrapping the GameScene by creating and managing
 * the GameCoordinator and providing proxied access to game systems.
 */
export class GameSceneBootstrapper {
    private scene: GameScene;
    private gameCoordinator: GameCoordinator;

    constructor(scene: GameScene) {
        this.scene = scene;
        
        // Add debug logging to help identify initialization issues
        console.log("[GameSceneBootstrapper] Beginning bootstrapping process");
        
        try {
            // Make sure we have a properly sized world
            const worldBounds = this.scene.physics.world.bounds;
            console.log(`[GameSceneBootstrapper] World bounds: ${worldBounds.width}x${worldBounds.height}`);
            
            // Debug camera setup
            console.log(`[GameSceneBootstrapper] Camera dimensions: ${this.scene.cameras.main.width}x${this.scene.cameras.main.height}`);
    
            // Create the game coordinator which manages all systems
            console.log("[GameSceneBootstrapper] Creating GameCoordinator...");
            this.gameCoordinator = new GameCoordinator(this.scene);
            console.log("[GameSceneBootstrapper] GameCoordinator created successfully");
            
            // Show a welcome message to confirm rendering is working
            this.showMessage("Game initialized!", 0x00ff00);
            console.log("[GameSceneBootstrapper] Initialization complete");
        } catch (error) {
            console.error("[GameSceneBootstrapper] Error during initialization:", error);
            throw error;
        }
    }

    /**
     * Update loop - delegates to GameCoordinator
     */
    public update(time: number, delta: number): void {
        try {
            this.gameCoordinator.update(time, delta);
        } catch (error) {
            console.error("[GameSceneBootstrapper] Error in update:", error);
        }
    }

    /**
     * Display a message on screen
     */
    public showMessage(text: string, color: number = 0xffffff, fontSize: string = '32px'): void {
        try {
            this.gameCoordinator.getUIManager().showMessage(text, color, fontSize);
        } catch (error) {
            console.error("[GameSceneBootstrapper] Error showing message:", error);
            
            // Fallback to direct text display if UI manager fails
            const x = this.scene.cameras.main.width / 2;
            const y = this.scene.cameras.main.height / 2;
            
            this.scene.add.text(x, y, text, {
                fontSize: fontSize,
                color: '#' + color.toString(16).padStart(6, '0')
            }).setOrigin(0.5);
        }
    }

    /**
     * Display a pickup message on screen
     */
    public showPickupMessage(message: string): void {
        try {
            this.gameCoordinator.getUIManager().showPickupMessage(message);
        } catch (error) {
            console.error("[GameSceneBootstrapper] Error showing pickup message:", error);
        }
    }

    /**
     * Remove a tower from the game
     */
    public removeTower(tower: any): void {
        try {
            this.gameCoordinator.getEntityManager().removeTower(tower);
        } catch (error) {
            console.error("[GameSceneBootstrapper] Error removing tower:", error);
        }
    }

    /**
     * Toggle the inventory UI
     */
    public toggleInventoryUI(): void {
        try {
            this.gameCoordinator.getUIManager().toggleInventoryUI();
        } catch (error) {
            console.error("[GameSceneBootstrapper] Error toggling inventory UI:", error);
        }
    }

    /**
     * Get the list of enemies
     */
    public getEnemies(): Phaser.Physics.Arcade.Sprite[] {
        try {
            return this.gameCoordinator.getEntityManager().getEnemies();
        } catch (error) {
            console.error("[GameSceneBootstrapper] Error getting enemies:", error);
            return [];
        }
    }

    /**
     * Get the current round number
     */
    public getCurrentRound(): number {
        try {
            return this.gameCoordinator.getRoundSystem().getCurrentRound();
        } catch (error) {
            console.error("[GameSceneBootstrapper] Error getting current round:", error);
            return 0;
        }
    }

    /**
     * Trigger game over
     */
    public gameOver(): void {
        try {
            this.gameCoordinator.getEntityManager().gameOver();
        } catch (error) {
            console.error("[GameSceneBootstrapper] Error in game over:", error);
        }
    }

    /**
     * Get the game state
     */
    public getGameState(): GameState {
        try {
            return this.gameCoordinator.getGameState();
        } catch (error) {
            console.error("[GameSceneBootstrapper] Error getting game state:", error);
            throw error;
        }
    }

    /**
     * Cleanup resources
     */
    public cleanup(): void {
        try {
            this.gameCoordinator.cleanup();
            console.log("[GameSceneBootstrapper] Resources cleaned up");
        } catch (error) {
            console.error("[GameSceneBootstrapper] Error during cleanup:", error);
        }
    }
}