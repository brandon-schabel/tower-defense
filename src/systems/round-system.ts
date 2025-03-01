import Phaser from 'phaser';
import { GameScene } from '../scenes/game-scene';
import { EnemyType } from '../entities/enemy/enemy-type';
import { EntityManager } from '../managers/entity-manager';
import { GameState, GameStateEnum } from '../utils/game-state';
import { EventBus } from '../core/event-bus';

export class RoundSystem {
    private scene: GameScene;
    private roundState: 'build' | 'combat' | 'roundEnd' | 'transitioning' = 'build';
    private enemiesRemaining: number = 0;
    private currentRound: number = 0;
    private isRoundEnding: boolean = false;
    private isRoundActive: boolean = false;
    private roundTransitionTimer: Phaser.Time.TimerEvent | null = null;
    private roundStateDebug: boolean = true; // Set to true for debugging state transitions
    private entityManager: EntityManager;
    private eventBus: EventBus;
    private gameState: GameState;

    constructor(
        scene: GameScene,
        entityManager: EntityManager,
        eventBus: EventBus,
        gameState: GameState
    ) {
        this.scene = scene;
        this.entityManager = entityManager;
        this.eventBus = eventBus;
        this.gameState = gameState;

        // Register state change handlers
        this.setupStateHandlers();
    }

    /**
     * Setup handlers for game state changes
     */
    private setupStateHandlers(): void {
        // Register handlers for specific game states
        this.gameState.registerStateHandler(GameStateEnum.BUILD_PHASE, () => {
            this.onEnterBuildPhase();
        });

        this.gameState.registerStateHandler(GameStateEnum.COMBAT_PHASE, () => {
            this.onEnterCombatPhase();
        });

        this.gameState.registerStateHandler(GameStateEnum.ROUND_END, () => {
            this.onEnterRoundEndPhase();
        });

        // Register global state change handler to sync internal roundState
        this.gameState.registerGlobalStateChangeHandler((prevState, newState) => {
            this.syncRoundStateWithGameState(newState);
        });
    }

    /**
     * Synchronize internal roundState with the global game state
     */
    private syncRoundStateWithGameState(gameState: GameStateEnum): void {
        switch (gameState) {
            case GameStateEnum.BUILD_PHASE:
                this.roundState = 'build';
                break;
            case GameStateEnum.COMBAT_PHASE:
                this.roundState = 'combat';
                break;
            case GameStateEnum.ROUND_END:
                this.roundState = 'roundEnd';
                break;
            // For other states, we don't update roundState
        }
    }

    /**
     * Handler for entering the build phase
     */
    private onEnterBuildPhase(): void {
        if (this.roundStateDebug) {
            console.log('RoundSystem: Entered BUILD_PHASE');
        }

        this.isRoundActive = false;
        this.isRoundEnding = false;

        // Emit round transition event
        this.eventBus.emit('round-transition-to-build');
    }

    /**
     * Handler for entering the combat phase
     */
    private onEnterCombatPhase(): void {
        if (this.roundStateDebug) {
            console.log('RoundSystem: Entered COMBAT_PHASE');
        }

        this.isRoundActive = true;
        this.isRoundEnding = false;

        // Log round start
        console.log(`Starting round ${this.currentRound}`);

        // Show round message
        this.showRoundMessage(`Round ${this.currentRound}`, 0xffff00);

        // Emit event
        this.eventBus.emit('round-started', this.currentRound);
    }

    /**
     * Handler for entering the round end phase
     */
    private onEnterRoundEndPhase(): void {
        if (this.roundStateDebug) {
            console.log('RoundSystem: Entered ROUND_END');
        }

        this.isRoundEnding = true;

        // Clear any remaining enemies
        this.clearRemainingEnemies();

        // Emit round end event
        this.eventBus.emit('round-ended', this.currentRound);
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
        if (this.isRoundActive) {
            console.warn('Attempted to start round while one is already active');
            return;
        }

        // Increment round counter
        this.currentRound++;

        // Transition to combat phase in game state
        this.gameState.transition(GameStateEnum.COMBAT_PHASE);

        // Setup enemy spawns for this round
        this.setupEnemySpawns();
    }

    /**
     * Start the next round
     */
    public startNextRound(): void {
        if (!this.gameState.isInState(GameStateEnum.BUILD_PHASE)) {
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
        if (this.isRoundEnding) {
            return;
        }

        // Transition to round end state
        this.gameState.transition(GameStateEnum.ROUND_END);

        // Calculate round rewards
        const baseReward = 50;
        const roundMultiplier = Math.max(1, this.currentRound * 0.5);
        const resourceReward = Math.floor(baseReward * roundMultiplier);

        // Award resources to player
        this.gameState.earnResources(resourceReward);

        // Show resource message
        this.showResourceMessage(resourceReward);

        // Heal player
        const healAmount = 20;
        this.entityManager.getUser().heal(healAmount);

        // Show heal message
        this.showHealMessage(healAmount);

        // Transition to build phase after delay
        this.roundTransitionTimer = this.scene.time.delayedCall(3000, () => {
            this.gameState.transition(GameStateEnum.BUILD_PHASE);
        });
    }

    /**
     * Check if the round is complete
     */
    public checkRoundCompletion(): void {
        if (!this.gameState.isInState(GameStateEnum.COMBAT_PHASE) || !this.isRoundActive) {
            return;
        }

        // Check if all enemies are defeated
        const enemies = this.entityManager.getEnemiesGroup();
        if (this.enemiesRemaining <= 0 && enemies && enemies.countActive() === 0) {
            this.handleRoundEnd();
        }
    }

    /**
     * Handle game over condition
     */
    public handleGameOver(isVictory: boolean = false): void {
        // Clear any active rounds
        this.clearRemainingEnemies();

        if (this.roundTransitionTimer) {
            this.roundTransitionTimer.destroy();
            this.roundTransitionTimer = null;
        }

        // Transition to game over state
        this.gameState.transition(GameStateEnum.GAME_OVER);

        // Emit game over event with victory status
        this.eventBus.emit('game-over', { isVictory, roundsCompleted: this.currentRound });
    }

    /**
     * Clear any remaining enemies with a fade effect
     */
    private clearRemainingEnemies(): void {
        // Get enemies group from entity manager
        const enemiesGroup = this.entityManager.getEnemiesGroup();

        if (!enemiesGroup) {
            console.warn('No enemies group found when clearing enemies');
            return;
        }

        // Count enemies before clearing
        const enemyCount = enemiesGroup.getChildren().length;

        if (enemyCount > 0) {
            console.log(`Clearing ${enemyCount} remaining enemies`);

            // Destroy all enemies
            enemiesGroup.clear(true, true);

            // Reset enemy count
            this.enemiesRemaining = 0;
        }
    }

    /**
     * Setup enemy spawns for this round
     */
    private setupEnemySpawns(): void {
        // Calculate number of enemies based on round number
        const baseEnemies = 5;
        const enemiesPerRound = 2;
        const totalEnemies = baseEnemies + (this.currentRound - 1) * enemiesPerRound;

        // Set enemies remaining counter
        this.enemiesRemaining = totalEnemies;

        // Log enemy count
        console.log(`Spawning ${totalEnemies} enemies for round ${this.currentRound}`);

        // Calculate spawn interval based on total enemies
        const roundDuration = 30000; // 30 seconds
        const spawnInterval = roundDuration / totalEnemies;

        // Create a timer to spawn enemies
        let enemiesSpawned = 0;

        const spawnTimer = this.scene.time.addEvent({
            delay: spawnInterval,
            callback: () => {
                if (enemiesSpawned < totalEnemies) {
                    // Choose enemy type based on round
                    const enemyType = this.chooseEnemyType();

                    // Spawn enemy
                    this.entityManager.spawnEnemy(enemyType);

                    // Increment counter
                    enemiesSpawned++;
                }
            },
            callbackScope: this,
            repeat: totalEnemies - 1
        });
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

        // Reset to build phase
        this.gameState.transition(GameStateEnum.BUILD_PHASE);
    }
}