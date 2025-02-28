import GameScene from "../scenes/game-scene";
import EntityManager from "../managers/entity-manager";
import RoundManager from "../systems/round-manager";
import BuildSystem from "../systems/build-system";
import TowerManager from "../managers/tower-manager";
import CombatSystem from "../systems/combat-system";
import ItemDropManager from "../managers/item-drop-manager";
import UIManager from "../managers/ui-manager";
import GameState from "../utils/game-state";
import { EventBus } from "./event-bus";
import { DifficultyLevel } from "../settings";
import TileMapManager from '../managers/tile-map-manager';

/**
 * GameCoordinator acts as a central hub for accessing all game managers
 * through dependency injection.
 */
export default class GameCoordinator {
    private scene: GameScene;
    private entityManager: EntityManager;
    private roundManager: RoundManager;
    private buildController: BuildSystem;
    private towerManager: TowerManager;
    private combatSystem: CombatSystem;
    private itemDropManager: ItemDropManager;
    private uiManager: UIManager;
    private gameState: GameState;
    private eventBus: EventBus;
    private difficultyLevel: DifficultyLevel;
    private tileMapManager: TileMapManager;
    
    constructor(
        scene: GameScene,
        entityManager: EntityManager,
        roundManager: RoundManager,
        buildController: BuildSystem,
        towerManager: TowerManager,
        combatSystem: CombatSystem,
        itemDropManager: ItemDropManager,
        gameState: GameState,
        eventBus: EventBus,
        tileMapManager: TileMapManager,
        uiManager: UIManager
    ) {
        this.scene = scene;
        this.gameState = gameState;
        this.entityManager = entityManager;
        this.roundManager = roundManager;
        this.buildController = buildController;
        this.towerManager = towerManager;
        this.combatSystem = combatSystem;
        this.itemDropManager = itemDropManager;
        this.eventBus = eventBus;
        this.difficultyLevel = scene.getDifficultyLevel();
        this.tileMapManager = tileMapManager;
        this.uiManager = uiManager;
        
        // Setup event handlers
        this.setupEventHandlers();
    }
    
    private setupEventHandlers(): void {
        // Handle enemy kills
        this.eventBus.on('enemy-killed', (x: number, y: number) => {
            if (Math.random() < 0.3) { // Example drop chance
                this.itemDropManager.dropRandomItem(x, y);
            }
        });
        
        // Handle round end
        this.eventBus.on('round-end', (data: any) => {
            this.uiManager.showMessage(`Round ${data.roundNumber} Complete!`, 0xffff00);
            
            // Show bonus info
            if (data.bonus) {
                this.uiManager.showMessage(`+${data.bonus} Resources`, 0xffff00);
            }
            
            // Show healing info
            if (data.healing) {
                this.uiManager.showMessage(`+${data.healing} Health Restored`, 0x00ff00);
            }
        });
    }
    
    public initGame(isNewGame: boolean): void {
        if (!isNewGame) {
            this.gameState.loadFromLocalStorage();
        }
        
        // Apply research effects
        this.applyResearchEffects();
    }
    
    private applyResearchEffects(): void {
        const researchTree = this.uiManager.getHUD().getResearchTree();
        const towerDamageLevel = researchTree.getResearchLevel('tower-damage-1');
        if (towerDamageLevel > 0) {
            console.log(`Applying tower damage research level: ${towerDamageLevel}`);
        }
    }
    
    public update(): void {
        // Update all systems that need per-frame updates
        this.entityManager.update();
        this.towerManager.update();
        this.uiManager.update();
        
        // Check round completion
        this.roundManager.checkRoundCompletion();
    }
    
    // Getters for managers
    public getUIManager(): UIManager {
        return this.uiManager;
    }
    
    public getEntityManager(): EntityManager {
        return this.entityManager;
    }
    
    public getRoundManager(): RoundManager {
        return this.roundManager;
    }
    
    public getBuildController(): BuildSystem {
        return this.buildController;
    }
    
    public getTowerManager(): TowerManager {
        return this.towerManager;
    }
    
    public setDifficulty(level: DifficultyLevel): void {
        this.difficultyLevel = level;
    }
    
    public getDifficultyLevel(): DifficultyLevel {
        return this.difficultyLevel;
    }

    public getItemDropManager(): ItemDropManager {
        return this.itemDropManager;
    }

    public getTileMapManager(): TileMapManager {
        return this.tileMapManager;
    }

    public getEventBus(): EventBus {
        return this.eventBus;
    }
}