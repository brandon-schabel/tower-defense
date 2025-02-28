import Phaser from "phaser";
import GameScene from "../scenes/game-scene";
import Enemy from "../entities/enemy/enemy";
import Base from "../entities/base/base";
import Player from "../entities/player/player";
import EntityManager from "../managers/entity-manager";
import { EventBus } from "../core/event-bus";

export default class CombatSystem {
    private scene: GameScene;
    private entityManager: EntityManager;
    private eventBus: EventBus;
    private _lastCleanupTime: number = 0;
    private _projectileEnemyCollider?: Phaser.Physics.Arcade.Collider;

    constructor(
        scene: GameScene,
        entityManager: EntityManager,
        eventBus: EventBus
    ) {
        this.scene = scene;
        this.entityManager = entityManager;
        this.eventBus = eventBus;

        this.setupCollisions();

        // Listen for refresh-collisions events
        this.eventBus.on('refresh-collisions', () => {
            this.recreateColliders();
        });
    }

    /**
     * Completely recreates all collision handlers
     * This is a more aggressive approach than refreshColliders
     */
    public recreateColliders(): void {
        console.log("CombatSystem: Completely recreating all collision handlers");
        
        // Remove existing colliders
        if (this._projectileEnemyCollider) {
            this._projectileEnemyCollider.destroy();
        }
        
        // Set up collisions from scratch
        this.setupCollisions();
        
        // Force a refresh as well
        this.refreshColliders();
    }

    public setupCollisions(): void {
        // Get entity groups through the entity manager
        const enemies = this.entityManager.getEnemiesGroup();
        const projectiles = this.entityManager.getProjectiles();

        if (!enemies || !projectiles) return;

        const base = this.entityManager.getBase();
        const user = this.entityManager.getUser();
        
        console.log("Setting up all collision handlers from scratch");
        
        // IMPORTANT: Use overlap instead of collider for more reliable detection
        // Overlap is more forgiving with fast-moving objects
        this._projectileEnemyCollider = this.scene.physics.add.overlap(
            projectiles,
            enemies,
            (projectileObj, enemyObj) => {
                // Use explicit type casting to get the proper object types
                const projectile = projectileObj as Phaser.Physics.Arcade.Sprite;
                const enemy = enemyObj as Enemy;
                
                // Use type-safe logging 
                console.log('Overlap detected between projectile and enemy');
                this.onProjectileHitEnemy(projectile, enemy);
            },
            undefined, // Remove the process callback for now
            this
        );

        // Enemy vs Base collision
        this.scene.physics.add.overlap(
            enemies,
            base,
            (enemyObj, baseObj) => {
                if (enemyObj instanceof Enemy && baseObj instanceof Base) {
                    if (enemyObj.active && baseObj.active) {
                        const lastDamageTime = enemyObj.getData('lastDamageTime') || 0;
                        const currentTime = this.scene.time.now;
                        if (currentTime - lastDamageTime >= 1000) { // Damage every 1 second
                            baseObj.takeDamage(2); // Reduced damage
                            enemyObj.setData('lastDamageTime', currentTime);
                        }
                    }
                }
            },
            undefined, // Remove process callback
            this
        );

        // Enemy vs Player collision
        this.scene.physics.add.overlap(
            enemies,
            user,
            (enemyObj, playerObj) => {
                if (enemyObj instanceof Enemy && playerObj instanceof Player) {
                    if (enemyObj.active && playerObj.active && !enemyObj.getData('hasDealtDamage')) {
                        playerObj.takeDamage(5);
                        const angle = Phaser.Math.Angle.Between(enemyObj.x, enemyObj.y, playerObj.x, playerObj.y);
                        const knockbackForce = 200;
                        playerObj.setVelocity(Math.cos(angle) * knockbackForce, Math.sin(angle) * knockbackForce);
                        enemyObj.setData('hasDealtDamage', true);
                        enemyObj.setActive(false);
                        this.scene.time.delayedCall(0, () => enemyObj.destroy());
                    }
                }
            },
            undefined, // Remove process callback
            this
        );

        // Set up a periodic check to ensure collisions are working
        this.scene.time.addEvent({
            delay: 1000, // Check more frequently (every second)
            callback: this.refreshColliders,
            callbackScope: this,
            loop: true
        });
    }

    private refreshColliders(): void {
        // Get entity groups through the entity manager
        const enemies = this.entityManager.getEnemiesGroup();
        const projectiles = this.entityManager.getProjectiles();

        if (!enemies || !projectiles) return;

        console.log(`Refreshing colliders. Active enemies: ${enemies.countActive()}, Active projectiles: ${projectiles.countActive()}`);

        // ALWAYS destroy and recreate the collider to ensure it works with all enemies
        if (this._projectileEnemyCollider) {
            this._projectileEnemyCollider.destroy();
            console.log("Destroyed existing projectile-enemy collider");
        }
            
        // Create a fresh overlap collider
        this._projectileEnemyCollider = this.scene.physics.add.overlap(
            projectiles,
            enemies,
            (projectileObj, enemyObj) => {
                // Cast to proper types here
                const projectile = projectileObj as Phaser.Physics.Arcade.Sprite;
                const enemy = enemyObj as Enemy;
                
                this.onProjectileHitEnemy(projectile, enemy);
            },
            undefined,
            this
        );
        console.log("Created new projectile-enemy overlap handler");

        // Force a complete physics check for all active objects
        // This is important to ensure all objects are properly registered
        this.scene.physics.world.collide(projectiles, enemies);

        // Ensure all active enemies and projectiles have active physics bodies
        enemies.getChildren().forEach(enemy => {
            const enemySprite = enemy as Phaser.Physics.Arcade.Sprite;
            if (enemySprite.active && (!enemySprite.body || !enemySprite.body.enable)) {
                this.scene.physics.world.enable(enemySprite);
                // Use type-safe way to get enemy ID
                const enemyId = enemySprite instanceof Enemy ? enemySprite.id : 'unknown';
                console.log(`Re-enabled physics for enemy ${enemyId}`);
            }
        });

        projectiles.getChildren().forEach(projectile => {
            const projectileSprite = projectile as Phaser.Physics.Arcade.Sprite;
            if (projectileSprite.active && (!projectileSprite.body || !projectileSprite.body.enable)) {
                this.scene.physics.world.enable(projectileSprite);
                console.log(`Re-enabled physics for projectile ${projectileSprite.getData('id')}`);
            }
        });
    }

    private onProjectileHitEnemy(projectile: Phaser.Physics.Arcade.Sprite, enemy: Phaser.Physics.Arcade.Sprite): void {
        // Skip if either object is not active
        if (!projectile.active || !enemy.active) {
            console.log(`Skipping collision - projectile active: ${projectile.active}, enemy active: ${enemy.active}`);
            return;
        }

        // Get projectile data
        const damage = projectile.getData('damage') || 20;
        const projectileType = projectile.getData('type') || 'normal';
        const projectileId = projectile.getData('id') || 'unknown';
        
        // Get enemy ID in a safe way
        const enemyId = enemy instanceof Enemy ? enemy.id : 'unknown';
        
        console.log(`Processing collision between projectile ${projectileId} and enemy ${enemyId}`);

        // Apply damage to the enemy
        if (enemy instanceof Enemy) {
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
        } else {
            console.warn('Enemy object is not an instance of Enemy class');
        }

        // Emit event for projectile hit
        this.eventBus.emit('projectile-hit', {
            target: enemy,
            damage: damage,
            projectileType: projectileType
        });

        // Check if this projectile should pierce through enemies based on its type
        const shouldPierce = projectileType === 'player-power' || projectileType === 'area';

        if (shouldPierce) {
            // Track the number of hits for piercing projectiles
            const hitCount = projectile.getData('hitCount') || 0;
            const maxHits = projectileType === 'player-power' ? 3 : projectileType === 'area' ? 5 : 1;

            // Increment hit count
            projectile.setData('hitCount', hitCount + 1);
            console.log(`Piercing projectile ${projectileId} hit count: ${hitCount + 1}/${maxHits}`);

            // Reduce projectile damage slightly with each hit (for balance)
            const newDamage = Math.floor(damage * 0.8); // 20% reduction per hit
            projectile.setData('damage', newDamage);

            // If we've reached max hits, destroy the projectile
            if (hitCount + 1 >= maxHits) {
                console.log(`Piercing projectile ${projectileId} reached max hits, destroying`);
                projectile.destroy();
            }
        } else {
            // Non-piercing projectiles are destroyed on first hit
            projectile.destroy();
        }
    }

    public shootProjectile(
        source: Phaser.Physics.Arcade.Sprite,
        targetX: number,
        targetY: number,
        damage: number,
        projectileType: string = 'normal'
    ): void {
        // Clean up any lingering physics objects
        this.cleanupInactiveObjects();

        // Limit maximum active projectiles to prevent performance issues
        const projectilesGroup = this.entityManager.getProjectiles();
        if (projectilesGroup && projectilesGroup.countActive() > 50) {
            // Find the oldest projectile and destroy it
            let oldestTime = Infinity;
            let oldestProjectile = null;

            projectilesGroup.getChildren().forEach((proj) => {
                const creationTime = (proj as Phaser.Physics.Arcade.Sprite).getData('creationTime') || 0;
                if (creationTime < oldestTime) {
                    oldestTime = creationTime;
                    oldestProjectile = proj;
                }
            });

            if (oldestProjectile) {
                (oldestProjectile as Phaser.Physics.Arcade.Sprite).destroy();
            }
        }

        const projectile = this.entityManager.createProjectile(source.x, source.y, 'projectile');
        projectile.setData('damage', damage);
        projectile.setData('source', source);
        projectile.setData('type', projectileType);
        projectile.setData('hitCount', 0);
        projectile.setData('creationTime', this.scene.time.now);

        let scale = 0.5;
        let speed = 400; // Base speed

        // Configure projectile based on type
        switch (projectileType) {
            case 'player':
                projectile.setTint(0x00ff00);
                break;
            case 'player-rapid':
                projectile.setTint(0x00ffff);
                scale = 0.6;
                speed = 600; // Faster projectile
                break;
            case 'player-power':
                projectile.setTint(0xff0000);
                scale = 1.5;
                speed = 350; // Slower but more powerful
                break;
            case 'sniper':
                projectile.setTint(0x0000ff);
                scale = 0.7;
                speed = 800; // Very fast projectile
                break;
            case 'area':
                projectile.setTint(0xff00ff);
                scale = 1.2;
                speed = 300; // Slower area projectile
                break;
            case 'fire':
                projectile.setTint(0xff6600);
                scale = 0.8;
                projectile.setData('specialEffect', {
                    type: 'fire',
                    params: {
                        burnDamage: 5
                    }
                });
                break;
            case 'ice':
                projectile.setTint(0x66ccff);
                scale = 0.8;
                projectile.setData('specialEffect', {
                    type: 'ice',
                    params: {
                        slowFactor: 0.5,
                        duration: 3000
                    }
                });
                break;
        }

        projectile.setScale(scale);

        // Calculate angle to target
        const angle = Phaser.Math.Angle.Between(
            source.x,
            source.y,
            targetX,
            targetY
        );

        // Set velocity based on angle
        if (projectile.body) {
            this.scene.physics.velocityFromRotation(angle, speed, projectile.body.velocity);
        }

        // Set rotation to match movement
        projectile.rotation = angle;

        // Enable out-of-bounds check to clean up projectiles that leave the screen
        this.enableProjectileOutOfBoundsCheck(projectile);
    }

    private enableProjectileOutOfBoundsCheck(projectile: Phaser.Physics.Arcade.Sprite): void {
        const checkBounds = () => {
            // If the projectile is still active
            if (projectile.active) {
                const boundsPadding = 50; // Extra padding beyond camera bounds
                const cameraBounds = this.scene.cameras.main.getBounds();

                // Check if projectile is outside camera bounds plus padding
                if (
                    projectile.x < cameraBounds.x - boundsPadding ||
                    projectile.x > cameraBounds.x + cameraBounds.width + boundsPadding ||
                    projectile.y < cameraBounds.y - boundsPadding ||
                    projectile.y > cameraBounds.y + cameraBounds.height + boundsPadding
                ) {
                    projectile.destroy();
                } else {
                    // Check again in 100ms if still active
                    this.scene.time.delayedCall(100, checkBounds);
                }
            }
        };

        // Start checking bounds after a short delay
        this.scene.time.delayedCall(500, checkBounds);

        // Also destroy all projectiles after a maximum lifetime
        this.scene.time.delayedCall(10000, () => {
            if (projectile.active) projectile.destroy();
        });
    }

    private cleanupInactiveObjects(): void {
        const currentTime = this.scene.time.now;
        if (currentTime - this._lastCleanupTime < 5000) return; // Only clean up every 5 seconds

        this._lastCleanupTime = currentTime;

        const projectilesGroup = this.entityManager.getProjectiles();
        if (projectilesGroup) {
            projectilesGroup.getChildren().forEach(child => {
                // If the object is not active but still exists, destroy it
                if (!child.active) {
                    child.destroy();
                }
            });
        }
    }
}