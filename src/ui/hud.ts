// src/ui/hud.ts
import Phaser from "phaser";
import GameScene from "../scenes/game-scene";

interface TowerData {
  name: string;
  price: number;
  texture: string;
  range: number;
  damage: number;
}

export const TOWER_TYPES: Record<string, TowerData> = {
  'normal-tower': {
    name: 'Normal Tower',
    price: 100,
    texture: 'normal-tower',
    range: 150,
    damage: 10
  },
  'sniper-tower': {
    name: 'Sniper Tower',
    price: 200,
    texture: 'sniper-tower',
    range: 300,
    damage: 25
  },
  'area-tower': {
    name: 'Area Tower',
    price: 150,
    texture: 'area-tower',
    range: 100,
    damage: 15
  }
};

export default class HUD {
  private gameScene: GameScene;
  private resourcesDisplay: HTMLElement;
  private startRoundButton: HTMLButtonElement;
  private pauseButton: HTMLButtonElement;
  private menuButton: HTMLButtonElement;
  private towerButtons: HTMLElement;

  constructor(scene: GameScene) {
    this.gameScene = scene;

    // Get UI elements
    this.resourcesDisplay = document.getElementById('resources-display') || this.createResourcesDisplay();
    this.startRoundButton = document.getElementById('start-round') as HTMLButtonElement;
    this.pauseButton = document.getElementById('pause') as HTMLButtonElement;
    this.menuButton = document.getElementById('menu') as HTMLButtonElement;
    this.towerButtons = document.getElementById('tower-buttons') as HTMLElement;

    // Initialize tower buttons
    this.initializeTowerButtons();

    // Set up button handlers
    this.setupEventListeners();

    // Initial resource update
    this.updateResources();
  }

  private createResourcesDisplay(): HTMLElement {
    const display = document.createElement('div');
    display.id = 'resources-display';
    document.body.appendChild(display);
    return display;
  }

  private initializeTowerButtons() {
    this.towerButtons.innerHTML = '';
    Object.entries(TOWER_TYPES).forEach(([type, data]) => {
      const button = document.createElement('button');
      button.className = 'tower-button';
      button.innerHTML = `
        <img src="/assets/${data.texture}.svg" alt="${data.name}" />
        <span class="price">${data.price}</span>
      `;
      button.addEventListener('click', () => this.gameScene.enterBuildMode(type));
      this.towerButtons.appendChild(button);
    });
  }

  private setupEventListeners() {
    this.startRoundButton.addEventListener('click', () => {
      this.gameScene.startRound();
      this.startRoundButton.disabled = true;
    });

    this.pauseButton.addEventListener('click', () => {
      const isPaused = this.gameScene.scene.isPaused();
      if (isPaused) {
        this.gameScene.scene.resume();
        this.pauseButton.textContent = 'Pause';
      } else {
        this.gameScene.scene.pause();
        this.pauseButton.textContent = 'Resume';
      }
    });

    this.menuButton.addEventListener('click', () => this.showMenu());
  }

  private showMenu() {
    const overlay = document.createElement('div');
    overlay.className = 'menu-overlay';
    overlay.innerHTML = `
      <button id="save-game">Save Game</button>
      <button id="settings">Settings</button>
      <button id="exit-game">Exit to Menu</button>
    `;
    document.body.appendChild(overlay);

    const closeMenu = () => overlay.remove();

    overlay.querySelector('#save-game')?.addEventListener('click', () => {
      this.gameScene.getGameState().saveToLocalStorage();
      closeMenu();
    });

    overlay.querySelector('#settings')?.addEventListener('click', () => {
      // TODO: Implement settings menu
      closeMenu();
    });

    overlay.querySelector('#exit-game')?.addEventListener('click', () => {
      if (confirm('Are you sure you want to exit? Any unsaved progress will be lost.')) {
        this.gameScene.scene.start('MainMenuScene');
        closeMenu();
      }
    });
  }

  updateResources() {
    const resources = this.gameScene.getGameState().getResources();
    this.resourcesDisplay.textContent = `Resources: ${resources}`;

    // Update tower button states
    this.towerButtons.querySelectorAll('.tower-button').forEach((button: Element) => {
      const buttonEl = button as HTMLButtonElement;
      const towerType = buttonEl.querySelector('img')?.alt;
      if (towerType && TOWER_TYPES[towerType.toLowerCase().replace(' ', '-')]) {
        const price = TOWER_TYPES[towerType.toLowerCase().replace(' ', '-')].price;
        buttonEl.disabled = resources < price;
      }
    });
  }

  showNextRoundButton(callback: () => void) {
    this.startRoundButton.textContent = 'Next Round';
    this.startRoundButton.disabled = false;
    this.startRoundButton.onclick = () => {
      callback();
      this.startRoundButton.textContent = 'Start Round';
      this.startRoundButton.onclick = () => this.gameScene.startRound();
    };
  }
}