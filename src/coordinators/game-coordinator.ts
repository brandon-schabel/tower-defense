// src/coordinators/game-coordinator.ts
import Phaser from "phaser";
import GameScene from "../scenes/game-scene";
import EntityManager from "../managers/entity-manager";
import RoundManager from "../managers/round-manager";
import BuildController from "../managers/build-controller";
import TowerManager from "../managers/tower-manager";
import CombatSystem from "../systems/combat-system";
import ItemDropManager from "../managers/item-drop-manager";
import UIManager from "../managers/ui-manager";
import GameState from "../utils/game-state";
import { EventBus } from "../utils/event-bus";
import { DifficultyLevel } from "../settings";
import ServiceLocator from "../utils/service-locator";
import TileMapManager from '../managers/tile-map-manager';

/**
 * GameCoordinator acts as a central hub for accessing all game managers
 * through the service locator pattern.
 */
export default class GameCoordinator {
    private scene: GameScene;
    private entityManager: EntityManager;
    private roundManager: RoundManager;
    private buildController: BuildController;
    private towerManager: TowerManager;
    private combatSystem: CombatSystem;
    private itemDropManager: ItemDropManager;
    private uiManager: UIManager;
    private gameState: GameState;
    private eventBus: EventBus;
    private difficultyLevel: DifficultyLevel;
    
    constructor(scene: GameScene) {
        this.scene = scene;
        
        // Get references to all managers
        this.gameState = scene.getGameState();
        this.entityManager = scene.getEntityManager();
        this.roundManager = scene.getRoundManager();
        this.buildController = scene.getBuildController();
        this.towerManager = scene.getTowerManager();
        this.combatSystem = scene.getCombatSystem();
        this.itemDropManager = scene.getItemDropManager();
        this.eventBus = scene.eventBus;
        this.difficultyLevel = scene.getDifficultyLevel();
        
        // Create UI Manager
        this.uiManager = new UIManager(scene);
        
        // Register with service locator
        const serviceLocator = ServiceLocator.getInstance();
        serviceLocator.register('gameCoordinator', this);
        serviceLocator.register('gameState', this.gameState);
        serviceLocator.register('entityManager', this.entityManager);
        serviceLocator.register('roundManager', this.roundManager);
        serviceLocator.register('buildController', this.buildController);
        serviceLocator.register('towerManager', this.towerManager);
        serviceLocator.register('combatSystem', this.combatSystem);
        serviceLocator.register('itemDropManager', this.itemDropManager);
        serviceLocator.register('uiManager', this.uiManager);
        serviceLocator.register('eventBus', this.eventBus);
        
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
    
    public getBuildController(): BuildController {
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
        return ServiceLocator.getInstance().get<TileMapManager>('tileMapManager')!;
    }

    public getEventBus(): EventBus {
        return this.eventBus;
    }
}