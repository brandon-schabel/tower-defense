import Phaser from "phaser";
import GameScene from "../scenes/game-scene";
import Tower from "../entities/tower";
import { gameConfig } from "../utils/app-config";
import { GAME_SETTINGS } from "../settings";
import ServiceLocator from "../utils/service-locator";
import TileMapManager from "./tile-map-manager";
import GameState from "../utils/game-state";
import UIManager from "./ui-manager";

export default class TowerManager {
    private scene: GameScene;
    private selectedTower: Tower | null = null;
    private upgradePanel: Phaser.GameObjects.Container | null = null;
    private rangeCircle: Phaser.GameObjects.Graphics | null = null;

    constructor(scene: GameScene) {
        this.scene = scene;
        
        // Register with service locator
        ServiceLocator.getInstance().register('towerManager', this);
    }

    public selectTower(tower: Tower): void {
        this.selectedTower = tower;
        
        const uiManager = ServiceLocator.getInstance().get<UIManager>('uiManager');
        if (uiManager) {
            uiManager.updateTowerStats(tower);
        }
        
        this.showUpgradePanel(tower);
        this.showRangeCircle(tower);
    }

    public deselectTower(): void {
        if (this.rangeCircle) {
            this.rangeCircle.destroy();
            this.rangeCircle = null;
        }
        this.selectedTower = null;
        
        const uiManager = ServiceLocator.getInstance().get<UIManager>('uiManager');
        if (uiManager) {
            uiManager.updateTowerStats(null);
        }
        
        if (this.upgradePanel) {
            this.upgradePanel.destroy();
            this.upgradePanel = null;
        }
    }

    public getSelectedTower(): Tower | null {
        return this.selectedTower;
    }

    private showRangeCircle(tower: Tower): void {
        if (this.rangeCircle) {
            this.rangeCircle.destroy();
        }
        this.rangeCircle = this.scene.add.graphics();
        this.rangeCircle.lineStyle(2, 0xffffff, 0.5);
        this.rangeCircle.strokeCircle(tower.x, tower.y, tower.getCurrentRange());
    }

    public findTowerAt(x: number, y: number): Tower | null {
        const towers = this.scene.getEntityManager().getTowers();
        if (!towers) return null;

        let result: Tower | null = null;

        (towers.getChildren() as Phaser.Physics.Arcade.Sprite[]).forEach(sprite => {
            const tower = sprite as Tower;
            const distance = Phaser.Math.Distance.Between(x, y, tower.x, tower.y);

            const towerType = tower.getTowerType();

            const towerConfigs = gameConfig.getConfig('towers') ?? GAME_SETTINGS.towers;
            const towerData = towerConfigs?.[towerType];
            
            const tileMapManager = ServiceLocator.getInstance().get<TileMapManager>('tileMapManager');
            const tileSize = tileMapManager?.getTileSize() || 32;
            
            const hitSize = Math.max(towerData.size.width, towerData.size.height) * tileSize / 2;

            if (distance < hitSize) {
                result = tower;
            }
        });

        return result;
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

            const gameState = ServiceLocator.getInstance().get<GameState>('gameState');
            if (!gameState || !gameState.canAfford(tierCost)) {
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

            const gameState = ServiceLocator.getInstance().get<GameState>('gameState');
            if (level >= tower.getMaxUpgradeLevel() || !gameState || !gameState.canAfford(cost)) {
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

                const gameState = ServiceLocator.getInstance().get<GameState>('gameState');
                if (!gameState || !gameState.canAfford(500)) {
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
        const gameState = ServiceLocator.getInstance().get<GameState>('gameState');

        if (gameState && gameState.canAfford(cost)) {
            if (gameState.spendResources(cost)) {
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
        const gameState = ServiceLocator.getInstance().get<GameState>('gameState');
        const uiManager = ServiceLocator.getInstance().get<UIManager>('uiManager');
        
        if (gameState && gameState.canAfford(cost)) {
            gameState.spendResources(cost);
            tower.upgrade(upgradeType);
            
            if (uiManager) {
                uiManager.updateResources();
                uiManager.updateTowerStats(tower);
            }
            
            this.showUpgradePanel(tower);
        }
    }

    private purchaseSpecialPower(tower: Tower, powerType: "fire" | "ice" | "critical"): void {
        const gameState = ServiceLocator.getInstance().get<GameState>('gameState');
        const uiManager = ServiceLocator.getInstance().get<UIManager>('uiManager');
        
        if (gameState && gameState.canAfford(tower.getSpecialPowerCost())) {
            gameState.spendResources(tower.getSpecialPowerCost());
            tower.setSpecialPower(powerType);
            
            if (uiManager) {
                uiManager.updateResources();
                uiManager.updateTowerStats(tower);
            }
            
            this.showUpgradePanel(tower);
        }
    }

    public update(): void {
        // Update range circle if needed
        if (this.selectedTower && this.rangeCircle) {
            this.rangeCircle.clear();
            this.rangeCircle.lineStyle(2, 0xffffff, 0.5);
            this.rangeCircle.strokeCircle(
                this.selectedTower.x,
                this.selectedTower.y,
                this.selectedTower.getCurrentRange()
            );
        }
    }
}