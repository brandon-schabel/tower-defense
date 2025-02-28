import Phaser from "phaser";
import GameScene from "../scenes/game-scene";
import ServiceLocator from "../utils/service-locator";

export class InputManager {
    private scene: GameScene;
    public keyMappings: Record<string, Phaser.Input.Keyboard.Key> = {}; // Initialize as empty object
    private actionHandlers: Record<string, Function> = {};
    private pendingKeyMappings: Record<string, string>;

    constructor(scene: GameScene, keyMappings: Record<string, string>) {
        this.scene = scene;
        this.pendingKeyMappings = keyMappings;

        // Wait for scene to be ready before initializing key mappings
        if (this.scene.input && this.scene.input.keyboard) {
            this.initializeKeyMappings();
        } else {
            // Add a safeguard to check if events exists
            if (this.scene.events) {
                this.scene.events.once('create', () => {
                    this.initializeKeyMappings();
                });
            } else {
                // If events is not available, use a different approach
                // Set up a one-time check in the update loop
                const checkForInitialization = () => {
                    if (this.scene.input && this.scene.input.keyboard) {
                        this.initializeKeyMappings();
                        return true; // Signal that we're done
                    }
                    return false;
                };

                // Try immediately
                if (!checkForInitialization()) {
                    // If still not ready, set up a one-time check on the next frame
                    const originalUpdate = this.update.bind(this);
                    this.update = () => {
                        if (checkForInitialization()) {
                            // Restore original update once initialized
                            this.update = originalUpdate;
                        }
                        originalUpdate();
                    };
                }
            }
        }
        
        // Register with service locator
        ServiceLocator.getInstance().register('inputManager', this);
    }

    private initializeKeyMappings(): void {
        if (!this.scene.input || !this.scene.input.keyboard) {
            console.warn("InputManager: Cannot initialize key mappings - keyboard not available");
            return;
        }

        this.keyMappings = Object.entries(this.pendingKeyMappings).reduce((acc, [action, key]) => {
            acc[action] = this.scene.input.keyboard!.addKey(key);
            return acc;
        }, {} as Record<string, Phaser.Input.Keyboard.Key>);
    }

    onAction(action: string, handler: Function): void {
        this.actionHandlers[action] = handler;
    }

    update(): void {
        Object.entries(this.keyMappings).forEach(([action, key]) => {
            if (key && Phaser.Input.Keyboard.JustDown(key) && this.actionHandlers[action]) {
                this.actionHandlers[action]();
            }
        });
    }
}