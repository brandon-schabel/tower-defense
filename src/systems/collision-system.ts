import Phaser from "phaser";
import { GameScene } from "../scenes/game-scene";
import { Enemy } from "../entities/enemy/enemy";
import { Base } from "../entities/base/base";
import { Player } from "../entities/player/player";
import { Tower } from "../entities/tower/tower";
import { EntityManager } from "../managers/entity-manager";
import { EventBus } from "../core/event-bus";

/**
 * A simplified CollisionSystem that uses Phaser's built-in collision detection.
 * This version reduces complexity and potential points of failure.
 */
export class CollisionSystem {
    private scene: GameScene;
    private entityManager: EntityManager;
    private eventBus: EventBus;
    private debugMode: boolean = false;

    // Projectile pool
    private projectilePool: Phaser.Physics.Arcade.Group;

    // Main colliders
    private projectileEnemyCollider: Phaser.Physics.Arcade.Collider | null = null;
    private enemyBaseCollider: Phaser.Physics.Arcade.Collider | null = null;
    private enemyPlayerCollider: Phaser.Physics.Arcade.Collider | null = null;
    private enemyTowerCollider: Phaser.Physics.Arcade.Collider | null = null;

    // Debug info
    private debugGraphics: Phaser.GameObjects.Graphics | null = null;
    private stats = {
        activeProjectiles: 0,
        projectilesCreated: 0,
        enemiesHit: 0,
        colliderRefreshes: 0
    };

    // Health check timer
    private healthCheckTimer: Phaser.Time.TimerEvent | null = null;

    constructor(
        scene: GameScene,
        entityManager: EntityManager,
        eventBus: EventBus
    ) {
        this.scene = scene;
        this.entityManager = entityManager;
        this.eventBus = eventBus;

        // Create projectile pool - fix linter error for 'defaults' property
        this.projectilePool = this.scene.physics.add.group({
            classType: Phaser.Physics.Arcade.Sprite,
            maxSize: 100,
            runChildUpdate: false,
            collideWorldBounds: false,
            allowGravity: false
        });

        // Set defaults for projectiles
        this.projectilePool.getChildren().forEach(child => {
            const projectile = child as Phaser.Physics.Arcade.Sprite;
            projectile.setActive(false);
            projectile.setVisible(false);
        });

        // Initialize the system
        this.setupColliders();

        // Setup debug graphics
        this.debugGraphics = this.scene.add.graphics();

        // Register for events
        this.setupEventListeners();

        // Set up regular health check timer (every 3 seconds)
        this.healthCheckTimer = this.scene.time.addEvent({
            delay: 3000,
            callback: this.checkSystemHealth,
            callbackScope: this,
            loop: true
        });

        console.log("CollisionSystem: Initialized");
    }

    /**
     * Perform a comprehensive health check on the collision system
     */
    private checkSystemHealth(): void {
        // Check for issues with colliders
        this.checkColliders();

        // Log system health
        if (this.debugMode) {
            const enemies = this.entityManager.getEnemiesGroup();
            const enemyCount = enemies?.countActive() || 0;
            const projectileCount = this.projectilePool?.countActive() || 0;

            console.log(`CollisionSystem Health: ${enemyCount} enemies, ${projectileCount} projectiles, ${this.stats.colliderRefreshes} refreshes`);

            // Verify projectile physics bodies
            let disabledProjectileBodies = 0;
            this.projectilePool.getChildren().forEach(child => {
                const projectile = child as Phaser.Physics.Arcade.Sprite;
                if (projectile.active && projectile.body && !projectile.body.enable) {
                    disabledProjectileBodies++;
                }
            });

            if (disabledProjectileBodies > 0) {
                console.warn(`Found ${disabledProjectileBodies} active projectiles with disabled bodies, fixing...`);
                this.projectilePool.getChildren().forEach(child => {
                    const projectile = child as Phaser.Physics.Arcade.Sprite;
                    if (projectile.active && projectile.body && !projectile.body.enable) {
                        projectile.body.enable = true;
                    }
                });
            }

            // Test collision world - fix linter error for Enemy type detection
            if (enemyCount > 0 && projectileCount > 0) {
                // Find an active enemy and projectile
                let testEnemy: Enemy | null = null;

                // Get first active enemy
                const enemies = this.entityManager.getEnemies();
                for (const enemy of enemies) {
                    if (enemy && enemy.active) {
                        testEnemy = enemy;
                        break;
                    }
                }

                // Get first active projectile
                let testProjectile: Phaser.Physics.Arcade.Sprite | null = null;
                this.projectilePool.getChildren().forEach(child => {
                    const projectile = child as Phaser.Physics.Arcade.Sprite;
                    if (projectile.active && !testProjectile) {
                        testProjectile = projectile;
                    }
                });

                // If we have both test objects, verify their physics state
                if (testEnemy && testProjectile) {
                    console.log(`Test physics objects: Enemy ${testEnemy.id} (active: ${testEnemy.active}, body: ${!!testEnemy.body}, bodyEnabled: ${testEnemy.body?.enable})`);
                    console.log(`Test physics objects: Projectile ${testProjectile.getData('id')} (active: ${testProjectile.active}, body: ${!!testProjectile.body}, bodyEnabled: ${testProjectile.body?.enable})`);
                }
            }
        }
    }

    /**
     * Set up all colliders between game entities
     */
    private setupColliders(): void {
        console.log("CollisionSystem: Setting up colliders");

        // Clear any existing colliders
        this.destroyColliders();

        // Get entity groups from the entity manager
        const enemies = this.entityManager.getEnemiesGroup();
        const base = this.entityManager.getBase();
        const player = this.entityManager.getUser();
        const towers = this.entityManager.getTowers();

        // Set up projectile vs enemy collider - most important one
        if (enemies && this.projectilePool) {
            this.projectileEnemyCollider = this.scene.physics.add.overlap(
                this.projectilePool,
                enemies,
                this.handleProjectileEnemyCollision.bind(this)
            );

            if (!this.projectileEnemyCollider) {
                console.error("CollisionSystem: Failed to create projectile-enemy collider!");
            } else {
                console.log("CollisionSystem: Projectile-Enemy collider set up");
            }
        }

        // Set up enemy vs base collider
        if (enemies && base) {
            this.enemyBaseCollider = this.scene.physics.add.overlap(
                enemies,
                base,
                this.handleEnemyBaseCollision.bind(this)
            );
            console.log("CollisionSystem: Enemy-Base collider set up");
        }

        // Set up enemy vs player collider
        if (enemies && player) {
            this.enemyPlayerCollider = this.scene.physics.add.overlap(
                enemies,
                player,
                this.handleEnemyPlayerCollision.bind(this)
            );
            console.log("CollisionSystem: Enemy-Player collider set up");
        }

        // Set up enemy vs tower collider
        if (enemies && towers) {
            this.enemyTowerCollider = this.scene.physics.add.overlap(
                enemies,
                towers,
                this.handleEnemyTowerCollision.bind(this)
            );
            console.log("CollisionSystem: Enemy-Tower collider set up");
        }

        // Run a verification check
        this.scene.time.delayedCall(100, () => {
            if (enemies && this.projectilePool) {
                const enemyCount = enemies.countActive();
                console.log(`CollisionSystem: Verification - ${enemyCount} active enemies, projectile-enemy collider exists: ${!!this.projectileEnemyCollider}`);
            }
        });

        this.stats.colliderRefreshes++;
        console.log(`CollisionSystem: All colliders set up (refresh #${this.stats.colliderRefreshes})`);
    }

    /**
     * Set up event listeners
     */
    private setupEventListeners(): void {
        // Listen for refresh request
        this.eventBus.on('refresh-collisions', this.refreshColliders);

        // Toggle debug mode
        this.eventBus.on('toggle-debug-mode', this.setDebugMode);

        // Listen for round start to ensure colliders are fresh
        this.eventBus.on('round-started', this.refreshColliders);

        // Listen for enemy spawned to check colliders
        this.eventBus.on('enemy-spawned', this.checkColliders);

        // Listen for physics world step to detect and repair issues
        this.scene.events.on('postupdate', this.onPostUpdate, this);

        // Listen for scene shutdown to clean up
        this.scene.events.once('shutdown', this.destroy, this);
    }

    /**
     * Handle post-update to check for problematic physics objects
     */
    private onPostUpdate(): void {
        // Only check occasionally to avoid performance impact
        if (Math.random() < 0.05) { // ~5% chance each frame ≈ every 1-2 seconds
            // Check for active projectiles that might have disabled bodies
            this.projectilePool.getChildren().forEach(child => {
                const projectile = child as Phaser.Physics.Arcade.Sprite;
                if (projectile.active && projectile.body && !projectile.body.enable) {
                    // Repair the projectile body - it should be enabled if active
                    projectile.body.enable = true;
                }
            });
        }
    }

    /**
     * Handle collisions between projectiles and enemies
     */
    private handleProjectileEnemyCollision(
        projectileObj: any,
        enemyObj: any
    ): void {
        // Early exit if either object isn't active
        if (!projectileObj.active || !enemyObj.active) {
            return;
        }

        // Get the proper projectile and enemy objects
        const projectile = (projectileObj instanceof Phaser.Physics.Arcade.Sprite) ?
            projectileObj : projectileObj.gameObject;

        const enemy = (enemyObj instanceof Enemy) ?
            enemyObj : enemyObj.gameObject;

        // Check if both objects are valid and active
        if (!projectile || !enemy || !projectile.active || !enemy.active || enemy.getData('markedForDestruction')) {
            return;
        }

        // Get projectile data
        const damage = projectile.getData('damage') || 20;
        const projectileType = projectile.getData('type') || 'normal';
        const sourceEntity = projectile.getData('source');
        const projectileId = projectile.getData('id') || 'unknown';

        // Debug info
        if (this.debugMode) {
            console.log(`Collision: Projectile ${projectileId} hit enemy ${enemy.id}`);
        }

        // Apply damage to the enemy
        enemy.takeDamage(damage);

        // Apply special effects based on projectile type
        this.applyProjectileEffects(enemy, projectile);

        // Update stats
        this.stats.enemiesHit++;

        // Track kill statistics for towers
        if (sourceEntity instanceof Tower && enemy.getHealth() <= 0) {
            sourceEntity.registerKill(enemy, damage);
        }

        // Emit event for projectile hit
        this.eventBus.emit('projectile-hit', {
            target: enemy,
            damage: damage,
            projectileType: projectileType,
            projectileId: projectileId
        });

        // Handle piercing projectiles
        const shouldPierce = projectileType === 'player-power' || projectileType === 'area';

        if (shouldPierce) {
            const hitCount = projectile.getData('hitCount') || 0;
            const maxHits = projectileType === 'player-power' ? 3 : projectileType === 'area' ? 5 : 1;

            // Increment hit count
            projectile.setData('hitCount', hitCount + 1);

            // Reduce projectile damage for balance
            projectile.setData('damage', Math.floor(damage * 0.8));

            // If max hits reached, recycle the projectile
            if (hitCount + 1 >= maxHits) {
                this.recycleProjectile(projectile);
            }
        } else {
            // Non-piercing projectiles are recycled after first hit
            this.recycleProjectile(projectile);
        }

        // Create a visual effect
        this.createDamageEffect(enemy.x, enemy.y);
    }

    /**
     * Handle collisions between enemies and the base
     */
    private handleEnemyBaseCollision(
        enemyObj: any,
        baseObj: any
    ): void {
        const enemy = (enemyObj instanceof Enemy) ? enemyObj : enemyObj.gameObject;
        const base = (baseObj instanceof Base) ? baseObj : baseObj.gameObject;

        if (!enemy || !base || !enemy.active || !base.active) {
            return;
        }

        // Use enemy data to track last damage time to prevent continuous damage
        const lastDamageTime = enemy.getData('lastDamageTime') || 0;
        const currentTime = this.scene.time.now;

        // Apply damage on a specific interval
        if (currentTime - lastDamageTime >= 1000) {
            base.takeDamage(2); // Apply damage to base
            enemy.setData('lastDamageTime', currentTime); // Update last damage time

            // Visual feedback for damage
            this.createDamageEffect(base.x, base.y);
        }
    }

    /**
     * Handle collisions between enemies and the player
     */
    private handleEnemyPlayerCollision(
        enemyObj: any,
        playerObj: any
    ): void {
        const enemy = (enemyObj instanceof Enemy) ? enemyObj : enemyObj.gameObject;
        const player = (playerObj instanceof Player) ? playerObj : playerObj.gameObject;

        if (!enemy || !player || !enemy.active || !player.active) {
            return;
        }

        if (!enemy.getData('hasDealtDamage')) {
            // Apply damage to player
            player.takeDamage(5);

            // Add knockback effect
            const angle = Phaser.Math.Angle.Between(
                enemy.x, enemy.y,
                player.x, player.y
            );
            const knockbackForce = 200;
            player.setVelocity(
                Math.cos(angle) * knockbackForce,
                Math.sin(angle) * knockbackForce
            );

            // Mark enemy as having dealt damage
            enemy.setData('hasDealtDamage', true);

            // Visual feedback
            this.createDamageEffect(player.x, player.y);

            // Destroy or recycle the enemy
            this.entityManager.removeEnemy(enemy);
        }
    }

    /**
     * Handle collisions between enemies and towers
     */
    private handleEnemyTowerCollision(
        enemyObj: any,
        towerObj: any
    ): void {
        const enemy = (enemyObj instanceof Enemy) ? enemyObj : enemyObj.gameObject;
        const tower = (towerObj instanceof Tower) ? towerObj : towerObj.gameObject;

        if (!enemy || !tower || !enemy.active || !tower.active) {
            return;
        }

        // Use a timestamp to limit damage rate
        const lastDamageTime = enemy.getData('lastTowerDamageTime') || 0;
        const currentTime = this.scene.time.now;

        if (currentTime - lastDamageTime >= 1000) {
            tower.takeDamage(2);
            enemy.setData('lastTowerDamageTime', currentTime);

            // Visual feedback
            this.createDamageEffect(tower.x, tower.y);
        }
    }

    /**
     * Apply special effects from projectiles to enemies
     */
    private applyProjectileEffects(enemy: Enemy, projectile: Phaser.Physics.Arcade.Sprite): void {
        const specialEffect = projectile.getData('specialEffect');

        if (specialEffect) {
            if (specialEffect.type === 'fire') {
                enemy.applyBurnEffect?.(specialEffect.params.burnDamage);
            } else if (specialEffect.type === 'ice') {
                enemy.applySlowEffect?.(specialEffect.params.slowFactor, specialEffect.params.duration);
            }
        }
    }

    /**
     * Create a visual effect for damage
     */
    private createDamageEffect(x: number, y: number): void {
        // Create a simple particle effect for damage
        const particles = this.scene.add.particles(x, y, 'projectile', {
            speed: 100,
            scale: { start: 0.4, end: 0 },
            blendMode: 'ADD',
            lifespan: 300,
            gravityY: 0,
            quantity: 5
        });

        // Auto-destroy after effect completes
        this.scene.time.delayedCall(300, () => {
            particles.destroy();
        });
    }

    /**
     * Shoot a projectile
     */
    public shootProjectile(
        source: Phaser.Physics.Arcade.Sprite,
        targetX: number,
        targetY: number,
        damage: number,
        projectileType: string = 'normal'
    ): Phaser.Physics.Arcade.Sprite | null {
        // Check if enemies exist - no point in shooting if there are no enemies
        const enemies = this.entityManager.getEnemiesGroup();
        if (!enemies || enemies.countActive() === 0) {
            // No enemies to hit, don't waste projectiles
            if (this.debugMode) {
                console.log("No active enemies, skipping projectile creation");
            }
            return null;
        }

        // Ensure project-enemy collider exists
        if (!this.projectileEnemyCollider) {
            console.log("No projectile-enemy collider exists, refreshing colliders before shooting");
            this.refreshColliders();
        }

        // Get a projectile
        const projectile = this.projectilePool.get(source.x, source.y, 'projectile');
        if (!projectile) {
            console.warn("Could not get projectile from pool!");
            return null;
        }

        // Reset the projectile completely to avoid any lingering effects
        projectile.setActive(true);
        projectile.setVisible(true);
        projectile.setData('hitCount', 0);
        projectile.setData('creationTime', this.scene.time.now);
        projectile.setData('id', this.stats.projectilesCreated++);

        // Set up its data
        projectile.setData('damage', damage);
        projectile.setData('source', source);
        projectile.setData('type', projectileType);

        // Configure appearance based on type
        this.configureProjectile(projectile, projectileType);

        // Set angle and velocity
        const angle = Phaser.Math.Angle.Between(source.x, source.y, targetX, targetY);
        const speed = this.getProjectileSpeed(projectileType);

        // Make sure physics body is enabled
        if (!projectile.body) {
            this.scene.physics.world.enable(projectile);
        }

        if (projectile.body) {
            // IMPORTANT: Ensure the body is enabled
            projectile.body.enable = true;

            // Set velocity
            this.scene.physics.velocityFromRotation(angle, speed, projectile.body.velocity);

            // Set circular body for better collision
            const radius = Math.max(12, projectile.width / 2);
            projectile.body.setCircle(radius);

            // Make sure the body is set for collisions
            projectile.body.checkCollision.none = false;
        }

        // Set rotation to match movement direction
        projectile.rotation = angle;

        // Automatically destroy after 5 seconds to prevent memory leaks
        this.scene.time.delayedCall(5000, () => {
            if (projectile.active) {
                this.recycleProjectile(projectile);
            }
        });

        // Update stats
        this.stats.activeProjectiles = this.projectilePool.countActive();

        if (this.debugMode) {
            console.log(`Created projectile ${projectile.getData('id')} of type ${projectileType}`);
        }

        return projectile;
    }

    /**
     * Configure a projectile's appearance based on type
     */
    private configureProjectile(projectile: Phaser.Physics.Arcade.Sprite, projectileType: string): void {
        let scale = 0.5;

        // Configure appearance based on type
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
                scale = 0.8;
                projectile.setData('specialEffect', {
                    type: 'fire',
                    params: { burnDamage: 5 }
                });
                break;
            case 'ice':
                projectile.setTint(0x66ccff);
                scale = 0.8;
                projectile.setData('specialEffect', {
                    type: 'ice',
                    params: { slowFactor: 0.5, duration: 3000 }
                });
                break;
        }

        // Set scale
        projectile.setScale(scale);
    }

    /**
     * Get projectile speed based on type
     */
    private getProjectileSpeed(projectileType: string): number {
        switch (projectileType) {
            case 'player-rapid': return 600;
            case 'player-power': return 350;
            case 'sniper': return 800;
            case 'area': return 300;
            default: return 400;
        }
    }

    /**
     * Recycle a projectile back to the pool
     */
    private recycleProjectile(projectile: Phaser.Physics.Arcade.Sprite): void {
        if (!projectile || !projectile.active) return;

        // Reset all projectile data
        projectile.setData('hitCount', 0);

        // Disable physics and reset
        if (projectile.body) {
            projectile.body.enable = false;
            projectile.setVelocity(0, 0);
        }

        // Return to pool
        projectile.setActive(false);
        projectile.setVisible(false);

        // Update stats
        this.stats.activeProjectiles = this.projectilePool.countActive();
    }

    /**
     * Check if colliders need to be refreshed
     */
    private checkColliders(): void {
        // Get entity counts
        const enemies = this.entityManager.getEnemiesGroup();
        const enemyCount = enemies?.countActive() || 0;

        // If we have enemies but no projectile-enemy collider, refresh
        if (enemyCount > 0 && !this.projectileEnemyCollider) {
            console.log("CollisionSystem: Missing projectile-enemy collider with active enemies, refreshing");
            this.refreshColliders();
            return;
        }

        // Check if any collider is invalid
        if (
            (this.projectileEnemyCollider && !this.projectileEnemyCollider.active) ||
            (this.enemyBaseCollider && !this.enemyBaseCollider.active) ||
            (this.enemyPlayerCollider && !this.enemyPlayerCollider.active) ||
            (this.enemyTowerCollider && !this.enemyTowerCollider.active)
        ) {
            console.log("CollisionSystem: Detected invalid collider, refreshing");
            this.refreshColliders();
        }
    }

    /**
     * Refresh all colliders
     */
    public refreshColliders(): void {
        console.log("CollisionSystem: Refreshing colliders");

        // Force physics system step to ensure everything is at the latest state
        this.scene.physics.world.step(16);

        // Clean up damaged projectiles
        this.cleanupProjectiles();

        // Destroy existing colliders
        this.destroyColliders();

        // Setup new colliders
        this.setupColliders();
    }

    /**
     * Clean up projectiles that might be causing issues
     */
    private cleanupProjectiles(): void {
        let cleanedProjectiles = 0;

        this.projectilePool.getChildren().forEach(child => {
            const projectile = child as Phaser.Physics.Arcade.Sprite;

            // Check for any active projectiles with invalid state
            if (projectile.active) {
                // Age check - recycle very old projectiles
                const creationTime = projectile.getData('creationTime') || 0;
                const age = this.scene.time.now - creationTime;

                // Check for stuck or damaged projectiles
                const isStuck = (projectile.body?.velocity.length() || 0) < 10;
                const hasDamagedBody = projectile.body && !projectile.body.enable;

                if (age > 8000 || isStuck || hasDamagedBody) {
                    this.recycleProjectile(projectile);
                    cleanedProjectiles++;
                }
            }
        });

        if (cleanedProjectiles > 0 && this.debugMode) {
            console.log(`Cleaned up ${cleanedProjectiles} problematic projectiles`);
        }
    }

    /**
     * Destroy all current colliders
     */
    private destroyColliders(): void {
        if (this.projectileEnemyCollider) {
            this.projectileEnemyCollider.destroy();
            this.projectileEnemyCollider = null;
        }

        if (this.enemyBaseCollider) {
            this.enemyBaseCollider.destroy();
            this.enemyBaseCollider = null;
        }

        if (this.enemyPlayerCollider) {
            this.enemyPlayerCollider.destroy();
            this.enemyPlayerCollider = null;
        }

        if (this.enemyTowerCollider) {
            this.enemyTowerCollider.destroy();
            this.enemyTowerCollider = null;
        }
    }

    /**
     * Update the collision system
     */
    public update(): void {
        // Only do expensive checks if we have active entities
        const projectileCount = this.projectilePool.countActive();

        if (projectileCount > 0) {
            // Clean up old projectiles
            this.projectilePool.getChildren().forEach((child) => {
                const projectile = child as Phaser.Physics.Arcade.Sprite;

                if (projectile.active) {
                    const creationTime = projectile.getData('creationTime') || 0;
                    const currentTime = this.scene.time.now;

                    // Destroy projectiles that have been active too long (10 seconds)
                    if (currentTime - creationTime > 10000) {
                        this.recycleProjectile(projectile);
                    }

                    // Check if projectile is out of bounds
                    const bounds = this.scene.physics.world.bounds;
                    if (
                        projectile.x < bounds.x - 100 ||
                        projectile.x > bounds.x + bounds.width + 100 ||
                        projectile.y < bounds.y - 100 ||
                        projectile.y > bounds.y + bounds.height + 100
                    ) {
                        this.recycleProjectile(projectile);
                    }

                    // Ensure physics body is enabled for active projectiles
                    if (projectile.body && !projectile.body.enable) {
                        projectile.body.enable = true;
                    }
                }
            });
        }

        // Update debug info
        if (this.debugMode) {
            this.updateDebugInfo();
        }

        // Less frequent check for collider health (2% chance per frame)
        if (Math.random() < 0.02) {
            this.checkColliders();
        }

        // Periodically reset physics world if we have active objects but colliders are gone
        // This is a last resort for extreme cases
        const enemies = this.entityManager.getEnemiesGroup();
        const enemyCount = enemies?.countActive() || 0;

        if (enemyCount > 0 && projectileCount > 0 && !this.projectileEnemyCollider) {
            console.warn("Critical failure: Active objects but no colliders. Performing emergency reset.");
            this.scene.time.delayedCall(100, () => this.refreshColliders());
        }
    }

    /**
     * Update debug visualization
     */
    private updateDebugInfo(): void {
        if (!this.debugGraphics) return;

        this.debugGraphics.clear();

        // Draw debug circles for projectiles
        this.projectilePool.getChildren().forEach((child) => {
            const projectile = child as Phaser.Physics.Arcade.Sprite;

            if (projectile.active) {
                this.debugGraphics?.lineStyle(1, 0xffff00, 0.8);
                this.debugGraphics?.strokeCircle(projectile.x, projectile.y, projectile.width / 2);

                // Draw velocity vector
                if (projectile.body) {
                    const vx = projectile.body.velocity.x;
                    const vy = projectile.body.velocity.y;
                    const length = Math.sqrt(vx * vx + vy * vy);

                    if (length > 0) {
                        const scale = 50 / length; // Scale to make vectors visible
                        this.debugGraphics?.lineStyle(1, 0x00ff00, 0.6);
                        this.debugGraphics?.lineBetween(
                            projectile.x,
                            projectile.y,
                            projectile.x + vx * scale,
                            projectile.y + vy * scale
                        );
                    }
                }
            }
        });

        // Draw debug info for enemies
        this.entityManager.getEnemies().forEach((enemy) => {
            if (enemy.active) {
                this.debugGraphics?.lineStyle(1, 0xff0000, 0.5);
                this.debugGraphics?.strokeRect(
                    enemy.x - enemy.width / 2,
                    enemy.y - enemy.height / 2,
                    enemy.width,
                    enemy.height
                );
            }
        });

        // Draw tower ranges if in debug mode
        const towers = this.entityManager.getTowers();
        if (towers) {
            towers.getChildren().forEach((obj) => {
                const tower = obj as Tower;
                if (tower.active) {
                    this.debugGraphics?.lineStyle(1, 0x0000ff, 0.3);
                    this.debugGraphics?.strokeCircle(
                        tower.x,
                        tower.y,
                        tower.getCurrentRange()
                    );
                }
            });
        }

        // Display stats
        const statsText = [
            `Active Projectiles: ${this.stats.activeProjectiles}`,
            `Projectiles Created: ${this.stats.projectilesCreated}`,
            `Enemies Hit: ${this.stats.enemiesHit}`,
            `Collider Refreshes: ${this.stats.colliderRefreshes}`
        ].join('\n');

        if (!this.scene.data.has('collisionStatsText')) {
            const text = this.scene.add.text(10, 120, statsText, {
                fontSize: '14px',
                color: '#ffffff',
                backgroundColor: '#000000'
            });
            text.setScrollFactor(0);
            text.setDepth(1000);
            this.scene.data.set('collisionStatsText', text);
        } else {
            const text = this.scene.data.get('collisionStatsText') as Phaser.GameObjects.Text;
            text.setText(statsText);
        }
    }

    /**
     * Enable or disable debug mode
     */
    public setDebugMode(enabled: boolean): void {
        this.debugMode = enabled;

        if (!enabled && this.debugGraphics) {
            this.debugGraphics.clear();

            if (this.scene.data.has('collisionStatsText')) {
                const text = this.scene.data.get('collisionStatsText') as Phaser.GameObjects.Text;
                text.setVisible(false);
            }
        } else if (enabled && this.scene.data.has('collisionStatsText')) {
            const text = this.scene.data.get('collisionStatsText') as Phaser.GameObjects.Text;
            text.setVisible(true);
        }
    }

    /**
     * Clean up resources
     */
    public destroy(): void {
        // Stop timer
        if (this.healthCheckTimer) {
            this.healthCheckTimer.remove();
            this.healthCheckTimer = null;
        }

        // Destroy colliders
        this.destroyColliders();

        // Clear event listeners
        this.eventBus.off('refresh-collisions', this.refreshColliders);
        this.eventBus.off('toggle-debug-mode', this.setDebugMode);
        this.eventBus.off('round-started', this.refreshColliders);
        this.eventBus.off('enemy-spawned', this.checkColliders);

        // Remove scene events
        this.scene.events.off('postupdate', this.onPostUpdate, this);
        this.scene.events.off('shutdown', this.destroy, this);

        // Destroy graphics
        if (this.debugGraphics) {
            this.debugGraphics.destroy();
        }

        // Remove stats text
        if (this.scene.data.has('collisionStatsText')) {
            const text = this.scene.data.get('collisionStatsText') as Phaser.GameObjects.Text;
            text.destroy();
            this.scene.data.remove('collisionStatsText');
        }

        // Destroy projectile pool
        if (this.projectilePool) {
            this.projectilePool.clear(true, true);
        }
    }
}