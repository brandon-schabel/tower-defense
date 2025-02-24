import Phaser from "phaser";
import Player from "../entities/player";
import Base from "../entities/base";
import HUD from "../ui/hud";
import GameState from "../utils/game-state";
import Tower from "../entities/tower";
import Enemy from "../entities/enemy";
import { GAME_SETTINGS, TowerType } from "../settings";

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
    }

    init(data: SceneInitData) {
        this.gameState = new GameState();
        if (!data.isNewGame) {
            this.gameState.loadFromLocalStorage();
        }
        this.currentRound = 0;
        // Emit event to show UI
        this.game.events.emit('start-game');
    }

    create() {
        // Create game objects
        this.add.rectangle(0, 0, 800, 600, 0x333333).setOrigin(0);
        this.base = new Base(this, 400, 300);
        this.user = new Player(this, 200, 200);

        // Set up physics groups
        this.enemies = this.physics.add.group();
        this.towers = this.physics.add.group({ immovable: true }); // Towers are static
        this.projectiles = this.physics.add.group();

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
    }

    private setupInputHandlers() {
        this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
            if (this.isBuildModeActive && this.selectedTowerType) {
                this.placeTower(pointer.x, pointer.y);
            } else {
                const towers = this.towers?.getChildren() as Tower[];
                const clickedTower = towers.find(tower => tower.getBounds().contains(pointer.x, pointer.y));
                if (clickedTower) {
                    this.selectTower(clickedTower);
                } else {
                    this.deselectTower();
                }
            }
        });

        this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
            if (this.ghostTower) {
                this.ghostTower.setPosition(pointer.x, pointer.y);
            }
        });

        // Add escape key listener, also handle closing upgrade panel
        this.input.keyboard!.on('keydown-ESC', () => {
            if (this.isBuildModeActive) {
                this.exitBuildMode();
            } else if (this.upgradePanel) { // Close upgrade panel if active
                this.upgradePanel.destroy();
                this.upgradePanel = null;
                this.selectedTower = null;
            }
        });
    }

    private setupCollisions() {
        if (!this.enemies || !this.towers || !this.projectiles) return;

        // Projectiles hit enemies
        this.physics.add.overlap(
            this.projectiles,
            this.enemies,
            (obj1, obj2) => {
                this.onProjectileHitEnemy(
                    obj1 as Phaser.Physics.Arcade.Sprite,
                    obj2 as Phaser.Physics.Arcade.Sprite
                );
            },
            undefined,
            this
        );
    }

    update() {
        this.user.update();
        this.updateTowers();
        this.updateEnemies();
        this.updateProjectiles();

        if (this.enemies && this.enemies.countActive() === 0 && this.currentRound > 0 && !this.isRoundEnding) {
            this.isRoundEnding = true;
            this.onRoundComplete();
        }
    }

    private updateTowers() {
        this.towers?.getChildren().forEach((tower: Phaser.GameObjects.GameObject) => {
            if (tower.active) {
                const towerSprite = tower as Tower;
                towerSprite.update();
            }
        });
    }

    private updateEnemies() {
        if (!this.enemies) return;

        const settings = GAME_SETTINGS.enemies;
        this.enemies.getChildren().forEach((enemy: Phaser.GameObjects.GameObject) => {
            const enemySprite = enemy as Enemy; // Cast to Enemy, not Sprite
            let target = enemySprite.getData("target") as Phaser.Physics.Arcade.Sprite;

            if (!target || !target.active) {
                this.recalculateEnemyTargets();
                target = enemySprite.getData("target") as Phaser.Physics.Arcade.Sprite;
                if (!target) {
                    console.log(`Enemy ${enemySprite.id} has no target, stopping.`); // Now it works!
                    enemySprite.setVelocity(0, 0);
                    return;
                }
            }

            if (target) {
                const dx = target.x - enemySprite.x;
                const dy = target.y - enemySprite.y;
                const distance = Math.hypot(dx, dy);

                if (distance > settings.attackDistance) {
                    // Factor in slowFactor
                    const baseSpeed = enemySprite.getData("speed") || settings.speed;
                    const slowFactor = enemySprite.getData("slowFactor") || 1;
                    const speed = baseSpeed * slowFactor;
                    this.physics.moveTo(enemySprite, target.x, target.y, speed * 20);
                } else {
                    enemySprite.setVelocity(0, 0);
                    const currentTime = this.time.now;
                    const lastDamageTime = enemySprite.getData("lastDamageTime") || 0; // Get lastDamageTime
                    if (currentTime - lastDamageTime >= settings.attackCooldown) {
                        if (target instanceof Player) {
                            target.takeDamage(settings.damageToPlayer);
                        } else if (target instanceof Tower) {
                            target.takeDamage(settings.damageToTowers);
                        } else if (target instanceof Base) {
                            target.takeDamage(settings.damageToBase);
                        }
                        enemySprite.setData("lastDamageTime", currentTime); // Update lastDamageTime
                    }
                }
            }
        });
    }

    private updateProjectiles() {
        if (!this.projectiles) return;

        this.projectiles.getChildren().forEach((projectile: Phaser.GameObjects.GameObject) => {
            const projectileSprite = projectile as Phaser.Physics.Arcade.Sprite;
            const target = projectileSprite.getData("target");

            if (target instanceof Phaser.Physics.Arcade.Sprite) {
                // Tower projectiles with dynamic targets (enemies)
                const dx = target.x - projectileSprite.x;
                const dy = target.y - projectileSprite.y;
                const distance = Math.hypot(dx, dy);

                if (distance < GAME_SETTINGS.projectiles.hitDistance) {
                    projectileSprite.destroy();
                }
            } else {
                // Player projectiles (fixed target position or no target)
                // Check if off-screen
                if (
                    projectileSprite.x < 0 ||
                    projectileSprite.x > Number(this.game.config.width) ||
                    projectileSprite.y < 0 ||
                    projectileSprite.y > Number(this.game.config.height)
                ) {
                    projectileSprite.destroy();
                }
            }
        });
    }

    public startRound() {
        this.isRoundEnding = false;
        this.currentRound++;
        this.spawnEnemies();
    }

    private spawnEnemies() {
        const settings = GAME_SETTINGS.enemies;
        const enemyCount = Math.min(
            settings.baseCount + this.currentRound * settings.countIncrementPerRound,
            settings.maxCount
        );
        for (let i = 0; i < enemyCount; i++) {
            setTimeout(() => {
                if (!this.enemies) return;
                const enemy = new Enemy(
                    this,
                    0,
                    Phaser.Math.Between(100, 500),
                    settings.baseHealth + this.currentRound * settings.healthIncrementPerRound,
                    settings.speed,
                    () => this.onEnemyKilled()
                );
                this.enemies.add(enemy);
            }, i * settings.spawnInterval);
        }
    }

    private onEnemyKilled() {
        const resourcesGained = GAME_SETTINGS.resources.perEnemyKillBase * this.currentRound;
        this.gameState.earnResources(resourcesGained);
        this.hud.updateResources();
    }

    private onRoundComplete() {
        const resourcesGained = GAME_SETTINGS.resources.perRoundCompletionBase * this.currentRound;
        this.gameState.earnResources(resourcesGained);
        this.hud.updateResources();
        this.hud.showNextRoundButton(() => {
            this.user.heal(GAME_SETTINGS.player.healPerRound);
            this.startRound();
        });
    }

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
        this.ghostTower = this.add.sprite(0, 0, towerType).setAlpha(0.5);
    }

    private placeTower(x: number, y: number) {
        if (!this.selectedTowerType || !this.towers) return;

        const towerData = GAME_SETTINGS.towers[this.selectedTowerType];
        if (!towerData || !this.gameState.spendResources(towerData.price)) {
            console.log(`Failed to place ${this.selectedTowerType}: Insufficient resources`);
            this.exitBuildMode();
            return;
        }

        const tower = new Tower(this, x, y, this.selectedTowerType);
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

    public shootProjectile(source: Phaser.Physics.Arcade.Sprite, target: Phaser.Physics.Arcade.Sprite, damage: number, specialEffect?: { type: "fire" | "ice" | "critical", params: any }) {
        if (!this.projectiles) return;

        const projectile = this.projectiles.create(source.x, source.y, 'projectile');
        projectile.setScale(0.5);
        const angle = Phaser.Math.Angle.Between(source.x, source.y, target.x, target.y);

        projectile.setData('damage', damage);
        projectile.setData('target', target);
        if (specialEffect) {
            projectile.setData('specialEffect', specialEffect);
            switch (specialEffect.type) {
                case 'fire':
                    projectile.setTint(0xff0000); // Red
                    break;
                case 'ice':
                    projectile.setTint(0x00ffff); // Cyan
                    break;
                case 'critical':
                    projectile.setTint(0xffff00); // Yellow
                    break;
            }
        }

        // --- Get Projectile Speed ---
        let projectileSpeed: number = GAME_SETTINGS.projectiles.speed; // Default speed

        if (source instanceof Tower) {
            const towerType = source.getTowerType();
            const projectileType = GAME_SETTINGS.towers[towerType].projectileType;
            projectileSpeed = GAME_SETTINGS.projectiles[projectileType].speed as number;
        } // else if ... (You can add conditions for player projectiles here later)

        this.physics.velocityFromRotation(angle, projectileSpeed, projectile.body.velocity);
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
        bg.fillRoundedRect(0, 0, 250, 350, 10);
        this.upgradePanel.add(bg);

        // Title
        const title = this.add.text(125, 20, 'Upgrade Tower', {
            fontSize: '20px',
            color: '#ffffff'
        }).setOrigin(0.5);
        this.upgradePanel.add(title);

        // Upgrade options
        const upgrades: { type: "speed" | "range" | "damage"; label: string }[] = [
            { type: 'speed', label: 'Speed' },
            { type: 'range', label: 'Range' },
            { type: 'damage', label: 'Damage' }
        ];

        upgrades.forEach((upgrade, index) => {
            const yPos = 60 + index * 40;
            // Access levels directly using the type
            const level = tower.getSpeedLevel();
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
                const yPos = 180 + index * 30;
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
}