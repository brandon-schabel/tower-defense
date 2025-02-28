import Phaser from "phaser";
import GameScene from "../scenes/game-scene";
import Tower from "../entities/tower/tower";
import { EventBus } from "../core/event-bus";
import EntityManager from "./entity-manager";
import GameState from "../utils/game-state";
import UIManager from "./ui-manager";

export default class TowerManager {
    private scene: GameScene;
    private selectedTower: Tower | null = null;
    private upgradePanel: Phaser.GameObjects.Container | null = null;
    private rangeCircle: Phaser.GameObjects.Graphics | null = null;
    private entityManager: EntityManager;
    private eventBus: EventBus;
    private gameState: GameState;

    constructor(
        scene: GameScene,
        entityManager: EntityManager,
        eventBus: EventBus,
        gameState: GameState
    ) {
        this.scene = scene;
        this.entityManager = entityManager;
        this.eventBus = eventBus;
        this.gameState = gameState;
    }

    public selectTower(tower: Tower): void {
        // Deselect current tower if any
        this.deselectTower();
        
        this.selectedTower = tower;
        
        // Show range indicator
        this.rangeCircle = this.scene.add.graphics();
        this.rangeCircle.lineStyle(2, 0x00ff00, 0.5);
        this.rangeCircle.strokeCircle(tower.x, tower.y, tower.getCurrentRange());
        
        // Emit event for UI updates
        this.eventBus.emit('tower-selected', tower);
    }
    
    public deselectTower(): void {
        if (this.selectedTower) {
            // Remove range indicator
            if (this.rangeCircle) {
                this.rangeCircle.destroy();
                this.rangeCircle = null;
            }
            
            // Emit event for UI updates
            this.eventBus.emit('tower-deselected');
            
            this.selectedTower = null;
        }
    }
    
    public getSelectedTower(): Tower | null {
        return this.selectedTower;
    }
    
    public findTowerAt(x: number, y: number): Tower | null {
        const towers = this.entityManager.getTowers();
        if (!towers) return null;
        
        let result: Tower | null = null;
        const maxDistance = 50; // Maximum distance to consider a tower "clicked"
        
        towers.getChildren().forEach((towerObj) => {
            const tower = towerObj as Tower;
            const distance = Phaser.Math.Distance.Between(x, y, tower.x, tower.y);
            if (distance < maxDistance) {
                result = tower;
            }
        });
        
        return result;
    }
    
    public update(): void {
        // Update range indicator if tower is selected
        if (this.selectedTower && this.rangeCircle) {
            this.rangeCircle.clear();
            this.rangeCircle.lineStyle(2, 0x00ff00, 0.5);
            this.rangeCircle.strokeCircle(
                this.selectedTower.x, 
                this.selectedTower.y, 
                this.selectedTower.getCurrentRange()
            );
        }
    }

    private showUpgradePanel(tower: Tower): void {
        if (this.upgradePanel) {
            this.upgradePanel.destroy();
        }

        this.upgradePanel = this.scene.add.container(150, 100);

        const bg = this.scene.add.graphics();
        bg.fillStyle(0x000000, 0.8);
        bg.fillRoundedRect(0, 0, 250, 400, 10);
        this.upgradePanel.add(bg);

        const title = this.scene.add.text(125, 20, `Upgrade Tower (Tier ${tower.getTier()})`, {
            fontSize: '20px',
            color: '#ffffff'
        }).setOrigin(0.5);
        this.upgradePanel.add(title);

        if (tower.getTier() < tower.getMaxTier()) {
            const tierCost = tower.getTierUpgradeCost();
            const tierButton = this.scene.add.text(20, 50, `Upgrade to Tier ${tower.getTier() + 1} - ${tierCost}`, {
                fontSize: '16px',
                color: '#ffa500'
            }).setWordWrapWidth(210);

            tierButton.setInteractive();
            tierButton.on('pointerdown', () => this.tierUpgradeTower(tower));
            tierButton.on('pointerover', () => tierButton.setStyle({ color: '#ffff00' }));
            tierButton.on('pointerout', () => tierButton.setStyle({ color: '#ffa500' }));

            if (!this.gameState || !this.gameState.canAfford(tierCost)) {
                tierButton.setStyle({ color: '#888888' });
                tierButton.disableInteractive();
            }

            this.upgradePanel.add(tierButton);
        }

        const upgrades: { type: "speed" | "range" | "damage"; label: string }[] = [
            { type: 'speed', label: 'Speed' },
            { type: 'range', label: 'Range' },
            { type: 'damage', label: 'Damage' }
        ];

        upgrades.forEach((upgrade, index) => {
            const yPos = 90 + index * 40;
            let level = 0;
            switch (upgrade.type) {
                case 'speed': level = tower.getSpeedLevel(); break;
                case 'range': level = tower.getRangeLevel(); break;
                case 'damage': level = tower.getDamageLevel(); break;
            }
            const cost = tower.getUpgradeCost(upgrade.type);
            const buttonText = `${upgrade.label} (Lv.${level}) - ${cost}`;

            const button = this.scene.add.text(20, yPos, buttonText, {
                fontSize: '16px',
                color: '#ffffff'
            }).setWordWrapWidth(210);
            button.setInteractive();
            button.on('pointerdown', () => this.upgradeTower(tower, upgrade.type));
            button.on('pointerover', () => button.setStyle({ color: '#ffff00' }));
            button.on('pointerout', () => button.setStyle({ color: '#ffffff' }));

            if (level >= tower.getMaxUpgradeLevel() || !this.gameState || !this.gameState.canAfford(cost)) {
                button.setStyle({ color: '#888888' });
                button.disableInteractive();
            }
            this.upgradePanel?.add(button);
        });

        if (!tower.getSpecialPower()) {
            const specialPowers: { type: "fire" | "ice" | "critical"; label: string; color: string; }[] = [
                { type: 'fire', label: 'Fire', color: '#ff0000' },
                { type: 'ice', label: 'Ice', color: '#00ffff' },
                { type: 'critical', label: 'Critical', color: '#ffff00' }
            ];

            specialPowers.forEach((power, index) => {
                const yPos = 210 + index * 30;
                const button = this.scene.add.text(20, yPos, `${power.label} - 500`, {
                    fontSize: '16px',
                    color: power.color
                });
                button.setInteractive();
                button.on('pointerdown', () => this.purchaseSpecialPower(tower, power.type));
                button.on('pointerover', () => button.setStyle({ color: '#ffffff' }));
                button.on('pointerout', () => button.setStyle({ color: power.color }));

                if (!this.gameState || !this.gameState.canAfford(500)) {
                    button.setStyle({ color: '#888888' });
                    button.disableInteractive();
                }
                if (this.upgradePanel) {
                    this.upgradePanel.add(button);
                }
            });
        }

        const yPos = 300;
        const statsText = this.scene.add.text(20, yPos,
            `Damage: ${Math.round(tower.getCurrentDamage())}\n` +
            `Range: ${Math.round(tower.getCurrentRange())}\n` +
            `Speed: ${(1000 / tower.getShootCooldown()).toFixed(1)} shots/sec\n` +
            `Health: ${tower.getHealth()}/${tower.getMaxHealth()}`,
            {
                fontSize: '14px',
                color: '#ffffff'
            }
        );
        this.upgradePanel.add(statsText);

        const closeButton = this.scene.add.text(230, 10, 'X', {
            fontSize: '16px',
            color: '#ff0000'
        });
        closeButton.setInteractive();
        closeButton.on('pointerdown', () => {
            this.upgradePanel?.destroy();
            this.upgradePanel = null;
            this.selectedTower = null;
        });
        if (this.upgradePanel) {
            this.upgradePanel.add(closeButton);
        }

        this.upgradePanel.setScale(0.9);
        this.scene.tweens.add({
            targets: this.upgradePanel,
            scale: 1,
            duration: 200,
            ease: 'Power2'
        });
    }

    private tierUpgradeTower(tower: Tower): void {
        const cost = tower.getTierUpgradeCost();

        if (this.gameState && this.gameState.canAfford(cost)) {
            if (this.gameState.spendResources(cost)) {
                tower.upgradeTier();

                this.showUpgradePanel(tower);

                const particles = this.scene.add.particles(tower.x, tower.y, 'projectile', {
                    speed: 100,
                    scale: { start: 1, end: 0 },
                    blendMode: 'ADD',
                    lifespan: 1000,
                    gravityY: -50
                });

                this.scene.time.delayedCall(1000, () => {
                    particles.destroy();
                });
            }
        }
    }

    private upgradeTower(tower: Tower, upgradeType: "speed" | "range" | "damage"): void {
        const cost = tower.getUpgradeCost(upgradeType);
        
        if (this.gameState && this.gameState.canAfford(cost)) {
            this.gameState.spendResources(cost);
            tower.upgrade(upgradeType);
            
            this.showUpgradePanel(tower);
        }
    }

    private purchaseSpecialPower(tower: Tower, powerType: "fire" | "ice" | "critical"): void {
        if (this.gameState && this.gameState.canAfford(tower.getSpecialPowerCost())) {
            this.gameState.spendResources(tower.getSpecialPowerCost());
            tower.setSpecialPower(powerType);
            
            // Emit event for UI updates
            this.eventBus.emit('tower-upgraded', tower);
            
            this.showUpgradePanel(tower);
        }
    }
}