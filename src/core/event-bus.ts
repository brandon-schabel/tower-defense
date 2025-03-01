// src/core/event-bus.ts (enhanced)
import { EventEmitter } from 'events';

// Define all event types to improve type safety
export enum GameEvents {
    // Game flow events
    START_GAME = 'start-game',
    GAME_OVER = 'game-over',
    PAUSE_GAME = 'pause-game',
    RESUME_GAME = 'resume-game',

    // Round events
    START_ROUND = 'start-round',
    START_NEXT_ROUND = 'start-next-round',
    ROUND_COMPLETED = 'round-completed',
    ROUND_TRANSITION_TO_BUILD = 'round-transition-to-build',
    ROUND_STARTED = 'round-started',
    ROUND_ENDED = 'round-ended',

    // Enemy events
    ENEMY_SPAWNED = 'enemy-spawned',
    ENEMY_KILLED = 'enemy-killed',
    ENEMY_DEFEATED = 'enemy-defeated',
    ENEMY_DAMAGED = 'enemy-damaged',

    // Tower events
    TOWER_PLACED = 'tower-placed',
    TOWER_SELECTED = 'tower-selected',
    TOWER_DESELECTED = 'tower-deselected',
    TOWER_UPGRADED = 'tower-upgraded',
    TOWER_DAMAGED = 'tower-damaged',
    TOWER_TIER_UPGRADED = 'tower-tier-upgraded',

    // Player events
    PLAYER_DAMAGED = 'player-damaged',
    PLAYER_SHOT = 'player-shot',
    PLAYER_UPGRADED = 'player-upgraded',
    PLAYER_BUFF_ADDED = 'player-buff-added',
    PLAYER_BUFF_EXPIRED = 'player-buff-expired',

    // Item events
    ITEM_PICKED_UP = 'item-picked-up',
    ITEM_USED = 'item-used',
    ITEM_EQUIPPED = 'item-equipped',

    // UI events
    UPDATE_RESOURCES = 'update-resources',
    RESOURCES_CHANGED = 'resources-changed',
    BUILD_MODE_ENTERED = 'build-mode-entered',
    BUILD_MODE_EXITED = 'build-mode-exited',

    // System events
    REFRESH_COLLISIONS = 'refresh-collisions',
    TOGGLE_DEBUG_MODE = 'toggle-debug-mode',

    // Base events
    BASE_DAMAGED = 'base-damaged',
    BASE_HEALED = 'base-healed'
}

export class EventBus extends EventEmitter {
    constructor() {
        super();
        // Increase max listeners to avoid warnings with many systems
        this.setMaxListeners(50);
    }

    // Typed emit method for better type safety
    public emitEvent<T>(event: GameEvents, data?: T): void {
        this.emit(event, data);
    }

    // Typed on method for better type safety
    public onEvent<T>(event: GameEvents, listener: (data: T) => void): void {
        this.on(event, listener);
    }

    // Remove a specific event listener
    public offEvent<T>(event: GameEvents, listener: (data: T) => void): void {
        this.off(event, listener);
    }

    // Create type-safe shortcuts for common events
    public onRoundStart(listener: () => void): void {
        this.on(GameEvents.START_ROUND, listener);
    }

    public onRoundEnd(listener: (roundNumber: number) => void): void {
        this.on(GameEvents.ROUND_ENDED, listener);
    }

    public onGameOver(listener: (data: any) => void): void {
        this.on(GameEvents.GAME_OVER, listener);
    }

    // Add a logger to help debug events during development
    public enableEventLogging(): void {
        const originalEmit = this.emit;
        this.emit = function (type: string | symbol, ...args: any[]): boolean {
            console.log(`[EVENT] ${String(type)}`, ...args);
            return originalEmit.apply(this, [type, ...args]);
        };
    }
}