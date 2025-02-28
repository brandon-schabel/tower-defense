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

    constructor(
        scene: GameScene,
        entityManager: EntityManager,
        eventBus: EventBus
    ) {
        this.scene = scene;
        this.entityManager = entityManager;
        this.eventBus = eventBus;
        
        this.setupCollisions();
    }

    public setupCollisions(): void {
        // Get entity groups through the entity manager
        const enemies = this.entityManager.getEnemiesGroup();
        const projectiles = this.entityManager.getProjectiles();
        const base = this.entityManager.getBase();
        const user = this.entityManager.getUser();

        if (!enemies || !projectiles) return;

        // Projectile vs Enemy collision
        this.scene.physics.add.collider(
            projectiles,
            enemies,
            (projectile, enemy) => this.onProjectileHitEnemy(
                projectile as Phaser.Physics.Arcade.Sprite,
                enemy as Phaser.Physics.Arcade.Sprite
            ),
            undefined,
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
            (enemyObj, baseObj) => {
                return enemyObj instanceof Phaser.Physics.Arcade.Sprite &&
                    baseObj instanceof Phaser.Physics.Arcade.Sprite &&
                    enemyObj.active && baseObj.active;
            },
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
            (enemyObj, playerObj) => {
                return enemyObj instanceof Phaser.Physics.Arcade.Sprite &&
                    playerObj instanceof Phaser.Physics.Arcade.Sprite &&
                    enemyObj.active && playerObj.active && !enemyObj.getData('hasDealtDamage');
            },
            this
        );
    }

    private onProjectileHitEnemy(projectile: Phaser.Physics.Arcade.Sprite, enemy: Phaser.Physics.Arcade.Sprite): void {
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
        
        // Emit event for projectile hit
        this.eventBus.emit('projectile-hit', {
            target: enemy,
            damage: damage,
            projectileType: projectile.getData('type')
        });
        
        projectile.destroy();
    }

    public shootProjectile(
        source: Phaser.Physics.Arcade.Sprite,
        targetX: number,
        targetY: number,
        damage: number,
        projectileType: string = 'normal'
    ): void {
        const projectile = this.entityManager.createProjectile(source.x, source.y, 'projectile');
        projectile.setData('damage', damage);
        projectile.setData('source', source);
        projectile.setData('type', projectileType);

        let scale = 0.5;
        switch (projectileType) {
            case 'player': projectile.setTint(0x00ff00); break;
            case 'player-rapid': projectile.setTint(0x00ffff); scale = 0.6; break;
            case 'player-power': projectile.setTint(0xff0000); scale = 1.5; break;
            case 'sniper': projectile.setTint(0x0000ff); scale = 0.7; break;
            case 'area': projectile.setTint(0xff00ff); scale = 1.2; break;
            case 'fire': projectile.setTint(0xff6600); break;
            case 'ice': projectile.setTint(0x66ffff); break;
            case 'critical': projectile.setTint(0xffff00); break;
        }

        if (scale !== 1.0) {
            projectile.setScale(scale);
            const baseRadius = projectile.getData('baseRadius');
            const newRadius = Math.round(baseRadius * scale);
            if (projectile.body) projectile.body.setCircle(newRadius);
        }

        const angle = Phaser.Math.Angle.Between(source.x, source.y, targetX, targetY);
        projectile.setRotation(angle);

        const speed = 400;
        if (projectile.body) this.scene.physics.velocityFromRotation(angle, speed, projectile.body.velocity);

        this.scene.time.delayedCall(3000, () => {
            if (projectile.active) projectile.destroy();
        });
        
        // Emit event for projectile fired
        this.eventBus.emit('projectile-fired', {
            source: source,
            projectileType: projectileType,
            damage: damage
        });
    }
}