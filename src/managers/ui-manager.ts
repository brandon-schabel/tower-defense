import GameScene from "../scenes/game-scene";
import HUD from "../ui/hud";
import InventoryUI from "../ui/inventory-ui";
import Tower from "../entities/tower";
import ServiceLocator from "../utils/service-locator";
import Player from "../entities/player";
import EntityManager from "./entity-manager";

export default class UIManager {
    private scene: GameScene;
    private hud: HUD;
    private inventoryUI: InventoryUI;
    private isInventoryVisible: boolean = false;
    
    constructor(scene: GameScene) {
        this.scene = scene;
        
        // Initialize UI components
        this.hud = new HUD(scene);
        
        // Get player from entity manager
        const entityManager = ServiceLocator.getInstance().get<EntityManager>('entityManager');
        const player = entityManager ? entityManager.getUser() : scene.getUser();
        
        this.inventoryUI = new InventoryUI(scene, player.getInventory());
        this.inventoryUI.hide();
        
        // Register with service locator
        ServiceLocator.getInstance().register('uiManager', this);
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