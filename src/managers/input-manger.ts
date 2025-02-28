import Phaser from "phaser";
import GameScene from "../scenes/game-scene";
import { EventBus } from "../core/event-bus";

export class InputManager {
    private scene: GameScene;
    private actionHandlers: Map<string, Function[]> = new Map();
    public keyMappings: { [key: string]: Phaser.Input.Keyboard.Key } = {};
    private pendingKeyMappings: { [key: string]: string } = {};
    private eventBus: EventBus;

    constructor(scene: GameScene, keyMappings: { [key: string]: string }, eventBus?: EventBus) {
        this.scene = scene;
        this.pendingKeyMappings = keyMappings || {};
        this.eventBus = eventBus || new EventBus();
        
        // Initialize key mappings once the scene is ready
        if (this.scene.input?.keyboard) {
            this.initializeKeyMappings();
        } else if (this.scene.events) {
            // Only attach to events if it exists
            this.scene.events.once('create', () => {
                this.initializeKeyMappings();
            });
        } else {
            // Fallback: Try to initialize later when the scene might be ready
            setTimeout(() => this.initializeKeyMappings(), 100);
        }
    }

    private initializeKeyMappings(): void {
        for (const [action, key] of Object.entries(this.pendingKeyMappings)) {
            if (this.scene.input && this.scene.input.keyboard) {
                this.keyMappings[action] = this.scene.input.keyboard.addKey(key);
            }
        }
        
        // Emit event when input manager is ready
        this.eventBus.emit('input-manager-ready', this);
    }

    /**
     * Register a handler for a specific action
     */
    public onAction(action: string, handler: Function): void {
        if (!this.actionHandlers.has(action)) {
            this.actionHandlers.set(action, []);
        }
        
        const handlers = this.actionHandlers.get(action);
        if (handlers) {
            handlers.push(handler);
        }
    }

    /**
     * Remove a handler for a specific action
     */
    public removeAction(action: string, handler: Function): void {
        if (!this.actionHandlers.has(action)) return;
        
        const handlers = this.actionHandlers.get(action);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index !== -1) {
                handlers.splice(index, 1);
            }
        }
    }

    /**
     * Check for key presses and trigger the corresponding action handlers
     */
    public update(): void {
        for (const [action, key] of Object.entries(this.keyMappings)) {
            if (Phaser.Input.Keyboard.JustDown(key)) {
                const handlers = this.actionHandlers.get(action);
                if (handlers) {
                    handlers.forEach(handler => handler());
                }
                
                // Emit event for key pressed
                this.eventBus.emit(`key-${action}`, { action });
            }
        }
    }

    /**
     * Get a key mapping for a specific action
     */
    public getKeyMapping(action: string): Phaser.Input.Keyboard.Key | undefined {
        return this.keyMappings[action];
    }

    /**
     * Set a key mapping for a specific action
     */
    public setKeyMapping(action: string, key: string): void {
        // Remove old key if it exists
        if (this.keyMappings[action]) {
            this.keyMappings[action].reset();
        }
        
        // Create new key mapping
        if (this.scene.input && this.scene.input.keyboard) {
            this.keyMappings[action] = this.scene.input.keyboard.addKey(key);
            
            // Update the pending key mappings for potential reset
            this.pendingKeyMappings[action] = key;
            
            // Emit event for key mapping change
            this.eventBus.emit('key-mapping-changed', { action, key });
        }
    }

    /**
     * Reset all key mappings to their default values
     */
    public resetKeyMappings(): void {
        // Clear existing key mappings
        for (const key of Object.values(this.keyMappings)) {
            key.reset();
        }
        
        // Reinitialize with pending key mappings
        this.initializeKeyMappings();
    }
}