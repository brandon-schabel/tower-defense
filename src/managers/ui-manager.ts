import { GameScene } from "../scenes/game-scene";
import { HUD } from "../ui/hud";
import { InventoryUI } from "../ui/inventory-ui";
import { Tower } from "../entities/tower/tower";
import { EntityManager } from "./entity-manager";
import { EventBus } from "../core/event-bus";

export class UIManager {
    private scene: GameScene;
    private hud!: HUD;
    private inventoryUI!: InventoryUI;
    private isInventoryVisible: boolean = false;
    private entityManager: EntityManager;
    private eventBus: EventBus;
    
    // UI layer containers for different game states
    private mainMenuUI!: Phaser.GameObjects.Container;
    private gameplayUI!: Phaser.GameObjects.Container;
    private buildUI!: Phaser.GameObjects.Container;
    private combatUI!: Phaser.GameObjects.Container;
    private roundEndUI!: Phaser.GameObjects.Container;
    private gameOverUI!: Phaser.GameObjects.Container;
    private pauseMenuUI!: Phaser.GameObjects.Container;
    
    constructor(scene: GameScene, entityManager: EntityManager, eventBus: EventBus) {
        this.scene = scene;
        this.entityManager = entityManager;
        this.eventBus = eventBus;
        
        // Initialize UI containers first
        this.initializeUIContainers();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Delay HUD initialization until after the scene's create method completes
        // This ensures all entities are fully initialized
        this.scene.time.delayedCall(100, () => {
            // Initialize HUD
            this.hud = new HUD(scene);
            
            // Initialize inventory UI
            try {
                const player = this.entityManager.getUser();
                if (player) {
                    this.inventoryUI = new InventoryUI(scene, player.getInventory(), this.eventBus);
                } else {
                    console.warn("Player not yet available for inventory UI initialization");
                    this.inventoryUI = new InventoryUI(scene, null, this.eventBus);
                }
                
                // Hide inventory UI initially
                this.inventoryUI.hide();
            } catch (error) {
                console.warn("Error initializing inventory UI:", error);
                this.inventoryUI = new InventoryUI(scene, null, this.eventBus);
            }
        });
    }
    
    /**
     * Initialize UI containers for different game states
     */
    private initializeUIContainers(): void {
        // Create containers for each state
        this.mainMenuUI = this.scene.add.container(0, 0);
        this.gameplayUI = this.scene.add.container(0, 0);
        this.buildUI = this.scene.add.container(0, 0);
        this.combatUI = this.scene.add.container(0, 0);
        this.roundEndUI = this.scene.add.container(0, 0);
        this.gameOverUI = this.scene.add.container(0, 0);
        this.pauseMenuUI = this.scene.add.container(0, 0);
        
        // Set depth for UI layers
        this.mainMenuUI.setDepth(100);
        this.gameplayUI.setDepth(100);
        this.buildUI.setDepth(100);
        this.combatUI.setDepth(100);
        this.roundEndUI.setDepth(100);
        this.gameOverUI.setDepth(100);
        this.pauseMenuUI.setDepth(200); // Pause menu appears above everything
        
        // Hide all UI containers initially
        this.hideAllUI();
        
        // Setup UI elements for each state
        this.setupMainMenuUI();
        this.setupGameOverUI();
        this.setupPauseMenuUI();
        
        // Note: Build and combat UI are mostly handled by HUD
    }
    
    /**
     * Hide all UI containers
     */
    private hideAllUI(): void {
        this.mainMenuUI.setVisible(false);
        this.gameplayUI.setVisible(false);
        this.buildUI.setVisible(false);
        this.combatUI.setVisible(false);
        this.roundEndUI.setVisible(false);
        this.gameOverUI.setVisible(false);
        this.pauseMenuUI.setVisible(false);
    }
    
    /**
     * Setup main menu UI
     */
    private setupMainMenuUI(): void {
        const centerX = this.scene.cameras.main.width / 2;
        const centerY = this.scene.cameras.main.height / 2;
        
        // Title
        const title = this.scene.add.text(centerX, centerY - 100, 'TOWER DEFENSE', {
            fontSize: '48px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);
        
        // Start button
        const startButton = this.scene.add.text(centerX, centerY, 'START GAME', {
            fontSize: '32px',
            color: '#ffffff',
            backgroundColor: '#006400',
            padding: { x: 20, y: 10 }
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.eventBus.emit('start-game-requested');
            })
            .on('pointerover', () => startButton.setTint(0xaaffaa))
            .on('pointerout', () => startButton.clearTint());
        
        // Add elements to main menu container
        this.mainMenuUI.add([title, startButton]);
    }
    
    /**
     * Setup game over UI
     */
    private setupGameOverUI(): void {
        const centerX = this.scene.cameras.main.width / 2;
        const centerY = this.scene.cameras.main.height / 2;
        
        // Game over text
        const gameOverText = this.scene.add.text(centerX, centerY - 100, 'GAME OVER', {
            fontSize: '48px',
            color: '#ff0000',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);
        
        // Retry button
        const retryButton = this.scene.add.text(centerX, centerY, 'RETRY', {
            fontSize: '32px',
            color: '#ffffff',
            backgroundColor: '#006400',
            padding: { x: 20, y: 10 }
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.eventBus.emit('retry-game-requested');
            })
            .on('pointerover', () => retryButton.setTint(0xaaffaa))
            .on('pointerout', () => retryButton.clearTint());
        
        // Menu button
        const menuButton = this.scene.add.text(centerX, centerY + 80, 'MAIN MENU', {
            fontSize: '32px',
            color: '#ffffff',
            backgroundColor: '#000064',
            padding: { x: 20, y: 10 }
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.eventBus.emit('return-to-menu-requested');
            })
            .on('pointerover', () => menuButton.setTint(0xaaaaff))
            .on('pointerout', () => menuButton.clearTint());
        
        // Add elements to game over container
        this.gameOverUI.add([gameOverText, retryButton, menuButton]);
    }
    
    /**
     * Setup pause menu UI
     */
    private setupPauseMenuUI(): void {
        const centerX = this.scene.cameras.main.width / 2;
        const centerY = this.scene.cameras.main.height / 2;
        
        // Semi-transparent background
        const bg = this.scene.add.rectangle(
            0, 0, 
            this.scene.cameras.main.width * 2, 
            this.scene.cameras.main.height * 2, 
            0x000000, 0.7
        );
        
        // Paused text
        const pausedText = this.scene.add.text(centerX, centerY - 100, 'PAUSED', {
            fontSize: '48px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);
        
        // Resume button
        const resumeButton = this.scene.add.text(centerX, centerY, 'RESUME', {
            fontSize: '32px',
            color: '#ffffff',
            backgroundColor: '#006400',
            padding: { x: 20, y: 10 }
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.eventBus.emit('resume-game-requested');
            })
            .on('pointerover', () => resumeButton.setTint(0xaaffaa))
            .on('pointerout', () => resumeButton.clearTint());
        
        // Menu button
        const menuButton = this.scene.add.text(centerX, centerY + 80, 'MAIN MENU', {
            fontSize: '32px',
            color: '#ffffff',
            backgroundColor: '#000064',
            padding: { x: 20, y: 10 }
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.eventBus.emit('return-to-menu-requested');
            })
            .on('pointerover', () => menuButton.setTint(0xaaaaff))
            .on('pointerout', () => menuButton.clearTint());
        
        // Add elements to pause menu container
        this.pauseMenuUI.add([bg, pausedText, resumeButton, menuButton]);
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
        
        // Add listeners for game state transitions
        this.eventBus.on('start-game-requested', () => {
            // Forward to game coordinator
            this.eventBus.emit('start-new-game');
        });
        
        this.eventBus.on('retry-game-requested', () => {
            // Forward to game coordinator
            this.eventBus.emit('start-new-game');
        });
        
        this.eventBus.on('return-to-menu-requested', () => {
            // Forward to game coordinator
            this.eventBus.emit('return-to-menu');
        });
        
        this.eventBus.on('resume-game-requested', () => {
            // Forward to game coordinator
            this.eventBus.emit('resume-game');
        });
    }
    
    // State-specific UI methods
    
    /**
     * Show main menu UI
     */
    public showMainMenu(): void {
        this.hideAllUI();
        this.mainMenuUI.setVisible(true);
    }
    
    /**
     * Show gameplay UI (common elements for build and combat)
     */
    public showGameplayUI(): void {
        this.gameplayUI.setVisible(true);
        // Show HUD elements
        if (this.hud) {
            // Update resources display
            this.updateResources();
            // Update player stats
            this.updatePlayerStats();
        }
    }
    
    /**
     * Show build phase UI
     */
    public showBuildUI(): void {
        this.hideAllUI();
        this.showGameplayUI();
        this.buildUI.setVisible(true);
        // Enable build mode UI elements in HUD
        if (this.hud) {
            this.updateResources();
            this.hud.showNextRoundButton(() => {
                this.eventBus.emit('start-round');
            });
        }
    }
    
    /**
     * Show combat phase UI
     */
    public showCombatUI(): void {
        this.hideAllUI();
        this.showGameplayUI();
        this.combatUI.setVisible(true);
        // Update UI for combat mode
        if (this.hud) {
            this.hud.disableRoundButton();
        }
    }
    
    /**
     * Show round end UI
     */
    public showRoundEndUI(): void {
        this.hideAllUI();
        this.showGameplayUI();
        this.roundEndUI.setVisible(true);
        // Show round end elements
        if (this.hud) {
            this.hud.showNextRoundButton(() => {
                this.eventBus.emit('start-next-round');
            });
        }
    }
    
    /**
     * Show game over UI
     */
    public showGameOverUI(): void {
        this.hideAllUI();
        this.gameOverUI.setVisible(true);
    }
    
    /**
     * Show pause menu
     */
    public showPauseMenu(): void {
        this.pauseMenuUI.setVisible(true);
    }
    
    /**
     * Hide pause menu
     */
    public hidePauseMenu(): void {
        this.pauseMenuUI.setVisible(false);
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