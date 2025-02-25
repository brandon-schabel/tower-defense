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
import EnemyFactory from "../factory/enemy-factory";
import TileMapManager from "../utils/tile-map-manager";
import ItemDropManager from "../utils/item-drop-manager";
import { GameItem, InventorySlot } from "../types/item";
import InventoryManager from "../utils/inventory-manager";
import { EnemyType } from "../types/enemy-type";
import InventoryUI from "../ui/inventory-ui";

type SceneInitData = {
    isNewGame: boolean;
};

export default class GameScene extends Phaser.Scene {
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
    private selectedTower: Tower | null = null;
    private upgradePanel: Phaser.GameObjects.Container | null = null;
    private rangeCircle: Phaser.GameObjects.Graphics | null = null;
    private powerUpSpawnTimer: Phaser.Time.TimerEvent | null = null;
    private difficultyLevel: DifficultyLevel = DifficultyLevel.Medium;
    private enemyFactory!: EnemyFactory;
    private tileMapManager!: TileMapManager;
    private itemDropManager!: ItemDropManager;
    private inventoryUI!: InventoryUI;
    private isInventoryVisible: boolean = false;

    constructor() {
        super({ key: "GameScene" });
    }

    preload() {
        // Load assets
        this.load.svg("user", "/assets/user.svg");
        this.load.svg("base", "/assets/base.svg");
        Object.entries(GAME_SETTINGS.towers).forEach(([key, data]) => {
            this.load.svg(key, `/assets/${data.texture}.svg`);
        });
        this.load.svg("projectile", "/assets/projectile.svg");
        this.load.svg("enemy", "/assets/enemy.svg");

        // Load tileset images
        this.load.svg('terrain-tiles', '/assets/terrain-tiles.svg');

        // Add error handler for texture loading
        this.load.on('loaderror', (fileObj: any) => {
            console.error('Error loading asset:', fileObj.key);
        });

        // Add completion handler to verify loaded textures
        this.load.on('complete', () => {
            console.log('All assets loaded successfully');
            
            // Check if item textures loaded correctly
            const itemTextures = [
                'resource-small', 'resource-medium', 'resource-large',
                'health-small', 'health-medium', 'health-large',
                'weapon-blaster', 'weapon-rapid', 'weapon-cannon'
            ];
            
            itemTextures.forEach(texture => {
                const textureExists = this.textures.exists(texture);
                console.log(`Texture ${texture}: ${textureExists ? 'Loaded' : 'MISSING'}`);
            });
        });

        // Load item assets
        this.load.svg('resource-small', '/assets/items/resource-small.svg');
        this.load.svg('resource-medium', '/assets/items/resource-medium.svg');
        this.load.svg('resource-large', '/assets/items/resource-large.svg');
        
        this.load.svg('health-small', '/assets/items/health-small.svg');
        this.load.svg('health-medium', '/assets/items/health-medium.svg');
        this.load.svg('health-large', '/assets/items/health-large.svg');
        
        this.load.svg('weapon-blaster', '/assets/items/weapon-blaster.svg');
        this.load.svg('weapon-rapid', '/assets/items/weapon-rapid.svg');
        this.load.svg('weapon-cannon', '/assets/items/weapon-cannon.svg');
        
        this.load.svg('blueprint-normal', '/assets/items/blueprint-normal.svg');
        this.load.svg('blueprint-sniper', '/assets/items/blueprint-sniper.svg');
        this.load.svg('blueprint-area', '/assets/items/blueprint-area.svg');
        
        this.load.svg('upgrade-tower-damage', '/assets/items/upgrade-tower-damage.svg');
        this.load.svg('upgrade-player-speed', '/assets/items/upgrade-player-speed.svg');
        this.load.svg('upgrade-base-armor', '/assets/items/upgrade-base-armor.svg');
        
        // Load UI assets
        this.load.svg('inventory-slot', '/assets/ui/inventory-slot.svg');
        this.load.svg('inventory-bg', '/assets/ui/inventory-bg.svg');
        
        // Load additional assets for decorations, etc.
        this.load.svg('bush', '/assets/decorations/bush.svg');
        this.load.svg('tree', '/assets/decorations/tree.svg');
        // More decoration assets...
    }

    init(data: SceneInitData) {
        this.gameState = new GameState();
        if (!data.isNewGame) {
            this.gameState.loadFromLocalStorage();
        }
        this.currentRound = 0;
        // Emit event to show UI
        this.game.events.emit('start-game');

        // Initialize power-up timer
        this.initPowerUpTimer();
    }

    create() {
        // Create game objects
        this.add.rectangle(0, 0, 800, 600, 0x333333).setOrigin(0);

        // Initialize tile map before creating entities
        this.tileMapManager = new TileMapManager(this);

        // Place decorations randomly
        this.placeDecorativeTiles();

        // Create base at a specific tile position
        const basePos = this.tileMapManager.tileToWorld(
            Math.floor(GAME_SETTINGS.map.width / 2),
            Math.floor(GAME_SETTINGS.map.height / 2)
        );
        this.base = new Base(this, basePos.x, basePos.y);

        // Place player at a valid position near the base
        const playerStart = this.findValidStartPosition();
        this.user = new Player(this, playerStart.x, playerStart.y);

        // Set up physics groups
        this.enemies = this.physics.add.group();
        this.towers = this.physics.add.group({ immovable: true }); // Towers are static
        this.projectiles = this.physics.add.group();

        // Initialize item drop manager
        this.itemDropManager = new ItemDropManager(this, this.tileMapManager);

        // Initialize inventory UI (initially hidden)
        this.inventoryUI = new InventoryUI(this, this.user.getInventory());
        this.inventoryUI.hide(); // Start hidden

        // Initialize HUD
        this.hud = new HUD(this);

        // Set up input handlers
        this.setupInputHandlers();

        // Set up collisions
        this.setupCollisions();

        // Add timer for enemy target recalculation
        this.time.addEvent({
            delay: GAME_SETTINGS.game.enemyTargetRecalculationInterval,
            callback: () => {
                this.recalculateEnemyTargets();
            },
            loop: true
        });

        // Initialize enemy factory
        this.enemyFactory = new EnemyFactory(this);

        // Set up camera to follow player
        this.cameras.main.startFollow(this.user, true);
    }

    // Helper to find valid starting position near the base
    private findValidStartPosition() {
        const baseTile = this.tileMapManager.worldToTile(this.base.x, this.base.y);

        // Search for a valid spot in a spiral pattern from the base
        for (let radius = 1; radius < 20; radius++) {
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dy = -radius; dy <= radius; dy++) {
                    // Only check the perimeter of the current radius
                    if (Math.abs(dx) === radius || Math.abs(dy) === radius) {
                        const tileX = baseTile.tileX + dx;
                        const tileY = baseTile.tileY + dy;

                        if (this.tileMapManager.isTileAvailable(tileX, tileY, 1, 1)) {
                            return this.tileMapManager.tileToWorld(tileX, tileY);
                        }
                    }
                }
            }
        }

        // Fallback position if no valid spot found
        return this.tileMapManager.tileToWorld(baseTile.tileX + 5, baseTile.tileY);
    }

    // Place decorative elements on the map
    private placeDecorativeTiles() {
        // Place a certain number of decorations randomly
        for (let i = 0; i < GAME_SETTINGS.map.decorationCount; i++) {
            const decorType = Phaser.Math.RND.pick(['bush', 'tree', 'rock']);
            const decorSize = decorType === 'tree' ? 2 : 1; // Trees take up more tiles

            // Find valid placement
            const position = this.tileMapManager.findValidPlacement(decorSize, decorSize);
            if (position) {
                const worldPos = this.tileMapManager.tileToWorld(position.tileX, position.tileY);

                // Create decoration sprite
                const decoration = this.add.image(worldPos.x, worldPos.y, decorType);

                // Mark tiles as occupied
                this.tileMapManager.occupyTiles(
                    position.tileX, position.tileY,
                    decorSize, decorSize,
                    'decoration', `decor_${i}`
                );
            }
        }
    }

    // Add method to get the tile map manager
    public getTileMapManager(): TileMapManager {
        return this.tileMapManager;
    }

    // Update placeTower method to use tile coordinates
    enterBuildMode(towerType: TowerType) {
        if (this.isBuildModeActive) return;

        const towerData = GAME_SETTINGS.towers[towerType];
        if (!towerData) {
            console.log('Invalid tower type selected');
            return;
        }

        if (!this.gameState.canAfford(towerData.price)) {
            console.log('Not enough resources to select this tower');
            this.exitBuildMode();  // Ensure build mode exits if already active, or cannot afford
            return;
        }

        this.isBuildModeActive = true;
        this.selectedTowerType = towerType;

        if (this.ghostTower) {
            this.ghostTower.destroy();
        }

        // Get tower size in tiles
        const towerData2 = GAME_SETTINGS.towers[towerType];
        const towerWidth = towerData2.size.width;
        const towerHeight = towerData2.size.height;

        // Create ghost tower for placement preview
        this.ghostTower = this.add.sprite(0, 0, towerType).setAlpha(0.5);

        // Update ghost tower position and validation on pointer move
        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (this.ghostTower) {
                const tilePos = this.tileMapManager.worldToTile(pointer.worldX, pointer.worldY);
                const worldPos = this.tileMapManager.tileToWorld(tilePos.tileX, tilePos.tileY);

                this.ghostTower.setPosition(worldPos.x, worldPos.y);

                // Check if placement is valid
                const isValid = this.tileMapManager.isTileAvailable(
                    tilePos.tileX, tilePos.tileY,
                    towerWidth, towerHeight
                );

                // Visual feedback for valid/invalid placement
                this.ghostTower.setTint(isValid ? 0xffffff : 0xff0000);
            }
        });
    }

    private placeTower(x: number, y: number) {
        if (!this.selectedTowerType || !this.towers) return;

        const towerData = GAME_SETTINGS.towers[this.selectedTowerType];
        if (!towerData || !this.gameState.spendResources(towerData.price)) {
            console.log(`Failed to place ${this.selectedTowerType}: Insufficient resources`);
            this.exitBuildMode();
            return;
        }

        // Convert world coordinates to tile coordinates
        const tilePos = this.tileMapManager.worldToTile(x, y);

        // Check if placement is valid
        if (!this.tileMapManager.isTileAvailable(
            tilePos.tileX, tilePos.tileY,
            towerData.size.width, towerData.size.height
        )) {
            console.log(`Cannot place tower at this location. Tiles are occupied.`);
            return;
        }

        // Create tower with tile coordinates
        const tower = new Tower(this, tilePos.tileX, tilePos.tileY, this.selectedTowerType);
        this.towers.add(tower, true);

        console.log(`Placed ${this.selectedTowerType}. Resources remaining: ${this.gameState.getResources()}`);
        this.hud.updateResources();
        this.exitBuildMode();
    }

    private exitBuildMode() {
        this.isBuildModeActive = false;
        this.selectedTowerType = null;
        if (this.ghostTower) {
            this.ghostTower.destroy();
            this.ghostTower = null;
        }
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
        const damage = projectile.getData('damage') || 20; // Default to 20 if not set
        (enemy as Enemy).takeDamage(damage);

        // Apply special effects
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

        this.upgradePanel = this.add.container(150, 100); // Adjusted position for visibility

        // Background with rounded corners and semi-transparency
        const bg = this.add.graphics();
        bg.fillStyle(0x000000, 0.8);
        bg.fillRoundedRect(0, 0, 250, 400, 10); // Increased height for tier upgrade option
        this.upgradePanel.add(bg);

        // Title
        const title = this.add.text(125, 20, `Upgrade Tower (Tier ${tower.getTier()})`, {
            fontSize: '20px',
            color: '#ffffff'
        }).setOrigin(0.5);
        this.upgradePanel.add(title);

        // Tier upgrade option (placed at the top)
        if (tower.getTier() < tower.getMaxTier()) {
            const tierCost = tower.getTierUpgradeCost();
            const tierButton = this.add.text(20, 50, `Upgrade to Tier ${tower.getTier() + 1} - ${tierCost}`, {
                fontSize: '16px',
                color: '#ffa500' // Orange for tier upgrades
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

        // Upgrade options
        const upgrades: { type: "speed" | "range" | "damage"; label: string }[] = [
            { type: 'speed', label: 'Speed' },
            { type: 'range', label: 'Range' },
            { type: 'damage', label: 'Damage' }
        ];

        upgrades.forEach((upgrade, index) => {
            const yPos = 90 + index * 40; // Adjusted position to make room for tier upgrade
            // Get the appropriate level based on the upgrade type
            let level = 0;
            switch(upgrade.type) {
                case 'speed': level = tower.getSpeedLevel(); break;
                case 'range': level = tower.getRangeLevel(); break;
                case 'damage': level = tower.getDamageLevel(); break;
            }
            const cost = tower.getUpgradeCost(upgrade.type);
            const buttonText = `${upgrade.label} (Lv.${level}) - ${cost}`;

            const button = this.add.text(20, yPos, buttonText, {
                fontSize: '16px',
                color: '#ffffff'
            }).setWordWrapWidth(210); // Wrap text within panel width
            button.setInteractive();
            // Call upgradeTower with the correct type
            button.on('pointerdown', () => this.upgradeTower(tower, upgrade.type));
            button.on('pointerover', () => button.setStyle({ color: '#ffff00' }));
            button.on('pointerout', () => button.setStyle({ color: '#ffffff' }));

            if (level >= tower.getMaxUpgradeLevel() || !this.gameState.canAfford(cost)) {
                button.setStyle({ color: '#888888' });
                button.disableInteractive();
            }
            this.upgradePanel?.add(button);
        });

        // Special powers (if none selected)
        if (!tower.getSpecialPower()) {
            const specialPowers: { type: "fire" | "ice" | "critical"; label: string; color: string; }[] = [
                { type: 'fire', label: 'Fire', color: '#ff0000' },
                { type: 'ice', label: 'Ice', color: '#00ffff' },
                { type: 'critical', label: 'Critical', color: '#ffff00' }
            ];

            specialPowers.forEach((power, index) => {
                const yPos = 210 + index * 30; // Adjusted position
                const button = this.add.text(20, yPos, `${power.label} - 500`, {
                    fontSize: '16px',
                    color: power.color
                });
                button.setInteractive();
                // Call purchaseSpecialPower with the correct type
                button.on('pointerdown', () => this.purchaseSpecialPower(tower, power.type));
                button.on('pointerover', () => button.setStyle({ color: '#ffffff' }));
                button.on('pointerout', () => button.setStyle({ color: power.color }));

                if (!this.gameState.canAfford(500)) {
                    button.setStyle({ color: '#888888' });
                    button.disableInteractive();
                }
                if (this.upgradePanel) { // Check if upgradePanel is null before adding
                    this.upgradePanel.add(button);
                }
            });
        }

        // Add tower stats display
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

        // Close button
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

        // Simple animation
        this.upgradePanel.setScale(0.9);
        this.tweens.add({
            targets: this.upgradePanel,
            scale: 1,
            duration: 200,
            ease: 'Power2'
        });
    }

    // Method to handle tier upgrades for towers
    private tierUpgradeTower(tower: Tower) {
        const cost = tower.getTierUpgradeCost();
        
        if (this.gameState.canAfford(cost)) {
            if (this.gameState.spendResources(cost)) {
                tower.upgradeTier();
                
                // Update the upgrade panel to reflect the new tier
                this.showUpgradePanel(tower);
                
                // Visual effect for tier upgrade
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
                
                // Play sound (commented out for now)
                // this.sound.play('tower-upgrade');
            }
        }
    }

    private upgradeTower(tower: Tower, upgradeType: "speed" | "range" | "damage") {
        const cost = tower.getUpgradeCost(upgradeType);
        if (this.gameState.canAfford(cost)) {
            this.gameState.spendResources(cost);
            tower.upgrade(upgradeType);
            this.hud.updateResources();
            this.showUpgradePanel(tower); // Refresh the panel to update costs/levels
            this.hud.updateTowerStats(tower);
        }
    }

    private purchaseSpecialPower(tower: Tower, powerType: "fire" | "ice" | "critical") {
        if (this.gameState.canAfford(tower.getSpecialPowerCost())) {
            this.gameState.spendResources(tower.getSpecialPowerCost());
            tower.setSpecialPower(powerType);
            this.hud.updateResources();
            this.showUpgradePanel(tower); // Refresh panel
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
        return this.enemies.getChildren() as Phaser.Physics.Arcade.Sprite[];
    }

    public recalculateEnemyTargets() {
        if (!this.enemies || !this.towers) return;

        const towersLeft = this.towers.countActive(true);

        this.enemies.getChildren().forEach((obj) => {
            const enemy = obj as Phaser.Physics.Arcade.Sprite;
            if (!enemy.active) return;

            const distToUser = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.user.x, this.user.y);
            let newTarget: Phaser.Physics.Arcade.Sprite | null = null;

            if (distToUser < 100) {
                newTarget = this.user;
            } else {
                if (towersLeft > 0) {
                    const nearestTower = this.findNearestTower(enemy.x, enemy.y, Infinity);
                    newTarget = nearestTower || (this.base.active ? this.base : null); // Fallback to base if no tower
                } else {
                    newTarget = this.base.active ? this.base : null; // Always target base when no towers left, and check if base is active
                }
            }

            enemy.setData("target", newTarget);
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
        this.rangeCircle.lineStyle(2, 0xffffff, 0.5); // White, semi-transparent
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

    // Initialize power-up timer
    private initPowerUpTimer() {
        this.powerUpSpawnTimer = this.time.addEvent({
            delay: 60000, // Spawn every 60 seconds
            callback: this.spawnRandomPowerUp,
            callbackScope: this,
            loop: true
        });
    }

    private spawnRandomPowerUp() {
        // Only spawn during combat phase
        if (this.isRoundEnding) return;

        // Choose a random power-up type
        const powerUpTypes = Object.values(PowerUpType);
        const randomType = Phaser.Math.RND.pick(powerUpTypes);

        // Find a valid spawn position that's visible to the player
        const camera = this.cameras.main;
        let spawnX = Phaser.Math.Between(
            camera.scrollX + 100,
            camera.scrollX + camera.width - 100
        );
        let spawnY = Phaser.Math.Between(
            camera.scrollY + 100,
            camera.scrollY + camera.height - 100
        );

        // Create the power-up with the correct type 
        // Use local PowerUpType to avoid type conflicts
        const powerUp = new PowerUp(this, spawnX, spawnY, randomType as PowerUpType);

        // Simple visual effect instead of using particles
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

    // Add method to set difficulty
    public setDifficulty(level: DifficultyLevel) {
        this.difficultyLevel = level;
    }

    // Add method to get the item drop manager
    public getItemDropManager(): ItemDropManager {
        return this.itemDropManager;
    }

    /**
     * Toggle inventory UI visibility
     */
    public toggleInventoryUI(): void {
        this.isInventoryVisible = !this.isInventoryVisible;
        
        if (this.isInventoryVisible) {
            this.inventoryUI.show();
        } else {
            this.inventoryUI.hide();
        }
    }

    /**
     * Shoot a projectile from a source to a target
     * @param source The entity shooting
     * @param target The target entity
     * @param damage Amount of damage the projectile does
     * @param projectileType Type of projectile to use (visual and behavior)
     */
    public shootProjectile(
        source: Phaser.Physics.Arcade.Sprite,
        target: Phaser.Physics.Arcade.Sprite,
        damage: number,
        projectileType: string = 'normal'
    ): void {
        if (!this.projectiles) return;

        // Create projectile at source position - FIXED: Use physics.add.sprite instead of just add.sprite
        const projectile = this.physics.add.sprite(source.x, source.y, 'projectile');
        this.projectiles.add(projectile);

        // Set projectile to be visible and active (debug fix for rendering issues)
        projectile.setVisible(true);
        projectile.setActive(true);

        // Set data needed for damage calculations
        projectile.setData('damage', damage);
        projectile.setData('source', source);
        projectile.setData('type', projectileType);

        // Apply visual effects based on projectile type
        switch (projectileType) {
            case 'player':
                projectile.setTint(0x00ff00); // Green for player projectiles
                break;
            case 'player-rapid':
                projectile.setTint(0x00ffff); // Cyan for rapid projectiles
                projectile.setScale(0.6); // Smaller projectiles
                break;
            case 'player-power':
                projectile.setTint(0xff0000); // Red for power projectiles
                projectile.setScale(1.5); // Larger projectiles
                break;
            case 'normal':
                // Default color
                break;
            case 'sniper':
                projectile.setTint(0x0000ff); // Blue for sniper
                projectile.setScale(0.7);
                break;
            case 'area':
                projectile.setTint(0xff00ff); // Purple for area
                projectile.setScale(1.2);
                break;
        }

        // Calculate velocity toward target
        const angle = Phaser.Math.Angle.Between(source.x, source.y, target.x, target.y);
        
        // Get the appropriate speed from settings - fix type access
        let speed = GAME_SETTINGS.projectiles.speed;
        if (projectileType in GAME_SETTINGS.projectiles) {
            const projectileConfig = GAME_SETTINGS.projectiles[projectileType as keyof typeof GAME_SETTINGS.projectiles];
            if (typeof projectileConfig === 'object' && 'speed' in projectileConfig) {
                speed = (projectileConfig as any).speed;
            }
        }
        
        // Set projectile properties
        projectile.setRotation(angle);
        
        // Check if body exists before setting velocity
        if (projectile.body) {
            // Use proper physics body setup
            this.physics.velocityFromRotation(
                angle, 
                speed, 
                (projectile.body as Phaser.Physics.Arcade.Body).velocity
            );
        } else {
            // Fallback method if body isn't ready yet
            console.warn('Projectile body not initialized, using direct velocity');
            const velocityX = Math.cos(angle) * speed;
            const velocityY = Math.sin(angle) * speed;
            projectile.setVelocity(velocityX, velocityY);
        }

        // Log for debugging
        console.log(`Projectile created at (${source.x}, ${source.y}) with angle ${angle}`);

        // Destroy projectile after a certain time if it doesn't hit anything
        this.time.delayedCall(3000, () => {
            if (projectile.active) {
                projectile.destroy();
            }
        });
    }

    /**
     * Add an item to the player's inventory (used by entities like towers when giving items to player)
     * @param item Item to add to inventory
     * @returns Whether the item was successfully added
     */
    public addItemToInventory(item: GameItem): boolean {
        if (!this.user || !this.user.active) return false;
        return this.user.addItemToInventory(item);
    }

    public getDifficultyLevel(): DifficultyLevel {
        return this.difficultyLevel;
    }

    private setupInputHandlers(): void {
        // Player input is handled in Player class
        
        // Add input for toggling inventory
        this.input.keyboard?.addKey('I').on('down', () => {
            this.toggleInventoryUI();
        });
        
        // Add input for game pause
        this.input.keyboard?.addKey('P').on('down', () => {
            if (this.scene.isPaused()) {
                this.scene.resume();
            } else {
                this.scene.pause();
            }
        });
        
        // Clicking anywhere exits build mode unless clicking on a tower
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
            
            // Check if clicked on a tower
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
        
        // Projectiles hit enemies
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
        
        // Enemies attack base when they reach it
        this.physics.add.overlap(
            this.enemies,
            this.base,
            (enemy, base) => {
                (enemy as Phaser.Physics.Arcade.Sprite).destroy();
                (base as Base).takeDamage(10);
            },
            undefined,
            this
        );
        
        // Collisions between enemies and player
        this.physics.add.overlap(
            this.enemies,
            this.user,
            (enemyObj, playerObj) => {
                const enemy = enemyObj as Phaser.Physics.Arcade.Sprite;
                const player = playerObj as Player;
                
                // Deal damage to player - FIXED: Direct call instead of getData
                player.takeDamage(5);
                
                // Knockback effect
                const angle = Phaser.Math.Angle.Between(
                    enemy.x, 
                    enemy.y,
                    player.x, 
                    player.y
                );
                const knockbackForce = 200;
                player.setVelocity(
                    Math.cos(angle) * knockbackForce,
                    Math.sin(angle) * knockbackForce
                );
            },
            undefined,
            this
        );
    }

    private updateEnemies(): void {
        if (!this.enemies) return;
        
        this.enemies.getChildren().forEach(gameObj => {
            const enemy = gameObj as Phaser.Physics.Arcade.Sprite;
            if (!enemy.active) return;
            
            const target = enemy.getData('target') as Phaser.Physics.Arcade.Sprite | null;
            
            if (!target || !target.active) {
                // Target destroyed, find a new one
                this.recalculateEnemyTargets();
                return;
            }
            
            // Move towards target
            const targetX = target.x;
            const targetY = target.y;
            const angle = Phaser.Math.Angle.Between(
                enemy.x, 
                enemy.y, 
                targetX, 
                targetY
            );
            
            // Get enemy speed from its data
            const speed = enemy.getData('speed') || GAME_SETTINGS.enemies.speed;
            
            const body = enemy.body as Phaser.Physics.Arcade.Body;
            this.physics.velocityFromRotation(angle, speed, body.velocity);
            
            // Rotate to face target
            enemy.rotation = angle;
            
            // Attack if in range
            const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, targetX, targetY);
            const attackRange = enemy.getData('attackRange') || 20;
            
            if (distance <= attackRange) {
                enemy.setVelocity(0, 0);
                const attackFunc = enemy.getData('attack');
                if (attackFunc && typeof attackFunc === 'function') {
                    attackFunc(target);
                }
            }
        });
    }

    // Add this method to find tower at specific coordinates
    private findTowerAt(x: number, y: number): Tower | null {
        if (!this.towers) return null;
        
        let result: Tower | null = null;
        
        (this.towers.getChildren() as Phaser.Physics.Arcade.Sprite[]).forEach(sprite => {
            const tower = sprite as Tower;
            const distance = Phaser.Math.Distance.Between(x, y, tower.x, tower.y);
            
            // Use tower size for hit test
            const towerType = tower.getTowerType();
            const towerData = GAME_SETTINGS.towers[towerType];
            // Use a safer property access for getTileSize
            const tileSize = this.tileMapManager?.getTileSize ? 
                this.tileMapManager.getTileSize() : GAME_SETTINGS.map.tileSize || 32;
            const hitSize = Math.max(towerData.size.width, towerData.size.height) * tileSize / 2;
            
            if (distance < hitSize) {
                result = tower;
            }
        });
        
        return result;
    }

    // Add start round methods
    public startRound(): void {
        if (this.isRoundEnding) return;
        
        this.currentRound++;
        console.log(`Starting round ${this.currentRound}`);
        
        // Disable build buttons during combat
        this.hud.updateResources();
        
        // Define enemies for this round based on difficulty
        const diffSettings = DIFFICULTY_SETTINGS[this.difficultyLevel];
        const enemyCount = Math.floor(5 + this.currentRound * 1.5 * diffSettings.enemyCountMultiplier);
        // Use default spawn rate if spawnRateMultiplier is not defined
        const spawnRateMultiplier = (diffSettings as any).spawnRateMultiplier || 1.0;
        const spawnDelay = Math.floor(Math.max(300, 1000 - this.currentRound * 50) * spawnRateMultiplier);
        
        // Spawn enemies
        let delay = 0;
        
        for (let i = 0; i < enemyCount; i++) {
            this.time.addEvent({
                delay: delay,
                callback: this.spawnEnemy,
                callbackScope: this
            });
            
            delay += spawnDelay;
        }
        
        // Check for round completion
        this.time.addEvent({
            delay: delay + 5000, // Give extra time for last enemies to be killed
            callback: this.checkRoundCompletion,
            callbackScope: this,
            loop: true
        });
    }

    private spawnEnemy(): void {
        if (!this.enemies) return;
        
        // Choose random enemy type based on current round
        let enemyTypes = [EnemyType.Normal];
        if (this.currentRound >= 3) enemyTypes.push(EnemyType.Fast);
        if (this.currentRound >= 5) enemyTypes.push(EnemyType.Heavy);
        if (this.currentRound >= 10 && this.currentRound % 5 === 0) enemyTypes.push(EnemyType.Boss);
        if (this.currentRound >= 7) enemyTypes.push(EnemyType.Flying);
        
        const enemyType = Phaser.Math.RND.pick(enemyTypes);
        
        // Find a valid spawn location at the edge of the map
        // Use a safer property access for getTileSize
        const tileSize = this.tileMapManager?.getTileSize ? 
            this.tileMapManager.getTileSize() : GAME_SETTINGS.map.tileSize || 32;
        const mapWidth = GAME_SETTINGS.map.width * tileSize;
        const mapHeight = GAME_SETTINGS.map.height * tileSize;
        
        // Choose a random edge to spawn from
        const edge = Phaser.Math.Between(0, 3);
        let x = 0;
        let y = 0;
        
        switch (edge) {
            case 0: // Top edge
                x = Phaser.Math.Between(0, mapWidth);
                y = 0;
                break;
            case 1: // Right edge
                x = mapWidth;
                y = Phaser.Math.Between(0, mapHeight);
                break;
            case 2: // Bottom edge
                x = Phaser.Math.Between(0, mapWidth);
                y = mapHeight;
                break;
            case 3: // Left edge
                x = 0;
                y = Phaser.Math.Between(0, mapHeight);
                break;
        }
        
        // Spawn the enemy - fixed parameters to match EnemyFactory.createEnemy
        const healthMultiplier = 1 + (this.currentRound - 1) * 0.2;
        const speedMultiplier = 1 + (this.currentRound - 1) * 0.05;
        
        // Fix the parameter types to match the EnemyFactory interface
        const enemy = this.enemyFactory.createEnemy(
            enemyType,
            x,
            y,
            healthMultiplier,
            speedMultiplier
        );
        
        this.enemies.add(enemy);
        
        // Set initial target
        enemy.setData('target', this.base);
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
        
        // Award resources for completing the round
        const roundBonus = this.currentRound * 20 + 50;
        this.gameState.earnResources(roundBonus);
        
        // Show message
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
        
        // Fade out text after a delay
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
        
        // Heal player
        const healAmount = 20;
        this.user.heal(healAmount);
        
        // Show next round button
        this.hud.showNextRoundButton(() => {
            this.isRoundEnding = false;
        });
        
        // Update HUD
        this.hud.updateResources();
    }

    // Add inventory-related methods for HUD compatibility
    public getInventory(): InventorySlot[] {
        if (this.user) {
            // Access the inventory manager correctly
            const inventory = this.user.getInventory();
            // Filter out any null values
            return inventory.getInventory().filter((slot): slot is InventorySlot => slot !== null);
        }
        return [];
    }

    public equipItem(item: any): void {
        // The real implementation would use proper typing
        if (this.user) {
            this.user.equipItem(item);
        }
    }

    public unequipItem(item: any): void {
        // This would be implemented properly with the actual inventory system
        console.log("Unequipping item:", item);
    }

    // Add getter for HUD
    public getHUD(): HUD {
        return this.hud;
    }
    
    // Add getDifficulty method for HUD compatibility
    public getDifficulty(): string {
        // Return the current difficulty as a string
        // You might want to modify this to return a more specific value
        return this.difficultyLevel.toString();
    }

    /**
     * Main update loop called by Phaser every frame
     * This is required to update all game entities
     */
    update(time: number, delta: number) {
        // Update the player (should happen automatically through the scene system)
        if (this.user && this.user.active) {
            this.user.update();
        }

        // Update all enemies
        this.updateEnemies();

        // Update active enemies to ensure they run their own internal update logic
        if (this.enemies) {
            this.enemies.getChildren().forEach(enemy => {
                if (enemy.active && enemy instanceof Enemy) {
                    enemy.update();
                }
            });
        }

        // Update tower actions like shooting
        if (this.towers) {
            this.towers.getChildren().forEach(tower => {
                if (tower.active && tower instanceof Tower) {
                    tower.update();
                }
            });
        }

        // Update dropped items
        if (this.itemDropManager) {
            this.itemDropManager.update();
        }

        // Update HUD if game is still active
        if (this.hud && !this.gameOverHandled) {
            this.hud.updateResources();
        }
    }
}