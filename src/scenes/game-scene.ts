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
    private enemies: Phaser.Physics.Arcade.Group | null = null;
    private towers: Phaser.Physics.Arcade.Group | null = null;
    public projectiles: Phaser.Physics.Arcade.Group | null = null;
    private currentRound: number = 0;

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

        // Enemies hit towers - Corrected to pass Tower type
        this.physics.add.overlap(
            this.enemies,
            this.towers,
            (enemy, tower) => { // Use simpler parameter names
                this.onEnemyHitTower(
                    enemy as Phaser.Physics.Arcade.Sprite,
                    tower as Tower // Cast to Tower here
                );
            },
            undefined,
            this
        );

        // Enemies hit base
        this.physics.add.overlap(
            this.enemies,
            this.base,
            (enemy) => { // Use a simpler parameter name
                this.onEnemyHitBase(enemy as Phaser.Physics.Arcade.Sprite);
            },
            undefined,
            this
        );
    }

    update(time: number) {
        this.user.update();
        this.updateTowers();
        this.updateEnemies();
        this.updateProjectiles();
        
        if (this.enemies && this.enemies.countActive() === 0 && this.currentRound > 0) {
            this.onRoundComplete();
        }
    }

    private updateTowers() {
        this.towers?.getChildren().forEach((tower: Phaser.GameObjects.GameObject) => {
            const towerSprite = tower as Tower;
            towerSprite.update();
        });
    }

    private updateEnemies() {
        if (!this.enemies) return;

        this.enemies.getChildren().forEach((enemy: Phaser.GameObjects.GameObject) => {
            const enemySprite = enemy as Phaser.Physics.Arcade.Sprite;
            let target = enemySprite.getData("target") as Phaser.Physics.Arcade.Sprite;

            if (!target || !target.active) {
                const userDistance = Phaser.Math.Distance.Between(enemySprite.x, enemySprite.y, this.user.x, this.user.y);
                if (userDistance < 100) {
                    target = this.user;
                } else {
                    const nearestTower = this.findNearestTower(enemySprite.x, enemySprite.y, Infinity);
                    if (nearestTower) {
                        target = nearestTower;
                    } else {
                        target = this.base;
                    }
                }
                enemySprite.setData("target", target);
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
                    if (target instanceof User) {
                        target.takeDamage(1);
                    } else if (target instanceof Tower) {
                        target.takeDamage(10);
                    } else if (target instanceof Base) {
                        target.takeDamage(10);
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

            if (target) {
                const dx = target.x - projectileSprite.x;
                const dy = target.y - projectileSprite.y;
                const distance = Math.hypot(dx, dy);

                if (distance < 5) {
                    projectileSprite.destroy();
                }
            } else {
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
        this.currentRound++;
        this.spawnEnemies();
    }

    private spawnEnemies() {
        const enemyCount = Math.min(5 + this.currentRound * 2, 20);
        for (let i = 0; i < enemyCount; i++) {
            setTimeout(() => {
                if (!this.enemies) return;
                const enemy = new Enemy(this, 0, Phaser.Math.Between(100, 500), 50 + this.currentRound * 10, 2);
                this.enemies.add(enemy);
            }, i * 1000);
        }
    }

    private onRoundComplete() {
        this.gameState.earnResources(50 + this.currentRound * 10);
        this.hud.updateResources();
        this.hud.showNextRoundButton(() => {
            this.user.heal(20);
            this.startRound();
        });
    }

    enterBuildMode(towerType: string) {
        if (this.isBuildModeActive) return;

        const towerData = TOWER_TYPES[towerType];
        if (!towerData || !this.gameState.canAfford(towerData.price)) {
            console.log('Not enough resources to select this tower');
            this.exitBuildMode(); // Ensure build mode exits if already active, or cannot afford
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
            this.exitBuildMode();
            return;
        }

        const tower = new Tower(this, x, y, this.selectedTowerType);
        this.towers.add(tower, true); // Enable physics explicitly

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

    private findNearestEnemy(x: number, y: number, range: number): Phaser.Physics.Arcade.Sprite | null {
        if (!this.enemies) return null;

        let nearest: Phaser.Physics.Arcade.Sprite | null = null;
        let nearestDistance = range;

        this.enemies.getChildren().forEach((enemy: Phaser.GameObjects.GameObject) => {
            const enemySprite = enemy as Phaser.Physics.Arcade.Sprite;
            const distance = Phaser.Math.Distance.Between(x, y, enemySprite.x, enemySprite.y);
            if (distance < nearestDistance) {
                nearest = enemySprite;
                nearestDistance = distance;
            }
        });

        return nearest;
    }

    private findNearestTower(x: number, y: number, range: number): Phaser.Physics.Arcade.Sprite | null {
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
        const damage = projectile.getData('damage');
        (enemy as Enemy).takeDamage(damage); // Cast to Enemy for method access
        projectile.destroy();
    }

    private onEnemyHitTower(enemy: Phaser.Physics.Arcade.Sprite, tower: Tower) {
        tower.takeDamage(10);
        // Optionally, handle enemy behavior, e.g., stop moving or continue attacking
    }

    private onEnemyHitBase(enemy: Phaser.Physics.Arcade.Sprite) {
        this.base.takeDamage(10);
        enemy.destroy();
    }

    getGameState() {
        return this.gameState;
    }

    getEnemies(): Phaser.Physics.Arcade.Sprite[] {
        if (!this.enemies) return [];
        return this.enemies.getChildren() as Phaser.Physics.Arcade.Sprite[];
    }

    private recalculateEnemyTargets() {
        if (!this.enemies) return;

        this.enemies.getChildren().forEach((enemy: Phaser.GameObjects.GameObject) => {
            const enemySprite = enemy as Phaser.Physics.Arcade.Sprite;
            const userDistance = Phaser.Math.Distance.Between(enemySprite.x, enemySprite.y, this.user.x, this.user.y);

            let target: Phaser.Physics.Arcade.Sprite;
            if (userDistance < 100) {
                target = this.user;
            } else {
                const nearestTower = this.findNearestTower(enemySprite.x, enemySprite.y, Infinity);
                if (nearestTower) {
                    target = nearestTower;
                } else {
                    target = this.base;
                }
            }
            enemySprite.setData("target", target);
        });
    }
}