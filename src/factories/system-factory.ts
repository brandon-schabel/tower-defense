import { GameScene } from "../scenes/game-scene";
import { EntityManager } from "../managers/entity-manager";
import { EventBus } from "../core/event-bus";
import { GameState } from "../utils/game-state";
import { TileMapManager } from "../managers/tile-map-manager";
import { ItemDropManager } from "../managers/item-drop-manager";
import { CollisionSystem } from "../systems/collision-system";
import { GameCoordinator } from "../core/game-coordinator";

/**
 * SystemFactory creates and initializes all game systems in the correct order,
 * handling dependency injection and system composition.
 */
export class SystemFactory {
    private scene: GameScene;
    private eventBus: EventBus;
    private gameState: GameState;

    constructor(scene: GameScene, eventBus: EventBus, gameState: GameState) {
        this.scene = scene;
        this.eventBus = eventBus;
        this.gameState = gameState;
    }

    /**
     * Create all game systems and return a fully configured GameCoordinator
     */
    public createGameSystems(): GameCoordinator {
        console.log("SystemFactory: Creating all game systems");

        // Create base systems
        const tileMapManager = new TileMapManager(this.scene);

        // Place decorative tiles
        this.placeDecorativeTiles(tileMapManager);

        // Create entity manager first (manages all game entities)
        const entityManager = new EntityManager(
            this.scene,
            tileMapManager,
            this.eventBus,
            this.gameState
        );

        // Create item drop manager
        const itemDropManager = new ItemDropManager(
            this.scene,
            tileMapManager,
            this.eventBus
        );

        // Create our new collision system
        const collisionSystem = new CollisionSystem(
            this.scene,
            entityManager,
            this.eventBus
        );

        // Set dependencies in entity manager
        entityManager.setItemDropManager(itemDropManager);
        entityManager.setCombatSystem(collisionSystem); // We'll use compatibility mode temporarily

        // Complete entity manager initialization
        entityManager.completeInitialization();


        // Create game coordinator with all systems
        const gameCoordinator = new GameCoordinator(
            this.scene,

        );

        console.log("SystemFactory: All systems created successfully");
        return gameCoordinator;
    }

    /**
     * Place decorative tiles on the map
     */
    private placeDecorativeTiles(tileMapManager: TileMapManager): void {
        const GAME_SETTINGS = this.scene.registry.get('GAME_SETTINGS') || {
            map: { decorationCount: 50 }
        };

        for (let i = 0; i < GAME_SETTINGS.map.decorationCount; i++) {
            const decorType = Phaser.Math.RND.pick(['bush', 'tree', 'rock']);
            const decorSize = decorType === 'tree' ? 2 : 1;

            const position = tileMapManager.findValidPlacement(decorSize, decorSize);
            if (position) {
                const worldPos = tileMapManager.tileToWorld(position.tileX, position.tileY);

                this.scene.add.image(worldPos.x, worldPos.y, decorType);

                tileMapManager.occupyTiles(
                    position.tileX, position.tileY,
                    decorSize, decorSize,
                    'decoration', `decor_${i}`
                );
            }
        }
    }
}