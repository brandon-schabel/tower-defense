import Phaser from 'phaser';
import GameScene from '../scenes/game-scene';
import { DIFFICULTY_SETTINGS } from '../settings';
import { EnemyType } from '../types/enemy-type';
import ServiceLocator from '../utils/service-locator';
import EntityManager from './entity-manager';
import UIManager from './ui-manager';
import GameState from '../utils/game-state';

export default class RoundManager {
    private scene: GameScene;
    private roundState: 'build' | 'combat' | 'roundEnd' | 'transitioning' = 'build';
    private enemiesRemaining: number = 0;
    private currentRound: number = 0;
    private isRoundEnding: boolean = false;
    private isRoundActive: boolean = false;
    private roundTransitionTimer: Phaser.Time.TimerEvent | null = null;
    private roundStateDebug: boolean = true; // Set to true for debugging state transitions


    constructor(scene: GameScene) {
        this.scene = scene;
        
        // Register with service locator
        ServiceLocator.getInstance().register('roundManager', this);
    }

    /**
     * Get the current round number
     */
    public getCurrentRound(): number {
        return this.currentRound;
    }

    /**
     * Get the current round state
     */
    public getRoundState(): 'build' | 'combat' | 'roundEnd' | 'transitioning' {
        return this.roundState;
    }

    /**
     * Check if a round is currently active
     */
    public isActiveRound(): boolean {
        return this.isRoundActive;
    }

    /**
     * Check if the round is in the ending state
     */
    public isInEndingState(): boolean {
        return this.isRoundEnding;
    }

    /**
     * Start the current round
     */
    public startRound(): void {
        if (this.roundState !== 'build') {
            console.warn('Cannot start round: Not in build phase');
            return;
        }

        // Set state to transitioning first to prevent any race conditions
        this.roundState = 'transitioning';
        this.isRoundActive = false;

        // Clear any existing transition timer
        if (this.roundTransitionTimer) {
            this.roundTransitionTimer.destroy();
            this.roundTransitionTimer = null;
        }

        // Show round start message
        this.showRoundMessage(`Round ${this.currentRound + 1}`, 0x00ff00);

        // Use service locator to get other managers
        const uiManager = ServiceLocator.getInstance().get<UIManager>('uiManager');
        if (uiManager) {
            uiManager.disableRoundButton();
        }
        
        const entityManager = ServiceLocator.getInstance().get<EntityManager>('entityManager');
        if (!entityManager) return;

        // Short delay before actually starting the round
        this.scene.time.delayedCall(1500, () => {
            if (this.roundState !== 'transitioning') return; // Safety check

            this.currentRound++;
            this.roundState = 'combat';
            this.isRoundActive = true;
            this.isRoundEnding = false;
            this.enemiesRemaining = 0;

            // Setup enemy spawns for this round
            this.setupEnemySpawns();

            // Log round start
            console.log(`Starting round ${this.currentRound}`);

            // Emit round start event
            this.scene.eventBus.emit('round-start', { roundNumber: this.currentRound });

            if (this.roundStateDebug) {
                console.log(`Round ${this.currentRound} started. State: ${this.roundState}`);
            }
        });
    }

    /**
     * Start the next round
     */
    public startNextRound(): void {
        if (this.roundState !== 'build') {
            console.warn('Cannot start next round: Not in build phase');
            return;
        }

        // Clear any lingering state
        this.clearRemainingEnemies();

        // Reset round-related flags
        this.isRoundEnding = false;
        this.isRoundActive = false;
        this.enemiesRemaining = 0;

        // Start the new round
        this.startRound();
    }

    /**
     * Handle the end of a round
     */
    public handleRoundEnd(): void {
        if (this.roundState !== 'combat' || this.isRoundEnding) {
            return;
        }

        // Set state to transitioning first
        this.roundState = 'transitioning';
        this.isRoundEnding = true;
        this.isRoundActive = false;

        // Clear any remaining enemies with a fade out effect
        this.clearRemainingEnemies();

        // Show round complete message
        this.showRoundMessage('Round Complete!', 0xffff00);

        // Award round completion bonus
        const roundBonus = Math.floor(50 * (1 + this.currentRound * 0.1));
        const gameState = ServiceLocator.getInstance().get<GameState>('gameState');
        if (gameState) {
            gameState.earnResources(roundBonus);
        }
        this.showResourceMessage(roundBonus);

        // Heal the player a bit
        const healAmount = 20;
        this.scene.getUser().heal(healAmount);
        this.showHealMessage(healAmount);

        // Update HUD
        const uiManager = ServiceLocator.getInstance().get<UIManager>('uiManager');
        if (uiManager) {
            uiManager.updateResources();
            uiManager.updatePlayerStats();
        }

        // Transition to build phase after a delay
        this.roundTransitionTimer = this.scene.time.delayedCall(2000, () => {
            if (this.roundState !== 'transitioning') return; // Safety check

            this.roundState = 'build';
            this.isRoundEnding = false;

            // Use service locator to get other managers
            const uiManager = ServiceLocator.getInstance().get<UIManager>('uiManager');
            if (uiManager) {
                uiManager.showNextRoundButton(() => this.startNextRound());
            }

            // Log state change
            if (this.roundStateDebug) {
                console.log(`Round ${this.currentRound} completed. New state: ${this.roundState}`);
            }

            // Emit round end event
            this.scene.eventBus.emit('round-end', {
                roundNumber: this.currentRound,
                bonus: roundBonus,
                healing: healAmount
            });
        });
    }

    /**
     * Check if the round is complete
     */
    public checkRoundCompletion(): void {
        // Only check if we're in combat phase
        if (this.roundState !== 'combat' || !this.isRoundActive) {
            return;
        }

        // Check if all enemies are defeated
        const entityManager = ServiceLocator.getInstance().get<EntityManager>('entityManager');
        if (!entityManager) return;
        const enemies = this.scene.getEnemiesGroup();
        if (this.enemiesRemaining <= 0 && enemies && enemies.countActive() === 0) {
            this.handleRoundEnd();
        }
    }

    /**
     * Clear any remaining enemies with a fade effect
     */
    private clearRemainingEnemies(): void {
        const entityManager = ServiceLocator.getInstance().get<EntityManager>('entityManager');
        if (!entityManager) return;
        const enemies = this.scene.getEnemiesGroup();
        if (!enemies) return;

        enemies.getChildren().forEach((gameObject: Phaser.GameObjects.GameObject) => {
            if (gameObject instanceof Phaser.Physics.Arcade.Sprite) {
                // First disable physics to prevent any collision events
                if (gameObject.body) {
                    this.scene.physics.world.disable(gameObject);
                }

                // Remove from any active colliders
                this.scene.physics.world.colliders.getActive()
                    .filter(collider => collider.object1 === gameObject || collider.object2 === gameObject)
                    .forEach(collider => collider.destroy());

                // Add fade out effect
                this.scene.tweens.add({
                    targets: gameObject,
                    alpha: 0,
                    scale: 0.1,
                    duration: 500,
                    ease: 'Power2',
                    onComplete: () => {
                        // Double check physics is disabled before destruction
                        if (gameObject.body) {
                            this.scene.physics.world.disable(gameObject);
                        }
                        gameObject.destroy();
                    }
                });
            }
        });

        // Reset enemy counter
        this.enemiesRemaining = 0;
    }

    /**
     * Setup enemy spawns for this round
     */
    private setupEnemySpawns(): void {
        // Get difficulty settings
        const diffSettings = DIFFICULTY_SETTINGS[this.scene.getDifficultyLevel()];

        // Calculate total enemies for this round
        const baseEnemies = 5;
        const enemiesPerRound = 2;
        const difficultyMultiplier = diffSettings.enemyCountMultiplier || 1.0;
        this.enemiesRemaining = Math.floor((baseEnemies + (this.currentRound - 1) * enemiesPerRound) * difficultyMultiplier);

        if (this.roundStateDebug) {
            console.log(`[Round] Setting up ${this.enemiesRemaining} enemies for round ${this.currentRound}`);
        }

        // Calculate spawn timing
        const baseInterval = Math.max(500, 2000 - (this.currentRound - 1) * 100);
        let spawnDelay = 1000; // Start with a 1 second delay

        // Create spawn waves
        const enemiesPerWave = Math.min(3 + Math.floor(this.currentRound / 2), 8);
        const waves = Math.ceil(this.enemiesRemaining / enemiesPerWave);

        for (let wave = 0; wave < waves; wave++) {
            const enemiesThisWave = Math.min(enemiesPerWave, this.enemiesRemaining - wave * enemiesPerWave);

            if (this.roundStateDebug) {
                console.log(`[Round] Wave ${wave + 1}: ${enemiesThisWave} enemies, starting at ${spawnDelay}ms`);
            }

            // Spawn enemies in this wave
            for (let i = 0; i < enemiesThisWave; i++) {
                this.scene.time.addEvent({
                    delay: spawnDelay,
                    callback: () => {
                        // Only spawn if still in combat phase
                        if (this.roundState === 'combat' && this.isRoundActive) {
                            const enemyType = this.chooseEnemyType();
                            this.scene.spawnEnemyPublic(enemyType);
                        }
                    },
                    callbackScope: this
                });

                spawnDelay += baseInterval;
            }

            // Add delay between waves
            spawnDelay += 3000; // 3 second break between waves
        }
    }

    /**
     * Choose an enemy type based on the current round
     */
    private chooseEnemyType(): EnemyType {
        // As rounds progress, introduce stronger enemies
        const availableTypes: EnemyType[] = [EnemyType.Normal];

        if (this.currentRound >= 3) {
            availableTypes.push(EnemyType.Fast);
        }

        if (this.currentRound >= 5) {
            availableTypes.push(EnemyType.Tank);
        }

        if (this.currentRound >= 7) {
            availableTypes.push(EnemyType.Boss);
        }

        // Higher chance for special enemies in later rounds
        if (this.currentRound > 10) {
            availableTypes.push(EnemyType.Fast, EnemyType.Tank); // Add extra entries to increase probability
        }

        return Phaser.Math.RND.pick(availableTypes);
    }

    /**
     * Show round message
     */
    private showRoundMessage(message: string, color: number = 0xffffff): void {
        const text = this.scene.add.text(
            this.scene.cameras.main.worldView.centerX,
            this.scene.cameras.main.worldView.centerY - 50,
            message,
            {
                fontSize: '32px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 6,
                align: 'center'
            }
        );
        text.setOrigin(0.5);
        text.setScrollFactor(0);
        text.setDepth(1000);

        // Add glow effect
        text.setTint(color);

        // Scale animation
        this.scene.tweens.add({
            targets: text,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 500,
            yoyo: true,
            repeat: 0,
            ease: 'Sine.easeInOut'
        });

        // Fade out
        this.scene.tweens.add({
            targets: text,
            alpha: 0,
            y: text.y - 100,
            delay: 1000,
            duration: 1000,
            onComplete: () => {
                text.destroy();
            }
        });
    }

    /**
     * Show resource message
     */
    private showResourceMessage(amount: number): void {
        const text = this.scene.add.text(
            this.scene.cameras.main.worldView.centerX,
            this.scene.cameras.main.worldView.centerY + 30,
            `+${amount} Resources`,
            {
                fontSize: '24px',
                color: '#ffff00',
                stroke: '#000000',
                strokeThickness: 4
            }
        );
        text.setOrigin(0.5);
        text.setScrollFactor(0);
        text.setDepth(1000);

        this.scene.tweens.add({
            targets: text,
            alpha: 0,
            y: text.y - 50,
            delay: 500,
            duration: 1500,
            onComplete: () => {
                text.destroy();
            }
        });
    }

    /**
     * Show heal message
     */
    private showHealMessage(amount: number): void {
        const text = this.scene.add.text(
            this.scene.cameras.main.worldView.centerX,
            this.scene.cameras.main.worldView.centerY + 70,
            `+${amount} Health Restored`,
            {
                fontSize: '24px',
                color: '#00ff00',
                stroke: '#000000',
                strokeThickness: 4
            }
        );
        text.setOrigin(0.5);
        text.setScrollFactor(0);
        text.setDepth(1000);

        this.scene.tweens.add({
            targets: text,
            alpha: 0,
            y: text.y - 50,
            delay: 1000,
            duration: 1500,
            onComplete: () => {
                text.destroy();
            }
        });
    }

    /**
     * Get the number of enemies remaining
     */
    public getEnemiesRemaining(): number {
        return this.enemiesRemaining;
    }

    /**
     * Called when an enemy is defeated
     */
    public enemyDefeated(): void {
        if (this.enemiesRemaining > 0) {
            this.enemiesRemaining--;
        }
        this.checkRoundCompletion();
    }

    /**
     * Reset the round manager
     */
    public reset(): void {
        this.currentRound = 0;
        this.enemiesRemaining = 0;
        this.roundState = 'build';
        this.isRoundActive = false;
        this.isRoundEnding = false;

        if (this.roundTransitionTimer) {
            this.roundTransitionTimer.destroy();
            this.roundTransitionTimer = null;
        }
    }
}