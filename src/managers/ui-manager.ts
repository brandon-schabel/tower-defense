import GameScene from "../scenes/game-scene";
import HUD from "../ui/hud";
import InventoryUI from "../ui/inventory-ui";
import Tower from "../entities/tower/tower";
import EntityManager from "./entity-manager";
import { EventBus } from "../core/event-bus";

export default class UIManager {
    private scene: GameScene;
    private hud: HUD;
    private inventoryUI: InventoryUI;
    private isInventoryVisible: boolean = false;
    private entityManager: EntityManager;
    private eventBus: EventBus;
    
    constructor(scene: GameScene, entityManager: EntityManager, eventBus: EventBus) {
        this.scene = scene;
        this.entityManager = entityManager;
        this.eventBus = eventBus;
        
        // Initialize UI components
        this.hud = new HUD(scene);
        
        // Get player from entity manager
        const player = this.entityManager.getUser();
        
        // Initialize inventory UI with player's inventory if player exists
        if (player) {
            this.inventoryUI = new InventoryUI(scene, player.getInventory());
        } else {
            // Create a default inventory UI with null inventory
            console.warn("Player not found when initializing UI. Using default inventory.");
            this.inventoryUI = new InventoryUI(scene, null);
        }
        this.inventoryUI.hide();
        
        // Set up event listeners
        this.setupEventListeners();
    }
    
    private setupEventListeners(): void {
        this.eventBus.on('tower-selected', (tower: Tower) => {
            this.updateTowerStats(tower);
        });
        
        this.eventBus.on('tower-deselected', () => {
            this.updateTowerStats(null);
        });
        
        this.eventBus.on('tower-upgraded', (tower: Tower) => {
            this.updateTowerStats(tower);
            this.updateResources();
        });
        
        this.eventBus.on('resources-changed', () => {
            this.updateResources();
        });
    }
    
    public getHUD(): HUD {
        return this.hud;
    }
    
    public showPickupMessage(message: string): void {
        const text = this.scene.add.text(
            this.scene.cameras.main.worldView.centerX,
            this.scene.cameras.main.worldView.centerY - 50,
            message,
            { fontSize: '24px', color: '#ffffff' }
        ).setOrigin(0.5);

        this.scene.tweens.add({
            targets: text,
            alpha: 0,
            y: text.y - 50,
            duration: 1000,
            onComplete: () => text.destroy()
        });
    }
    
    public showMessage(text: string, color: number = 0xffffff, fontSize: string = '32px'): void {
        const message = this.scene.add.text(
            this.scene.cameras.main.worldView.centerX,
            this.scene.cameras.main.worldView.centerY - 50,
            text,
            {
                fontSize,
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 6,
                align: 'center'
            }
        ).setOrigin(0.5);

        message.setTint(color);

        this.scene.tweens.add({
            targets: message,
            alpha: 0,
            y: message.y - 100,
            duration: 1000,
            onComplete: () => message.destroy()
        });
    }
    
    public toggleInventoryUI(): void {
        this.isInventoryVisible = !this.isInventoryVisible;

        if (this.isInventoryVisible) {
            this.inventoryUI.show();
        } else {
            this.inventoryUI.hide();
        }
    }
    
    public updateTowerStats(tower: Tower | null): void {
        this.hud.updateTowerStats(tower);
    }
    
    public updatePlayerStats(): void {
        this.hud.updatePlayerStats();
    }
    
    public updateResources(): void {
        this.hud.updateResources();
    }
    
    public disableRoundButton(): void {
        this.hud.disableRoundButton();
    }
    
    public showNextRoundButton(callback: () => void): void {
        this.hud.showNextRoundButton(callback);
    }
    
    public update(): void {
        if (this.hud) {
            this.hud.updateResources();
        }
    }
}