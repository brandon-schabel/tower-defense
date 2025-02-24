import Phaser from "phaser";
import User from "../entities/user";
import Base from "../entities/base";
import HUD from "../ui/hud";
import GameState from "../utils/game-state";
import { TOWER_TYPES } from "../ui/hud";
import Tower from "../entities/tower";
import Enemy from "../entities/enemy";

type SceneInitData = {
    isNewGame: boolean;
};

export default class GameScene extends Phaser.Scene {
    private gameState!: GameState;
    private user!: User;
    private base!: Base;
    private hud!: HUD;
    private isBuildModeActive: boolean = false;
    private ghostTower: Phaser.GameObjects.Sprite | null = null;
    private selectedTowerType: string | null = null;
    private enemies?: Phaser.Physics.Arcade.Group;
    private towers?: Phaser.Physics.Arcade.Group;
    private projectiles?: Phaser.Physics.Arcade.Group;
    private currentRound: number = 0;
    private gameOverHandled = false;
    private isRoundEnding: boolean = false;

    constructor() {
        super({ key: "GameScene" });
    }

    preload() {
        // Load assets
        this.load.svg("user", "/assets/user.svg");
        this.load.svg("base", "/assets/base.svg");
        Object.entries(TOWER_TYPES).forEach(([key, data]) => {
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
        this.createGameObjects();
        
        // Set up physics groups
        this.setupPhysics();
        
        // Initialize HUD
        this.hud = new HUD(this);
        
        // Set up input handlers
        this.setupInputHandlers();
        
        // Set up collisions
        this.setupCollisions();

        // Add timer for enemy target recalculation
        this.time.addEvent({
            delay: 1000, // Every 1000ms (1 second)
            callback: () => {
                this.recalculateEnemyTargets();
            },
            loop: true // Repeat indefinitely
        });
    }

    private createGameObjects() {
        this.add.rectangle(0, 0, 800, 600, 0x333333).setOrigin(0);
        this.base = new Base(this, 400, 300);
        this.user = new User(this, 200, 200);

        // Add a test sprite to check physics
        const testSprite = this.physics.add.sprite(100, 100, "projectile");
        testSprite.setVelocity(100, 0); // Should move right
    }

    private setupPhysics() {
        this.enemies = this.physics.add.group();
        this.towers = this.physics.add.group({ immovable: true }); // Towers are static
        this.projectiles = this.physics.add.group();
    }

    private setupInputHandlers() {
        this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
            if (this.isBuildModeActive && this.selectedTowerType) {
                this.placeTower(pointer.x, pointer.y);
            }
        });

        this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
            if (this.ghostTower) {
                this.ghostTower.setPosition(pointer.x, pointer.y);
            }
        });

        // Add escape key listener
        this.input.keyboard!.on('keydown-ESC', () => { // Use 'keydown-ESC'
            if (this.isBuildModeActive) {
                this.exitBuildMode();
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

                if (distance > 20) {
                    const speed = enemySprite.getData("speed") || 2;
                    this.physics.moveTo(enemySprite, target.x, target.y, speed * 20);
                } else {
                    enemySprite.setVelocity(0, 0);
                    const currentTime = this.time.now;
                    const lastDamageTime = enemySprite.getData("lastDamageTime") || 0; // Get lastDamageTime
                    if (currentTime - lastDamageTime >= 1000) { // 1-second cooldown
                        if (target instanceof User) {
                            target.takeDamage(1);
                        } else if (target instanceof Tower) {
                            target.takeDamage(10);
                        } else if (target instanceof Base) {
                            target.takeDamage(10);
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

                if (distance < 5) {
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
        const enemyCount = Math.min(5 + this.currentRound * 2, 20);
        for (let i = 0; i < enemyCount; i++) {
            setTimeout(() => {
                if (!this.enemies) return;
                const enemy = new Enemy(
                    this,
                    0,
                    Phaser.Math.Between(100, 500),
                    50 + this.currentRound * 10,
                    2,
                    () => this.onEnemyKilled()
                );
                this.enemies.add(enemy);
            }, i * 1000);
        }
    }

    private onEnemyKilled() {
        const resourcesGained = this.currentRound * 5;
        this.gameState.earnResources(resourcesGained);
        this.hud.updateResources();
    }

    private onRoundComplete() {
        this.gameState.earnResources(100 * this.currentRound);
        this.hud.updateResources();
        this.hud.showNextRoundButton(() => {
            this.user.heal(20);
            this.startRound();
        });
    }

    enterBuildMode(towerType: string) {
        if (this.isBuildModeActive) return;

        const towerData = TOWER_TYPES[towerType];
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

        const towerData = TOWER_TYPES[this.selectedTowerType];
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

    public shootProjectile(source: Phaser.Physics.Arcade.Sprite, target: Phaser.Physics.Arcade.Sprite, towerData: typeof TOWER_TYPES[keyof typeof TOWER_TYPES]) {
        if (!this.projectiles) return;

        const projectile = this.projectiles.create(source.x, source.y, 'projectile');
        projectile.setScale(0.5);
        const angle = Phaser.Math.Angle.Between(source.x, source.y, target.x, target.y);

        projectile.setData('damage', towerData.damage);
        projectile.setData('target', target);

        this.physics.velocityFromRotation(angle, 300, projectile.body.velocity);
    }

    private onProjectileHitEnemy(projectile: Phaser.Physics.Arcade.Sprite, enemy: Phaser.Physics.Arcade.Sprite) {
        const damage = projectile.getData('damage') || 20; // Default to 20 if not set
        (enemy as Enemy).takeDamage(damage);
        projectile.destroy();
    }

    getGameState() {
        return this.gameState;
    }

    // Getter for base
    public getBase(): Base {
        return this.base;
    }

    // Getter for user
    public getUser(): User {
        return this.user;
    }

    // Getter for currentRound
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

    // Add this public method to remove towers
    public removeTower(tower: Tower) {
        this.towers?.remove(tower, true, true);
    }

    // Add a public method to force enemy update
    public forceEnemyUpdate() {
        this.updateEnemies();
    }
}