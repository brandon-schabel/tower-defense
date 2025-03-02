/**
 * Pause Scene
 * Displayed when the game is paused
 * Provides options to resume, restart, or return to the main menu
 */
import Phaser from 'phaser';
import { UI_CONFIG } from '../config/game-config';

export class PauseScene extends Phaser.Scene {
    private resumeButton: Phaser.GameObjects.Text | null;
    private menuButton: Phaser.GameObjects.Text | null;
    private restartButton: Phaser.GameObjects.Text | null;

    constructor() {
        super({ key: 'pause' });

        this.resumeButton = null;
        this.menuButton = null;
        this.restartButton = null;
    }

    create(): void {
        // Add semi-transparent background
        const { width, height } = this.cameras.main;
        const bg = this.add.rectangle(0, 0, width, height, 0x000000, 0.7);
        bg.setOrigin(0);

        // Add pause menu text
        const titleText = this.add.text(
            width / 2,
            height / 3,
            'GAME PAUSED',
            {
                fontFamily: 'Arial',
                fontSize: UI_CONFIG.fontSize.title,
                color: UI_CONFIG.colors.primary,
                stroke: '#000000',
                strokeThickness: 4
            }
        );
        titleText.setOrigin(0.5);

        // Create buttons
        this.createButtons();

        // Listen for the resume key (ESC)
        const keyboard = this.input.keyboard;
        if (keyboard) {
            keyboard.on('keydown-ESC', this.resumeGame, this);
        }
    }

    private createButtons(): void {
        const { width, height } = this.cameras.main;
        const buttonY = height / 2;
        const buttonSpacing = 60;

        // Resume button
        this.resumeButton = this.add.text(
            width / 2,
            buttonY,
            'RESUME GAME',
            {
                fontFamily: 'Arial',
                fontSize: UI_CONFIG.fontSize.large,
                color: UI_CONFIG.colors.highlight
            }
        );
        this.resumeButton.setOrigin(0.5);
        this.resumeButton.setInteractive({ useHandCursor: true });
        this.resumeButton.on('pointerdown', this.resumeGame, this);
        this.resumeButton.on('pointerover', () => this.resumeButton?.setColor(UI_CONFIG.colors.primary));
        this.resumeButton.on('pointerout', () => this.resumeButton?.setColor(UI_CONFIG.colors.highlight));

        // Restart button
        this.restartButton = this.add.text(
            width / 2,
            buttonY + buttonSpacing,
            'RESTART LEVEL',
            {
                fontFamily: 'Arial',
                fontSize: UI_CONFIG.fontSize.large,
                color: UI_CONFIG.colors.highlight
            }
        );
        this.restartButton.setOrigin(0.5);
        this.restartButton.setInteractive({ useHandCursor: true });
        this.restartButton.on('pointerdown', this.restartGame, this);
        this.restartButton.on('pointerover', () => this.restartButton?.setColor(UI_CONFIG.colors.primary));
        this.restartButton.on('pointerout', () => this.restartButton?.setColor(UI_CONFIG.colors.highlight));

        // Menu button
        this.menuButton = this.add.text(
            width / 2,
            buttonY + buttonSpacing * 2,
            'MAIN MENU',
            {
                fontFamily: 'Arial',
                fontSize: UI_CONFIG.fontSize.large,
                color: UI_CONFIG.colors.highlight
            }
        );
        this.menuButton.setOrigin(0.5);
        this.menuButton.setInteractive({ useHandCursor: true });
        this.menuButton.on('pointerdown', this.returnToMenu, this);
        this.menuButton.on('pointerover', () => this.menuButton?.setColor(UI_CONFIG.colors.primary));
        this.menuButton.on('pointerout', () => this.menuButton?.setColor(UI_CONFIG.colors.highlight));
    }

    private resumeGame(): void {
        // Resume the game scene
        this.scene.resume('game');
        // Also resume the UI scene
        this.scene.resume('ui');
        // Close the pause scene
        this.scene.stop();
    }

    private restartGame(): void {
        // Stop the current game
        this.scene.stop('game');
        this.scene.stop('ui');

        // Restart the game scene
        this.scene.start('game');

        // Close the pause scene
        this.scene.stop();
    }

    private returnToMenu(): void {
        // Stop all game-related scenes
        this.scene.stop('game');
        this.scene.stop('ui');

        // Start the menu scene
        this.scene.start('menu');

        // Close the pause scene
        this.scene.stop();
    }
} 