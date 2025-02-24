import Tower from "../entities/tower";
import GameScene from "../scenes/game-scene";
import { GAME_SETTINGS, TowerType } from "../settings";

export default class HUD {
  private gameScene: GameScene;
  private resourcesDisplay: HTMLElement;
  private startRoundButton: HTMLButtonElement;
  private pauseButton: HTMLButtonElement;
  private menuButton: HTMLButtonElement;
  private towerButtons: HTMLElement;
  private towerStatsDisplay: HTMLElement;

  constructor(scene: GameScene) {
    this.gameScene = scene;

    // Get UI elements
    this.resourcesDisplay = document.getElementById('resources-display') || this.createResourcesDisplay();
    this.startRoundButton = document.getElementById('start-round') as HTMLButtonElement;
    this.pauseButton = document.getElementById('pause') as HTMLButtonElement;
    this.menuButton = document.getElementById('menu') as HTMLButtonElement;
    this.towerButtons = document.getElementById('tower-buttons') as HTMLElement;
    this.towerStatsDisplay = document.getElementById('tower-stats') || this.createTowerStatsDisplay();

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

  private createTowerStatsDisplay(): HTMLElement {
    const display = document.createElement('div');
    display.id = 'tower-stats';
    display.className = 'tower-stats';
    document.body.appendChild(display);
    return display;
  }

  public updateTowerStats(tower: Tower | null) {
    if (!tower) {
      this.towerStatsDisplay.innerHTML = '';
      return;
    }

    const stats = `
      <h3>${tower.towerType}</h3>
      <p>Health: ${tower.getHealth()}/${tower.getMaxHealth()}</p>
      <p>Damage: ${tower.getCurrentDamage()}</p>
      <p>Range: ${tower.getCurrentRange()}</p>
      <p>Speed: ${tower.getShootCooldown()} ms</p>
      <p>Upgrades: Speed Lv.${tower.getSpeedLevel()}, Range Lv.${tower.getRangeLevel()}, Damage Lv.${tower.getDamageLevel()}</p>
      ${tower.getSpecialPower() ? `<p>Special: ${tower.getSpecialPower()}</p>` : ''}
    `;
    this.towerStatsDisplay.innerHTML = stats;
  }

  private initializeTowerButtons() {
    this.towerButtons.innerHTML = '';
    Object.entries(GAME_SETTINGS.towers).forEach(([type, data]) => {
      const button = document.createElement('button');
      button.className = 'tower-button';
      button.innerHTML = `
        <img src="/assets/${data.texture}.svg" alt="${data.name}" />
        <span class="price">${data.price}</span>
      `;
      button.addEventListener('click', () => this.gameScene.enterBuildMode(type as TowerType));
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
    console.log(`HUD updated. Resources: ${resources}`);

    this.towerButtons.querySelectorAll('.tower-button').forEach((button) => {
      const buttonEl = button as HTMLButtonElement;
      const towerName = buttonEl.querySelector('img')?.alt || '';
      const towerType = Object.keys(GAME_SETTINGS.towers).find(
        towerType => GAME_SETTINGS.towers[towerType as TowerType].name === towerName
      );
      if (towerType) {
        const price = GAME_SETTINGS.towers[towerType as TowerType].price;
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