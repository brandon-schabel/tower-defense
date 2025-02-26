import Phaser from "phaser";
import Player from "../entities/player";
import Base from "../entities/base";
import HUD from "../ui/hud";
import GameState from "../utils/game-state";
import Tower from "../entities/tower";
import Enemy from "../entities/enemy";
import { GAME_SETTINGS, TowerType } from "../settings";
import PowerUp, { PowerUpType } from "../entities/power-up";
import { DifficultyLevel, DIFFICULTY_SETTINGS } from "../settings";
import EntityFactory from "../factories/entity-factory";
import TileMapManager from "../managers/tile-map-manager";
import ItemDropManager from "../managers/item-drop-manager";
import { GameItem, InventorySlot } from "../types/item";
import InventoryUI from "../ui/inventory-ui";
import CameraController from "../utils/camera-controller";
import { BaseScene } from "./base-scene";
import { EventBus } from "../utils/event-bus";
import { InputManager } from "../managers/input-manger";
import { ResearchTree } from "../ui/hud";
import { EnemyType } from "../types/enemy-type";
import { gameConfig } from "../utils/app-config";

type SceneInitData = {
    isNewGame: boolean;
};

export default class GameScene extends BaseScene {
    private gameState!: GameState;
    private user!: Player;
    private base!: Base;
    private hud!: HUD;
    private isBuildModeActive: boolean = false;
    private ghostTower: Phaser.GameObjects.Sprite | null = null;
    private selectedTowerType: TowerType | null = null;
    private enemies?: Phaser.Physics.Arcade.Group;
    private towers?: Phaser.Physics.Arcade.Group;
    private projectiles?: Phaser.Physics.Arcade.Group;
    private currentRound: number = 0;
    private gameOverHandled = false;
    private isRoundEnding: boolean = false;
    private isRoundActive: boolean = false;
    private debugMode: boolean = false;
    private selectedTower: Tower | null = null;
    private upgradePanel: Phaser.GameObjects.Container | null = null;
    private rangeCircle: Phaser.GameObjects.Graphics | null = null;
    private powerUpSpawnTimer: Phaser.Time.TimerEvent | null = null;
    private difficultyLevel: DifficultyLevel = DifficultyLevel.Medium;
    private entityFactory!: EntityFactory;
    private tileMapManager!: TileMapManager;
    private itemDropManager!: ItemDropManager;
    private inventoryUI!: InventoryUI;
    private isInventoryVisible: boolean = false;
    private cameraController!: CameraController;
    public eventBus = new EventBus();
    private inputManager: InputManager;
    private spawnEnemy!: () => void;
    private debugGraphics!: Phaser.GameObjects.Graphics;
    private debugSettings = GAME_SETTINGS.debug;
    private debugText!: Phaser.GameObjects.Text;
    private physicsDebugGraphic!: Phaser.GameObjects.Graphics;

    constructor() {
        super({ key: "GameScene" });
        this.inputManager = new InputManager(this, {
            pause: "P",
            inventory: "I",
            debug: "F3"
        });
        this.inputManager.onAction("pause", () => this.togglePause());
        this.inputManager.onAction("inventory", () => this.toggleInventoryUI());
        this.inputManager.onAction("debug", () => this.toggleDebugMode());
    }

    preload() {
        this.loadAssets();
    }

    init(data: SceneInitData) {
        this.gameState = new GameState();
        if (!data.isNewGame) {
            this.gameState.loadFromLocalStorage();
        }
        this.currentRound = 0;
        this.game.events.emit('start-game');

        this.initPowerUpTimer();
    }


    create() {
        this.setupPhysics();
        this.setupCamera();

        // Setup debug text
        this.debugText = this.add.text(10, 10, '', { fontSize: '16px', color: '#ffffff' });

        // Setup physics debug graphic and hide by default
        this.physicsDebugGraphic = this.physics.world.createDebugGraphic();
        this.physicsDebugGraphic.setVisible(false);

        this.debugGraphics = this.add.graphics();
        console.log('[GameScene] Scene created, available textures:', this.textures.getTextureKeys());

        Object.entries(GAME_SETTINGS).forEach(([key, value]) => {
            gameConfig.loadConfig(key as keyof typeof GAME_SETTINGS, value);
        });

        this.entityFactory = new EntityFactory(this);
        this.tileMapManager = new TileMapManager(this);
        this.projectiles = this.physics.add.group();
        this.towers = this.physics.add.group();
        this.enemies = this.physics.add.group();

        this.placeDecorativeTiles();

        const basePos = this.tileMapManager.tileToWorld(
            Math.floor(GAME_SETTINGS.map.width / 2),
            Math.floor(GAME_SETTINGS.map.height / 2)
        );
        this.base = this.entityFactory.createBase(basePos.x, basePos.y);

        const playerStart = this.findValidStartPosition();
        this.user = this.entityFactory.createPlayer(playerStart.x, playerStart.y);
        this.cameras.main.startFollow(this.user);
        this.cameraController = new CameraController(this, this.user);

        this.itemDropManager = new ItemDropManager(this, this.tileMapManager);

        this.inventoryUI = new InventoryUI(this, this.user.getInventory());
        this.inventoryUI.hide();

        this.hud = new HUD(this);

        this.setupInputHandlers();
        this.setupCollisions();
        this.setupProjectileCollisions();

        this.time.addEvent({
            delay: GAME_SETTINGS.game.enemyTargetRecalculationInterval,
            callback: () => this.recalculateEnemyTargets(),
            loop: true
        });

        this.spawnEnemy = () => {
            if (this.isRoundEnding || this.gameOverHandled) return;

            const enemyType = this.chooseEnemyType();
            const tier = Math.min(this.currentRound + 1, 5);
            const startPos = this.findValidStartPosition();

            if (!startPos) {
                console.warn("[GameScene] No valid start position found for enemy.");
                return;
            }

            const onEnemyDeath = () => {
                if (this.isRoundEnding || this.gameOverHandled) return;
                this.eventBus.emit('enemy-killed', startPos.x, startPos.y);
            };

            const enemy = this.entityFactory.createEnemy(startPos.x, startPos.y, enemyType, tier, onEnemyDeath);
            if (enemy) {
                this.enemies?.add(enemy);
                enemy.setData('target', this.base);
            }
        };

        this.eventBus.on('enemy-killed', (x: number, y: number) => {
            if (Math.random() < GAME_SETTINGS.itemDropChance) {
                this.itemDropManager.dropRandomItem(x, y);
            }
        });

        this.applyResearchEffects();
    }


    private applyResearchEffects() {
        const researchTree = ResearchTree.getInstance();
        const towerDamageLevel = researchTree.getResearchLevel('tower-damage-1');
        if (towerDamageLevel > 0) {
            console.log(`Applying tower damage research level: ${towerDamageLevel}`);
        }
    }

    private findValidStartPosition(): { x: number, y: number } {
        // Get map dimensions from tile manager
        const mapWidth = this.tileMapManager.getMapWidth() || 100; // Default to 100 if undefined
        const mapHeight = this.tileMapManager.getMapHeight() || 100; // Default to 100 if undefined

        // Randomly choose an edge (0 = top, 1 = right, 2 = bottom, 3 = left)
        const edge = Phaser.Math.Between(0, 3);

        let tileX: number;
        let tileY: number;
        const margin = 2; // Keep a small margin from the absolute edge

        switch (edge) {
            case 0: // Top edge
                tileX = Phaser.Math.Between(margin, mapWidth - margin);
                tileY = margin;
                break;
            case 1: // Right edge
                tileX = mapWidth - margin;
                tileY = Phaser.Math.Between(margin, mapHeight - margin);
                break;
            case 2: // Bottom edge
                tileX = Phaser.Math.Between(margin, mapWidth - margin);
                tileY = mapHeight - margin;
                break;
            case 3: // Left edge
                tileX = margin;
                tileY = Phaser.Math.Between(margin, mapHeight - margin);
                break;
            default:
                // Fallback to a safe position if something goes wrong
                tileX = margin;
                tileY = margin;
        }

        // Make sure position is not occupied
        if (!this.tileMapManager.isTileAvailable(tileX, tileY, 1, 1)) {
            // If position isn't available, try again with recursive call
            // (with a limit to prevent infinite recursion)
            return this.findValidStartPosition();
        }

        // Convert tile position to world position
        return this.tileMapManager.tileToWorld(tileX, tileY);
    }

    private placeDecorativeTiles() {
        for (let i = 0; i < GAME_SETTINGS.map.decorationCount; i++) {
            const decorType = Phaser.Math.RND.pick(['bush', 'tree', 'rock']);
            const decorSize = decorType === 'tree' ? 2 : 1;

            const position = this.tileMapManager.findValidPlacement(decorSize, decorSize);
            if (position) {
                const worldPos = this.tileMapManager.tileToWorld(position.tileX, position.tileY);

                this.add.image(worldPos.x, worldPos.y, decorType);

                this.tileMapManager.occupyTiles(
                    position.tileX, position.tileY,
                    decorSize, decorSize,
                    'decoration', `decor_${i}`
                );
            }
        }
    }

    public getTileMapManager(): TileMapManager {
        return this.tileMapManager;
    }

    enterBuildMode(towerType: TowerType) {
        if (this.isBuildModeActive) return;

        const towerData = GAME_SETTINGS.towers[towerType];
        if (!towerData) {
            console.log('Invalid tower type selected');
            this.exitBuildMode();
            return;
        }

        if (!this.gameState.canAfford(towerData.price)) {
            // Show visual feedback for insufficient resources
            const text = this.add.text(
                this.cameras.main.worldView.centerX,
                this.cameras.main.worldView.centerY - 50,
                'Not enough resources!',
                { fontSize: '24px', color: '#ff0000' }
            ).setOrigin(0.5);

            this.tweens.add({
                targets: text,
                alpha: 0,
                y: text.y - 50,
                duration: 1000,
                onComplete: () => text.destroy()
            });

            this.exitBuildMode();
            return;
        }

        this.isBuildModeActive = true;
        this.selectedTowerType = towerType;

        if (this.ghostTower) {
            this.ghostTower.destroy();
        }

        // Create ghost tower with proper sizing
        this.ghostTower = this.add.sprite(0, 0, towerType)
            .setAlpha(0.5)
            .setScale(towerData.scale);

        // Add a range indicator circle
        const rangeCircle = this.add.graphics();
        rangeCircle.lineStyle(2, 0xffffff, 0.5);
        rangeCircle.strokeCircle(0, 0, towerData.range);
        this.ghostTower.setData('rangeCircle', rangeCircle);

        // Add grid indicator
        const gridIndicator = this.add.graphics();
        this.ghostTower.setData('gridIndicator', gridIndicator);

        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (this.ghostTower) {
                const tilePos = this.tileMapManager.worldToTile(pointer.worldX, pointer.worldY);
                const worldPos = this.tileMapManager.tileToWorld(tilePos.tileX, tilePos.tileY);

                this.ghostTower.setPosition(worldPos.x, worldPos.y);
                const rangeCircle = this.ghostTower.getData('rangeCircle') as Phaser.GameObjects.Graphics;
                rangeCircle.setPosition(worldPos.x, worldPos.y);

                // Update grid indicator
                const gridIndicator = this.ghostTower.getData('gridIndicator') as Phaser.GameObjects.Graphics;
                gridIndicator.clear();
                gridIndicator.lineStyle(2, 0xffffff, 0.3);

                const tileSize = this.tileMapManager.getTileSize();
                const width = towerData.size.width * tileSize;
                const height = towerData.size.height * tileSize;

                // Draw grid
                for (let x = 0; x <= width; x += tileSize) {
                    gridIndicator.lineBetween(
                        worldPos.x - width / 2 + x,
                        worldPos.y - height / 2,
                        worldPos.x - width / 2 + x,
                        worldPos.y + height / 2
                    );
                }
                for (let y = 0; y <= height; y += tileSize) {
                    gridIndicator.lineBetween(
                        worldPos.x - width / 2,
                        worldPos.y - height / 2 + y,
                        worldPos.x + width / 2,
                        worldPos.y - height / 2 + y
                    );
                }

                const isValid = this.tileMapManager.isTileAvailable(
                    tilePos.tileX, tilePos.tileY,
                    towerData.size.width, towerData.size.height
                );

                // Update visuals based on validity
                this.ghostTower.setTint(isValid ? 0x00ff00 : 0xff0000);
                rangeCircle.setVisible(isValid);
                gridIndicator.setVisible(isValid);

                // Show cost indicator
                if (!this.ghostTower.getData('costText')) {
                    const costText = this.add.text(0, 0, `Cost: ${towerData.price}`, {
                        fontSize: '16px',
                        color: '#ffffff',
                        backgroundColor: '#000000',
                        padding: { x: 4, y: 2 }
                    }).setOrigin(0.5);
                    this.ghostTower.setData('costText', costText);
                }

                const costText = this.ghostTower.getData('costText') as Phaser.GameObjects.Text;
                costText.setPosition(worldPos.x, worldPos.y - height / 2 - 20);
            }
        });

        // Show build mode instructions
        const instructions = this.add.text(
            this.cameras.main.worldView.centerX,
            50,
            'Left-click to place tower\nRight-click or ESC to cancel',
            {
                fontSize: '20px',
                color: '#ffffff',
                backgroundColor: '#000000',
                padding: { x: 10, y: 5 }
            }
        ).setOrigin(0.5);
        this.ghostTower.setData('instructions', instructions);

        // Add right-click and ESC to cancel
        const cancelBuild = () => this.exitBuildMode();
        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (pointer.rightButtonDown()) {
                cancelBuild();
            }
        });
        this.input.keyboard?.addKey('ESC').on('down', cancelBuild);
    }

    private exitBuildMode() {
        this.isBuildModeActive = false;
        this.selectedTowerType = null;

        if (this.ghostTower) {
            const rangeCircle = this.ghostTower.getData('rangeCircle') as Phaser.GameObjects.Graphics;
            if (rangeCircle) {
                rangeCircle.destroy();
            }

            const gridIndicator = this.ghostTower.getData('gridIndicator') as Phaser.GameObjects.Graphics;
            if (gridIndicator) {
                gridIndicator.destroy();
            }

            const costText = this.ghostTower.getData('costText') as Phaser.GameObjects.Text;
            if (costText) {
                costText.destroy();
            }

            const instructions = this.ghostTower.getData('instructions') as Phaser.GameObjects.Text;
            if (instructions) {
                instructions.destroy();
            }

            this.ghostTower.destroy();
            this.ghostTower = null;
        }

        this.input.off('pointermove');
        this.input.keyboard?.removeKey('ESC');
    }

    public findNearestTower(x: number, y: number, range: number): Phaser.Physics.Arcade.Sprite | null {
        if (!this.towers) return null;

        let nearest: Phaser.Physics.Arcade.Sprite | null = null;
        let nearestDistance = range;

        (this.towers.getChildren() as Phaser.Physics.Arcade.Sprite[]).forEach(towerSprite => {
            const distance = Phaser.Math.Distance.Between(x, y, towerSprite.x, towerSprite.y);
            if (distance < nearestDistance) {
                nearest = towerSprite;
                nearestDistance = distance;
            }
        });

        return nearest;
    }

    private onProjectileHitEnemy(projectile: Phaser.Physics.Arcade.Sprite, enemy: Phaser.Physics.Arcade.Sprite) {
        const damage = projectile.getData('damage') || 20;
        (enemy as Enemy).takeDamage(damage);

        const specialEffect = projectile.getData('specialEffect');
        if (specialEffect) {
            if (specialEffect.type === 'fire') {
                (enemy as Enemy).applyBurnEffect(specialEffect.params.burnDamage);
            } else if (specialEffect.type === 'ice') {
                (enemy as Enemy).applySlowEffect(specialEffect.params.slowFactor, specialEffect.params.duration);
            }
        }

        projectile.destroy();
    }

    public selectTower(tower: Tower) {
        this.selectedTower = tower;
        this.hud.updateTowerStats(tower);
        this.showUpgradePanel(tower);
        this.showRangeCircle(tower);
    }

    private showUpgradePanel(tower: Tower) {
        if (this.upgradePanel) {
            this.upgradePanel.destroy();
        }

        this.upgradePanel = this.add.container(150, 100);

        const bg = this.add.graphics();
        bg.fillStyle(0x000000, 0.8);
        bg.fillRoundedRect(0, 0, 250, 400, 10);
        this.upgradePanel.add(bg);

        const title = this.add.text(125, 20, `Upgrade Tower (Tier ${tower.getTier()})`, {
            fontSize: '20px',
            color: '#ffffff'
        }).setOrigin(0.5);
        this.upgradePanel.add(title);

        if (tower.getTier() < tower.getMaxTier()) {
            const tierCost = tower.getTierUpgradeCost();
            const tierButton = this.add.text(20, 50, `Upgrade to Tier ${tower.getTier() + 1} - ${tierCost}`, {
                fontSize: '16px',
                color: '#ffa500'
            }).setWordWrapWidth(210);

            tierButton.setInteractive();
            tierButton.on('pointerdown', () => this.tierUpgradeTower(tower));
            tierButton.on('pointerover', () => tierButton.setStyle({ color: '#ffff00' }));
            tierButton.on('pointerout', () => tierButton.setStyle({ color: '#ffa500' }));

            if (!this.gameState.canAfford(tierCost)) {
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

            const button = this.add.text(20, yPos, buttonText, {
                fontSize: '16px',
                color: '#ffffff'
            }).setWordWrapWidth(210);
            button.setInteractive();
            button.on('pointerdown', () => this.upgradeTower(tower, upgrade.type));
            button.on('pointerover', () => button.setStyle({ color: '#ffff00' }));
            button.on('pointerout', () => button.setStyle({ color: '#ffffff' }));

            if (level >= tower.getMaxUpgradeLevel() || !this.gameState.canAfford(cost)) {
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
                const button = this.add.text(20, yPos, `${power.label} - 500`, {
                    fontSize: '16px',
                    color: power.color
                });
                button.setInteractive();
                button.on('pointerdown', () => this.purchaseSpecialPower(tower, power.type));
                button.on('pointerover', () => button.setStyle({ color: '#ffffff' }));
                button.on('pointerout', () => button.setStyle({ color: power.color }));

                if (!this.gameState.canAfford(500)) {
                    button.setStyle({ color: '#888888' });
                    button.disableInteractive();
                }
                if (this.upgradePanel) {
                    this.upgradePanel.add(button);
                }
            });
        }

        const yPos = 300;
        const statsText = this.add.text(20, yPos,
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

        const closeButton = this.add.text(230, 10, 'X', {
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
        this.tweens.add({
            targets: this.upgradePanel,
            scale: 1,
            duration: 200,
            ease: 'Power2'
        });
    }

    private tierUpgradeTower(tower: Tower) {
        const cost = tower.getTierUpgradeCost();

        if (this.gameState.canAfford(cost)) {
            if (this.gameState.spendResources(cost)) {
                tower.upgradeTier();

                this.showUpgradePanel(tower);

                const particles = this.add.particles(tower.x, tower.y, 'projectile', {
                    speed: 100,
                    scale: { start: 1, end: 0 },
                    blendMode: 'ADD',
                    lifespan: 1000,
                    gravityY: -50
                });

                this.time.delayedCall(1000, () => {
                    particles.destroy();
                });
            }
        }
    }

    private upgradeTower(tower: Tower, upgradeType: "speed" | "range" | "damage") {
        const cost = tower.getUpgradeCost(upgradeType);
        if (this.gameState.canAfford(cost)) {
            this.gameState.spendResources(cost);
            tower.upgrade(upgradeType);
            this.hud.updateResources();
            this.showUpgradePanel(tower);
            this.hud.updateTowerStats(tower);
        }
    }

    private purchaseSpecialPower(tower: Tower, powerType: "fire" | "ice" | "critical") {
        if (this.gameState.canAfford(tower.getSpecialPowerCost())) {
            this.gameState.spendResources(tower.getSpecialPowerCost());
            tower.setSpecialPower(powerType);
            this.hud.updateResources();
            this.showUpgradePanel(tower);
            this.hud.updateTowerStats(tower);
        }
    }

    getGameState() {
        return this.gameState;
    }

    public getBase(): Base {
        return this.base;
    }

    public getUser(): Player {
        return this.user;
    }

    public getCurrentRound(): number {
        return this.currentRound;
    }

    getEnemies(): Phaser.Physics.Arcade.Sprite[] {
        if (!this.enemies) return [];

        // Filter to only return active enemies, ensuring they are Enemy instances
        return this.enemies.getChildren().filter(obj => {
            return obj.active && obj instanceof Enemy;
        }) as Phaser.Physics.Arcade.Sprite[];
    }

    public recalculateEnemyTargets() {
        if (!this.enemies || !this.towers) return;

        const towersActive = this.towers.countActive(true);

        this.enemies.getChildren().forEach((obj) => {
            const enemy = obj as Enemy;
            if (!enemy.active) return;

            let newTarget: Phaser.Physics.Arcade.Sprite | null = null;

            // Check if player is very close (top priority for close range)
            const distToUser = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.user.x, this.user.y);
            if (distToUser < 100) {
                newTarget = this.user;
            }
            // Priority 1: Target towers if any exist
            else if (towersActive > 0) {
                const nearestTower = this.findNearestTower(enemy.x, enemy.y, Infinity);
                if (nearestTower) {
                    const distToTower = Phaser.Math.Distance.Between(enemy.x, enemy.y, nearestTower.x, nearestTower.y);
                    if (distToTower < 500) { // Only target towers within reasonable range
                        newTarget = nearestTower;
                    }
                }
            }

            // Priority 2: Target base if no towers in range
            if (!newTarget && this.base.active) {
                newTarget = this.base;
            }

            enemy.setData("target", newTarget);

            // Update debug visuals if debug mode is on
            if (this.debugMode) {
                this.showDebugInfo();
            }
        });
    }

    public gameOver() {
        if (this.gameOverHandled) return;
        this.gameOverHandled = true;

        console.log("Game Over called");
        this.physics.pause();
        console.log("Physics paused");
        this.enemies?.clear(true, true);
        console.log("Enemies cleared");
        this.towers?.clear(true, true);
        console.log("Towers cleared");
        this.projectiles?.clear(true, true);
        console.log("Projectiles cleared");

        const gameOverText = this.add.text(
            Number(this.game.config.width) / 2,
            Number(this.game.config.height) / 2,
            "Game Over!",
            { fontSize: "64px", color: "#ff0000" }
        );
        gameOverText.setOrigin(0.5);

        this.time.delayedCall(3000, () => {
            console.log("Restarting scene");
            this.scene.restart({ isNewGame: true });
            this.game.events.emit('end-game');
        });
    }

    public removeTower(tower: Tower) {
        this.towers?.remove(tower, true, true);
    }

    public forceEnemyUpdate() {
        this.updateEnemies();
    }

    private showRangeCircle(tower: Tower) {
        if (this.rangeCircle) {
            this.rangeCircle.destroy();
        }
        this.rangeCircle = this.add.graphics();
        this.rangeCircle.lineStyle(2, 0xffffff, 0.5);
        this.rangeCircle.strokeCircle(tower.x, tower.y, tower.getCurrentRange());
    }

    public deselectTower() {
        if (this.rangeCircle) {
            this.rangeCircle.destroy();
            this.rangeCircle = null;
        }
        this.selectedTower = null;
        this.hud.updateTowerStats(null);
        if (this.upgradePanel) {
            this.upgradePanel.destroy();
            this.upgradePanel = null;
        }
    }

    public getSelectedTower(): Tower | null {
        return this.selectedTower;
    }

    private initPowerUpTimer() {
        this.powerUpSpawnTimer = this.time.addEvent({
            delay: 60000,
            callback: this.spawnRandomPowerUp,
            callbackScope: this,
            loop: true
        });
    }

    private spawnRandomPowerUp() {
        if (this.isRoundEnding) return;

        const powerUpTypes = Object.values(PowerUpType);
        const randomType = Phaser.Math.RND.pick(powerUpTypes);

        const camera = this.cameras.main;
        let spawnX = Phaser.Math.Between(
            camera.scrollX + 100,
            camera.scrollX + camera.width - 100
        );
        let spawnY = Phaser.Math.Between(
            camera.scrollY + 100,
            camera.scrollY + camera.height - 100
        );

        new PowerUp(this, spawnX, spawnY, randomType as PowerUpType);

        const flashEffect = this.add.sprite(spawnX, spawnY, 'projectile')
            .setScale(2)
            .setTint(0xffffff);

        this.tweens.add({
            targets: flashEffect,
            alpha: 0,
            scale: 0,
            duration: 500,
            onComplete: () => flashEffect.destroy()
        });
    }

    public setDifficulty(level: DifficultyLevel) {
        this.difficultyLevel = level;
    }

    public getItemDropManager(): ItemDropManager {
        return this.itemDropManager;
    }

    public toggleInventoryUI(): void {
        this.isInventoryVisible = !this.isInventoryVisible;

        if (this.isInventoryVisible) {
            this.inventoryUI.show();
        } else {
            this.inventoryUI.hide();
        }
    }

    public addItemToInventory(item: GameItem): boolean {
        return this.user.getInventory().addItem(item);
    }

    public getDifficultyLevel(): DifficultyLevel {
        return this.difficultyLevel;
    }

    private setupInputHandlers(): void {
        this.input.keyboard?.addKey('I').on('down', () => {
            this.toggleInventoryUI();
        });

        this.input.keyboard?.addKey('P').on('down', () => {
            if (this.scene.isPaused()) {
                this.scene.resume();
            } else {
                this.scene.pause();
            }
        });

        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (this.isBuildModeActive) {
                if (this.ghostTower) {
                    const tilePos = this.tileMapManager.worldToTile(pointer.worldX, pointer.worldY);
                    const towerData = GAME_SETTINGS.towers[this.selectedTowerType as TowerType];

                    if (this.tileMapManager.isTileAvailable(
                        tilePos.tileX, tilePos.tileY,
                        towerData.size.width, towerData.size.height
                    )) {
                        this.placeTower(pointer.worldX, pointer.worldY);
                    }
                }
                return;
            }

            const worldPoint = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
            const clickedTower = this.findTowerAt(worldPoint.x, worldPoint.y);

            if (clickedTower) {
                this.selectTower(clickedTower);
            } else {
                this.deselectTower();
            }
        });
    }

    private setupCollisions(): void {
        if (!this.enemies || !this.towers || !this.projectiles) return;

        this.physics.add.collider(
            this.projectiles,
            this.enemies,
            (projectile, enemy) => this.onProjectileHitEnemy(
                projectile as Phaser.Physics.Arcade.Sprite,
                enemy as Phaser.Physics.Arcade.Sprite
            ),
            undefined,
            this
        );

        this.physics.add.overlap(
            this.enemies,
            this.base,
            (enemyObj, baseObj) => {
                if (enemyObj instanceof Enemy && baseObj instanceof Base) {
                    if (enemyObj.active && baseObj.active) {
                        const lastDamageTime = enemyObj.getData('lastDamageTime') || 0;
                        const currentTime = this.time.now;
                        if (currentTime - lastDamageTime >= 1000) { // Damage every 1 second
                            baseObj.takeDamage(2); // Reduced damage
                            enemyObj.setData('lastDamageTime', currentTime);
                        }
                    }
                }
            },
            (enemyObj, baseObj) => {
                return enemyObj instanceof Phaser.Physics.Arcade.Sprite &&
                       baseObj instanceof Phaser.Physics.Arcade.Sprite &&
                       enemyObj.active && baseObj.active;
            },
            this
        );

        this.physics.add.overlap(
            this.enemies,
            this.user,
            (enemyObj, playerObj) => {
                if (enemyObj instanceof Enemy && playerObj instanceof Player) {
                    if (enemyObj.active && playerObj.active && !enemyObj.getData('hasDealtDamage')) {
                        playerObj.takeDamage(5);
                        const angle = Phaser.Math.Angle.Between(enemyObj.x, enemyObj.y, playerObj.x, playerObj.y);
                        const knockbackForce = 200;
                        playerObj.setVelocity(Math.cos(angle) * knockbackForce, Math.sin(angle) * knockbackForce);
                        enemyObj.setData('hasDealtDamage', true);
                        enemyObj.setActive(false);
                        this.time.delayedCall(0, () => enemyObj.destroy());
                    }
                }
            },
            (enemyObj, playerObj) => {
                return enemyObj instanceof Phaser.Physics.Arcade.Sprite &&
                       playerObj instanceof Phaser.Physics.Arcade.Sprite &&
                       enemyObj.active && playerObj.active && !enemyObj.getData('hasDealtDamage');
            },
            this
        );

    }

    private updateEnemies(): void {
        if (!this.enemies) return;

        this.enemies.getChildren().forEach(gameObj => {
            const enemy = gameObj as Phaser.Physics.Arcade.Sprite;
            if (!enemy || !enemy.active) return;

            const target = enemy.getData('target') as Phaser.Physics.Arcade.Sprite | null;

            if (!target || !target.active) {
                this.recalculateEnemyTargets();
                return;
            }

            const targetX = target.x;
            const targetY = target.y;
            const angle = Phaser.Math.Angle.Between(
                enemy.x,
                enemy.y,
                targetX,
                targetY
            );

            const enemyType = enemy.getData('type') as EnemyType || this.chooseEnemyType();
            const defaultSpeed = GAME_SETTINGS.enemies[enemyType]?.speed || 100;
            const speed = enemy.getData('speed') || defaultSpeed;

            const body = enemy.body as Phaser.Physics.Arcade.Body;
            if (body) {
                this.physics.velocityFromRotation(angle, speed, body.velocity);
                enemy.rotation = angle;
            }

            const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, targetX, targetY);
            const attackRange = enemy.getData('attackRange') || 20;

            if (distance <= attackRange) {
                if (body) {
                    body.setVelocity(0, 0);
                }
                const attackFunc = enemy.getData('attack');
                if (attackFunc && typeof attackFunc === 'function') {
                    attackFunc(target);
                }
            }
        });
    }

    private findTowerAt(x: number, y: number): Tower | null {
        if (!this.towers) return null;

        let result: Tower | null = null;

        (this.towers.getChildren() as Phaser.Physics.Arcade.Sprite[]).forEach(sprite => {
            const tower = sprite as Tower;
            const distance = Phaser.Math.Distance.Between(x, y, tower.x, tower.y);

            const towerType = tower.getTowerType();
            const towerData = GAME_SETTINGS.towers[towerType];
            const tileSize = this.tileMapManager?.getTileSize ?
                this.tileMapManager.getTileSize() : GAME_SETTINGS.map.tileSize || 32;
            const hitSize = Math.max(towerData.size.width, towerData.size.height) * tileSize / 2;

            if (distance < hitSize) {
                result = tower;
            }
        });

        return result;
    }

    public startRound(): void {
        if (this.isRoundEnding) return;

        this.isRoundActive = true;
        this.currentRound++;
        console.log(`Starting round ${this.currentRound}`);

        this.hud.updateResources();

        const diffSettings = DIFFICULTY_SETTINGS[this.difficultyLevel];
        const enemyCount = Math.floor(5 + this.currentRound * 1.5 * diffSettings.enemyCountMultiplier);
        const spawnRateMultiplier = (diffSettings as any).spawnRateMultiplier || 1.0;
        const spawnDelay = Math.floor(Math.max(300, 1000 - this.currentRound * 50) * spawnRateMultiplier);

        let delay = 0;

        for (let i = 0; i < enemyCount; i++) {
            this.time.addEvent({
                delay: delay,
                callback: this.spawnEnemy,
                callbackScope: this
            });

            delay += spawnDelay;
        }

        this.time.addEvent({
            delay: delay + 5000,
            callback: this.checkRoundCompletion,
            callbackScope: this,
            loop: true
        });
    }

    private checkRoundCompletion(): void {
        if (!this.enemies || this.isRoundEnding) return;

        const activeEnemies = this.enemies.countActive();

        if (activeEnemies === 0) {
            this.endRound();
        }
    }

    private endRound(): void {
        this.isRoundEnding = true;
        this.isRoundActive = false;

        const roundBonus = this.currentRound * 20 + 50;
        this.gameState.earnResources(roundBonus);

        const roundCompleteText = this.add.text(
            this.cameras.main.worldView.centerX,
            this.cameras.main.worldView.centerY - 50,
            `Round ${this.currentRound} Complete!`,
            { fontSize: '32px', color: '#ffffff' }
        );
        roundCompleteText.setOrigin(0.5);

        const bonusText = this.add.text(
            this.cameras.main.worldView.centerX,
            this.cameras.main.worldView.centerY,
            `+${roundBonus} Resources`,
            { fontSize: '24px', color: '#ffff00' }
        );
        bonusText.setOrigin(0.5);

        this.time.delayedCall(2000, () => {
            this.tweens.add({
                targets: [roundCompleteText, bonusText],
                alpha: 0,
                duration: 1000,
                onComplete: () => {
                    roundCompleteText.destroy();
                    bonusText.destroy();
                }
            });
        });

        const healAmount = 20;
        this.user.heal(healAmount);

        this.hud.showNextRoundButton(() => {
            this.isRoundEnding = false;
        });

        this.hud.updateResources();
    }

    public getInventory(): InventorySlot[] {
        return this.user.getInventory().getInventory().filter((slot): slot is InventorySlot => slot !== null);
    }

    public equipItem(item: GameItem): void {
        this.user.equipItem(item);
        this.eventBus.emit('update-inventory');
        this.hud.updatePlayerStats();
    }

    public unequipItem(slot: string): void {
        this.user.unequipItem(slot);
        this.eventBus.emit('update-inventory');
        this.hud.updatePlayerStats();
    }

    public getHUD(): HUD {
        return this.hud;
    }

    public getDifficulty(): string {
        return this.difficultyLevel.toString();
    }

    update() {
        if (this.user && this.user.active) {
            this.user.update();
        }

        this.updateEnemies();

        if (this.enemies) {
            this.enemies.getChildren().forEach(enemy => {
                if (enemy.active && enemy instanceof Enemy) {
                    enemy.update();
                }
            });
        }

        if (this.towers) {
            this.towers.getChildren().forEach(tower => {
                if (tower.active && tower instanceof Tower) {
                    tower.update();
                }
            });
        }

        if (this.itemDropManager) {
            this.itemDropManager.update();
        }

        if (this.hud && !this.gameOverHandled) {
            this.hud.updateResources();
        }

        this.inputManager.update();

        this.cameraController.update();

        // Update debug info if enabled
        if (this.debugMode && this.debugSettings.enabled) {
            let debugInfo = '';
            if (this.debugSettings.showFPS) {
                debugInfo += `FPS: ${Math.round(this.game.loop.actualFps)}\n`;
            }
            if (this.debugSettings.showInput) {
                const pointer = this.input.activePointer;
                debugInfo += `Mouse: ${pointer.x.toFixed(0)}, ${pointer.y.toFixed(0)}\n`;
            }
            this.debugText.setText(debugInfo);

            this.showDebugInfo();
        } else {
            this.debugText.setText('');
        }
    }

    private togglePause(): void {
        if (this.scene.isPaused()) {
            this.scene.resume();
        } else {
            this.scene.pause();
        }
    }

    private chooseEnemyType(): EnemyType {
        const types = Object.values(EnemyType);
        return Phaser.Math.RND.pick(types) as EnemyType;
    }

    public toggleDebugMode() {
        this.debugMode = !this.debugMode;

        if (this.debugGraphics) {
            this.debugGraphics.clear();
        }

        // Toggle physics debug visibility
        if (this.physicsDebugGraphic) {
            this.physicsDebugGraphic.setVisible(this.debugMode && this.debugSettings.showPhysics);
        }

        if (this.debugMode) {
            this.showDebugInfo();
        }
    }

    private showDebugInfo() {
        if (!this.debugMode || !this.debugSettings.enabled || !this.debugGraphics) return;

        this.debugGraphics.clear();

        // Draw base range
        this.debugGraphics.lineStyle(2, 0x00ff00, 0.5);
        this.debugGraphics.strokeCircle(this.base.x, this.base.y, 200);

        // Draw enemy paths if enabled
        if (this.debugSettings.showPaths && this.enemies) {
            this.enemies.getChildren().forEach((obj) => {
                const enemy = obj as Enemy;
                if (!enemy.active) return;

                const target = enemy.getData('target') as Phaser.Physics.Arcade.Sprite;
                if (!target) return;

                this.debugGraphics.lineStyle(2, 0xff0000, 0.5);
                this.debugGraphics.lineBetween(enemy.x, enemy.y, target.x, target.y);
            });
        }

        // Draw tower ranges if enabled
        if (this.debugSettings.showRanges && this.towers) {
            this.towers.getChildren().forEach((obj) => {
                const tower = obj as Tower;
                if (!tower.active) return;

                this.debugGraphics.lineStyle(2, 0x0000ff, 0.3);
                this.debugGraphics.strokeCircle(tower.x, tower.y, tower.getCurrentRange());
            });
        }
    }

    private placeTower(x: number, y: number) {
        if (!this.selectedTowerType || !this.towers) return;

        const towerData = GAME_SETTINGS.towers[this.selectedTowerType];
        if (!towerData) {
            console.error(`[GameScene] Failed to get tower data for type: ${this.selectedTowerType}`);
            this.exitBuildMode();
            return;
        }

        if (!this.gameState.spendResources(towerData.price)) {
            // Show visual feedback for insufficient resources
            const text = this.add.text(
                this.cameras.main.worldView.centerX,
                this.cameras.main.worldView.centerY - 50,
                'Not enough resources!',
                { fontSize: '24px', color: '#ff0000' }
            ).setOrigin(0.5);

            this.tweens.add({
                targets: text,
                alpha: 0,
                y: text.y - 50,
                duration: 1000,
                onComplete: () => text.destroy()
            });

            this.exitBuildMode();
            return;
        }

        const tilePos = this.tileMapManager.worldToTile(x, y);
        const worldPos = this.tileMapManager.tileToWorld(tilePos.tileX, tilePos.tileY);

        if (!this.tileMapManager.isTileAvailable(
            tilePos.tileX, tilePos.tileY,
            towerData.size.width, towerData.size.height
        )) {
            // Show visual feedback for invalid placement
            const text = this.add.text(
                worldPos.x,
                worldPos.y - 20,
                'Invalid placement!',
                { fontSize: '20px', color: '#ff0000' }
            ).setOrigin(0.5);

            this.tweens.add({
                targets: text,
                alpha: 0,
                y: text.y - 30,
                duration: 1000,
                onComplete: () => text.destroy()
            });
            return;
        }

        const tower = new Tower(this, tilePos.tileX, tilePos.tileY, this.selectedTowerType);
        this.towers.add(tower, true);

        // Show placement success effect
        const flash = this.add.graphics();
        flash.lineStyle(2, 0x00ff00, 1);
        flash.strokeCircle(worldPos.x, worldPos.y, towerData.range);

        this.tweens.add({
            targets: flash,
            alpha: 0,
            duration: 500,
            onComplete: () => flash.destroy()
        });

        // Show resources spent
        const costText = this.add.text(
            worldPos.x,
            worldPos.y - 40,
            `-${towerData.price}`,
            { fontSize: '20px', color: '#ff0000' }
        ).setOrigin(0.5);

        this.tweens.add({
            targets: costText,
            alpha: 0,
            y: costText.y - 30,
            duration: 1000,
            onComplete: () => costText.destroy()
        });

        this.hud.updateResources();
        this.exitBuildMode();

        // If debug mode is on, update the debug visuals
        if (this.debugMode) {
            this.showDebugInfo();
        }
    }

    public createProjectile(x: number, y: number, texture: string): Phaser.Physics.Arcade.Sprite {
        if (!this.projectiles) {
            console.error("Projectiles group not initialized");
            this.projectiles = this.physics.add.group();
        }

        // Create the projectile sprite
        const projectile = this.physics.add.sprite(x, y, texture);
        this.projectiles.add(projectile);

        // Set the origin to 0.5, 0.5 to make rotation work properly around the center
        projectile.setOrigin(0.5, 0.5);

        // Store the base values we'll need for consistent scaling
        const BASE_RADIUS = 65; // Use your known working value
        projectile.setData('baseRadius', BASE_RADIUS);

        // Initial hitbox setup
        projectile.body.setCircle(BASE_RADIUS);

        projectile.setActive(true);
        projectile.setVisible(true);
        return projectile;
    }

    /** Shoots a projectile toward specified coordinates with properly scaled hitbox */
    public shootProjectile(
        source: Phaser.Physics.Arcade.Sprite,
        targetX: number,
        targetY: number,
        damage: number,
        projectileType: string = 'normal'
    ): void {

        console.log({
            source,
            targetX,
            targetY,
            damage,
            projectileType
        })
        if (!this.projectiles) return;

        const projectile = this.createProjectile(source.x, source.y, 'projectile');
        projectile.setData('damage', damage);
        projectile.setData('source', source);
        projectile.setData('type', projectileType);

        // Apply visual settings based on projectile type
        let scale = 0.5;

        switch (projectileType) {
            case 'player':
                projectile.setTint(0x00ff00);
                break;
            case 'player-rapid':
                projectile.setTint(0x00ffff);
                scale = 0.6;
                break;
            case 'player-power':
                projectile.setTint(0xff0000);
                scale = 1.5;
                break;
            case 'sniper':
                projectile.setTint(0x0000ff);
                scale = 0.7;
                break;
            case 'area':
                projectile.setTint(0xff00ff);
                scale = 1.2;
                break;
            case 'fire':
                projectile.setTint(0xff6600);
                break;
            case 'ice':
                projectile.setTint(0x66ffff);
                break;
            case 'critical':
                projectile.setTint(0xffff00);
                break;
        }

        // Apply scale if needed
        if (scale !== 1.0) {
            projectile.setScale(scale);

            // Get the base radius we stored
            const baseRadius = projectile.getData('baseRadius');

            // Calculate new radius proportionally to the scale
            const newRadius = Math.round(baseRadius * scale);

            // Reset the physics body with the new radius
            projectile?.body?.setCircle(newRadius);
        }

        const angle = Phaser.Math.Angle.Between(source.x, source.y, targetX, targetY);
        projectile.setRotation(angle);

        const speed = 400; // Keep consistent speed
        if (projectile.body) {
            this.physics.velocityFromRotation(angle, speed, projectile.body.velocity);
        }

        // Set timeout to destroy projectile after 3 seconds
        this.time.delayedCall(3000, () => {
            if (projectile.active) projectile.destroy();
        });
    }

    /** Sets up projectile-enemy collisions with proper hitbox handling */
    private setupProjectileCollisions(): void {
        if (!this.projectiles || !this.enemies) return;

        this.physics.add.collider(
            this.projectiles,
            this.enemies,
            (projectileObj, enemyObj) => {
                if (!(projectileObj instanceof Phaser.Physics.Arcade.Sprite) || !(enemyObj instanceof Enemy)) return;
                const projectile = projectileObj;
                const enemy = enemyObj;

                if (!projectile.active || !enemy.active) return;

                const damage = projectile.getData('damage') || 10;
                enemy.takeDamage(damage);

                // Apply special effects if any
                const specialEffect = projectile.getData('specialEffect');
                if (specialEffect) {
                    if (specialEffect.type === 'fire') {
                        enemy.applyBurnEffect(specialEffect.params.burnDamage);
                    } else if (specialEffect.type === 'ice') {
                        enemy.applySlowEffect(specialEffect.params.slowFactor, specialEffect.params.duration);
                    }
                }

                // Destroy projectile after hit
                projectile.destroy();
            },
            (projectileObj, enemyObj) => {
                return projectileObj instanceof Phaser.Physics.Arcade.Sprite &&
                       enemyObj instanceof Phaser.Physics.Arcade.Sprite &&
                       projectileObj.active && enemyObj.active
            },
            this
        );
    }

    public showPickupMessage(message: string): void {
        const text = this.add.text(
            this.cameras.main.worldView.centerX,
            this.cameras.main.worldView.centerY - 50,
            message,
            { fontSize: '24px', color: '#ffffff' }
        ).setOrigin(0.5);

        this.tweens.add({
            targets: text,
            alpha: 0,
            y: text.y - 50,
            duration: 1000,
            onComplete: () => text.destroy()
        });
    }
}