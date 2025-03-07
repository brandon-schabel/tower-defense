import { Tower } from "../entities/tower/tower";
import { GameScene } from "../scenes/game-scene";
import { GAME_SETTINGS, TowerType } from "../settings";
import { EquipmentItem, GameItem, ItemRarity } from "../types/item";
import { GameState, GameStateEnum } from "../utils/game-state";

// New enums
enum ItemSlot {
  Weapon = 'weapon',
  Head = 'head',
  Body = 'body',
  Accessory = 'accessory',
  Armor = 'armor',
  Helmet = 'helmet'
}

enum ResearchCategory {
  Towers = 'towers',
  Player = 'player',
  Economy = 'economy'
}

// New interfaces
interface ItemStats {
  healthBonus?: number;
  damageBonus?: number;
  speedBonus?: number;
  rangeBonus?: number;
  specialEffect?: {
    type: string;
    chance: number;
    power: number;
  };
}

// Updated to be used with inventory system
interface InventoryItem {
  id: string;
  name: string;
  description: string;
  texture: string;
  tier: number;
  slot: ItemSlot;
  stats: ItemStats;
  rarity: ItemRarity;
  properties?: {
    healthBonus?: number;
    speedBonus?: number;
    damageBonus?: number;
    rangeBonus?: number;
  };
}

interface ResearchNode {
  id: string;
  name: string;
  description: string;
  category: ResearchCategory;
  cost: number;
  maxLevel: number;
  effects: {
    type: string;
    value: number;
  }[];
}

export class ResearchTree {
  private static instance: ResearchTree;
  private researchLevels: { [key: string]: number } = {};
  private researchNodes: ResearchNode[] = [
    {
      id: 'tower-damage-1',
      name: 'Tower Damage I',
      description: 'Increases tower damage by 10%',
      category: ResearchCategory.Towers,
      cost: 50,
      maxLevel: 3,
      effects: [{ type: 'towerDamage', value: 0.1 }]
    },
    {
      id: 'player-health-1',
      name: 'Player Health I',
      description: 'Increases player health by 20',
      category: ResearchCategory.Player,
      cost: 40,
      maxLevel: 3,
      effects: [{ type: 'playerHealth', value: 20 }]
    },
    {
      id: 'economy-income-1',
      name: 'Income I',
      description: 'Increases income per round by 5',
      category: ResearchCategory.Economy,
      cost: 30,
      maxLevel: 5,
      effects: [{ type: 'income', value: 5 }]
    }
  ];

  private constructor() {
    this.loadFromStorage();
  }

  public static getInstance(): ResearchTree {
    if (!ResearchTree.instance) {
      ResearchTree.instance = new ResearchTree();
    }
    return ResearchTree.instance;
  }

  public getResearchLevel(nodeId: string): number {
    return this.researchLevels[nodeId] || 0;
  }

  public canResearch(nodeId: string): boolean {
    const node = this.researchNodes.find(n => n.id === nodeId);
    if (!node) return false;

    const currentLevel = this.getResearchLevel(nodeId);
    if (currentLevel >= node.maxLevel) return false;

    // Check if there are any prerequisite nodes and if they are at the required level
    // if (node.prerequisites) {
    //   for (const [prerequisiteNodeId, requiredLevel] of Object.entries(node.prerequisites)) {
    //     if (this.getResearchLevel(prerequisiteNodeId) < requiredLevel) {
    //       return false;
    //     }
    //   }
    // }

    return true;
  }

  public completeResearch(nodeId: string): void {
    if (!this.canResearch(nodeId)) {
      console.warn(`Cannot research node ${nodeId}`);
      return;
    }

    this.researchLevels[nodeId] = (this.researchLevels[nodeId] || 0) + 1;
    console.log(`Researched ${nodeId} to level ${this.researchLevels[nodeId]}`);
  }

  public getCategoryNodes(category: ResearchCategory): ResearchNode[] {
    return this.researchNodes.filter(node => node.category === category);
  }

  public saveToStorage(): void {
    localStorage.setItem('researchLevels', JSON.stringify(this.researchLevels));
  }

  private loadFromStorage(): void {
    const storedLevels = localStorage.getItem('researchLevels');
    if (storedLevels) {
      this.researchLevels = JSON.parse(storedLevels);
    }
  }
}

export class HUD {
  // Add new UI elements
  private playerStatsDisplay: HTMLElement;
  private inventoryButton: HTMLButtonElement;
  private researchButton: HTMLButtonElement;
  private difficultyDisplay: HTMLElement;
  private powerUpsDisplay: HTMLElement;

  private gameScene: GameScene;
  private gameState: GameState;
  private resourcesDisplay: HTMLElement;
  private startRoundButton: HTMLButtonElement;
  private pauseButton: HTMLButtonElement;
  private menuButton: HTMLButtonElement;
  private towerButtons: HTMLElement;
  private towerStatsDisplay: HTMLElement;

  constructor(scene: GameScene) {
    this.gameScene = scene;
    // Get GameState from scene
    this.gameState = scene.getGameState();

    // Get UI elements
    this.resourcesDisplay = document.getElementById('resources-display') || this.createResourcesDisplay();
    this.startRoundButton = document.getElementById('start-round') as HTMLButtonElement;
    this.pauseButton = document.getElementById('pause') as HTMLButtonElement;
    this.menuButton = document.getElementById('menu') as HTMLButtonElement;
    this.towerButtons = document.getElementById('tower-buttons') as HTMLElement;
    this.towerStatsDisplay = document.getElementById('tower-stats') || this.createTowerStatsDisplay();

    // Create new UI elements
    this.playerStatsDisplay = document.getElementById('player-stats') || this.createPlayerStatsDisplay();
    this.inventoryButton = document.getElementById('inventory-button') as HTMLButtonElement || this.createInventoryButton();
    this.researchButton = document.getElementById('research-button') as HTMLButtonElement || this.createResearchButton();
    this.difficultyDisplay = document.getElementById('difficulty-display') || this.createDifficultyDisplay();
    this.powerUpsDisplay = document.getElementById('power-ups-display') || this.createPowerUpsDisplay();

    // Initialize tower buttons
    this.initializeTowerButtons();

    // Set up button handlers
    this.setupEventListeners();

    // Set up event handlers
    this.inventoryButton.addEventListener('click', () => this.showInventory());
    this.researchButton.addEventListener('click', () => this.showResearch());

    // Update initial displays
    this.updatePlayerStats();
    this.updateDifficultyDisplay();

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

  private createPlayerStatsDisplay(): HTMLElement {
    const display = document.createElement('div');
    display.id = 'player-stats';
    display.className = 'player-stats';
    document.body.appendChild(display);
    return display;
  }

  private createInventoryButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.id = 'inventory-button';
    button.textContent = 'Inventory';
    button.className = 'ui-button';
    document.getElementById('game-controls')?.appendChild(button);
    return button;
  }

  private createResearchButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.id = 'research-button';
    button.textContent = 'Research';
    button.className = 'ui-button';
    document.getElementById('game-controls')?.appendChild(button);
    return button;
  }

  private createDifficultyDisplay(): HTMLElement {
    const display = document.createElement('div');
    display.id = 'difficulty-display';
    display.className = 'difficulty-display';
    document.body.appendChild(display);
    return display;
  }

  private createPowerUpsDisplay(): HTMLElement {
    const display = document.createElement('div');
    display.id = 'power-ups-display';
    display.className = 'power-ups-display';
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

  public updatePlayerStats() {
    // Access the player entity directly through the scene's bootstrapper
    try {
      // Get the player entity from the game coordinator
      const player = this.gameScene.getGameState().getScene()?.registry.get('player');
      
      if (!player) return;
      
      const stats = `
        <h3>Player Stats</h3>
        <p>Health: ${player.getHealth()}/${player.getMaxHealth()}</p>
        <p>Damage: ${player.getDamage()}</p>
        <p>Speed: ${player.getMoveSpeed()}</p>
        <p>Range: ${player.getRange()}</p>
      `;
      this.playerStatsDisplay.innerHTML = stats;
    } catch (error) {
      console.error("Could not update player stats:", error);
    }
  }

  public updateDifficultyDisplay() {
    const difficulty = this.gameState.getDifficulty();
    this.difficultyDisplay.textContent = `Difficulty: ${difficulty}`;
  }

  public updatePowerUpsDisplay(activeBuffs: Map<string, { value: number, endTime: number }>) {
    this.powerUpsDisplay.innerHTML = '';

    if (activeBuffs.size === 0) {
      return;
    }

    const header = document.createElement('h3');
    header.textContent = 'Active Buffs';
    this.powerUpsDisplay.appendChild(header);

    const currentTime = this.gameScene.time.now;

    activeBuffs.forEach((buff, type) => {
      const timeLeft = Math.max(0, Math.ceil((buff.endTime - currentTime) / 1000));

      if (timeLeft > 0) {
        const buffDisplay = document.createElement('div');
        buffDisplay.className = 'buff-item';

        let name = '';
        switch (type) {
          case 'attackSpeed': name = 'Attack Speed'; break;
          case 'damage': name = 'Damage'; break;
          case 'range': name = 'Range'; break;
          case 'invincible': name = 'Invincibility'; break;
          default: name = type;
        }

        buffDisplay.innerHTML = `
          <span class="buff-name">${name}</span>
          <span class="buff-time">${timeLeft}s</span>
        `;

        this.powerUpsDisplay.appendChild(buffDisplay);
      }
    });
  }

  private initializeTowerButtons() {
    this.towerButtons.innerHTML = '';
    Object.entries(GAME_SETTINGS.towers).forEach(([type, data]) => {
      const button = document.createElement('button');
      button.className = 'tower-button';
      button.innerHTML = `
        <img src="/assets/towers/${(data as any).texture}.svg" alt="${(data as any).name}" />
        <span class="price">${(data as any).price}</span>
      `;
      button.addEventListener('click', () => {
        // Simplified build mode trigger - use scene registry for build state
        this.gameState.setBuildModeActive(true);
        this.gameScene.registry.set('selectedTowerType', type);
      });
      this.towerButtons.appendChild(button);
    });
  }

  private setupEventListeners() {
    this.startRoundButton.addEventListener('click', () => {
      if (this.startRoundButton.disabled) return;
      
      // Signal to game state to start the round
      this.gameState.transition(GameStateEnum.COMBAT_PHASE);
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

  private showInventory() {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'inventory-overlay';
    document.body.appendChild(overlay);

    try {
      // Get inventory and equipped items from the game registry
      const inventory = this.gameScene.registry.get('inventory') || [];
      const equippedItems = this.gameScene.registry.get('equippedItems') || new Map();

      // Create inventory container
      const inventoryContainer = document.createElement('div');
      inventoryContainer.className = 'inventory-container';

      // Create equipped items section
      const equippedSection = document.createElement('div');
      equippedSection.className = 'equipped-section';
      equippedSection.innerHTML = '<h3>Equipped</h3>';

      // Create slots for equipped items
      const slots = [ItemSlot.Weapon, ItemSlot.Head, ItemSlot.Body, ItemSlot.Accessory];

      slots.forEach(slot => {
        const slotDiv = document.createElement('div');
        slotDiv.className = `item-slot ${slot}-slot`;

        const item = equippedItems.get(slot) as EquipmentItem | undefined;
        if (item) {
          slotDiv.innerHTML = `
            <img src="/assets/${item.texture || 'item-default'}.svg" alt="${item.name}" />
            <div class="item-tooltip">
              <h4>${item.name}</h4>
              <p>${item.description || ''}</p>
              <p class="item-stats">${this.formatItemStats(item.properties || {})}</p>
            </div>
          `;
          slotDiv.addEventListener('click', () => {
            // Emit an event for unequipping the item
            this.gameScene.events.emit('unequipItem', slot);
            overlay.remove();
            this.showInventory();
          });
        }

        equippedSection.appendChild(slotDiv);
      });

      inventoryContainer.appendChild(equippedSection);

      // Create inventory grid
      const inventoryGrid = document.createElement('div');
      inventoryGrid.className = 'inventory-grid';
      inventoryGrid.innerHTML = '<h3>Inventory</h3>';

      // Add inventory items
      inventory.forEach((item: GameItem) => {
        const itemDiv = document.createElement('div');
        // Check if item has a tier property before accessing it
        const tierClass = (item as any).tier ? `tier-${(item as any).tier}` : 'tier-1';
        itemDiv.className = `inventory-item ${tierClass}`;

        itemDiv.innerHTML = `
          <img src="/assets/${item.texture || 'item-default'}.svg" alt="${item.name || 'Unknown Item'}" />
          <div class="item-tooltip">
            <h4>${item.name || 'Unknown Item'}</h4>
            <p>${item.description || ''}</p>
            <p class="item-stats">${this.formatItemStats(item.properties || {})}</p>
          </div>
        `;

        itemDiv.addEventListener('click', () => {
          // Emit an event for equipping the item
          this.gameScene.events.emit('equipItem', item);
          overlay.remove();
          this.showInventory();
        });

        inventoryGrid.appendChild(itemDiv);
      });

      inventoryContainer.appendChild(inventoryGrid);
      overlay.appendChild(inventoryContainer);

      // Close button
      const closeButton = document.createElement('button');
      closeButton.className = 'close-button';
      closeButton.textContent = 'X';
      closeButton.addEventListener('click', () => overlay.remove());

      inventoryContainer.appendChild(closeButton);
    } catch (error) {
      console.error("Could not load inventory:", error);
      overlay.innerHTML = '<p>Inventory not available</p>';
    }
  }

  private formatItemStats(stats: any): string {
    const statLines = [];

    if (stats.healthBonus) {
      statLines.push(`+${stats.healthBonus} Health`);
    }

    if (stats.damageBonus) {
      statLines.push(`+${stats.damageBonus} Damage`);
    }

    if (stats.speedBonus) {
      statLines.push(`+${stats.speedBonus * 100}% Speed`);
    }

    if (stats.rangeBonus) {
      statLines.push(`+${stats.rangeBonus} Range`);
    }

    if (stats.specialEffect) {
      const effect = stats.specialEffect;
      statLines.push(`${effect.type.charAt(0).toUpperCase() + effect.type.slice(1)}: ${effect.chance * 100}% chance to deal ${effect.power} damage`);
    }

    return statLines.join('<br>');
  }

  private showResearch() {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'research-overlay';
    document.body.appendChild(overlay);

    const researchTree = ResearchTree.getInstance();

    // Create research container
    const researchContainer = document.createElement('div');
    researchContainer.className = 'research-container';

    // Create categories
    const categories = Object.values(ResearchCategory);

    categories.forEach(category => {
      const categoryDiv = document.createElement('div');
      categoryDiv.className = `research-category ${category}-category`;

      const categoryTitle = document.createElement('h3');
      categoryTitle.textContent = category.charAt(0).toUpperCase() + category.slice(1);
      categoryDiv.appendChild(categoryTitle);

      // Get research nodes for this category
      const nodes = researchTree.getCategoryNodes(category);

      nodes.forEach(node => {
        const nodeDiv = document.createElement('div');
        nodeDiv.className = 'research-node';

        const currentLevel = researchTree.getResearchLevel(node.id);
        const isAvailable = researchTree.canResearch(node.id);

        nodeDiv.innerHTML = `
          <h4>${node.name}</h4>
          <p>${node.description}</p>
          <p>Level: ${currentLevel}/${node.maxLevel}</p>
          <p>Cost: ${node.cost}</p>
        `;

        if (currentLevel < node.maxLevel && isAvailable) {
          const researchButton = document.createElement('button');
          researchButton.textContent = 'Research';
          researchButton.className = 'research-button';

          // Disable if not enough resources
          if (!this.gameState.canAfford(node.cost)) {
            researchButton.disabled = true;
            researchButton.classList.add('disabled');
          }

          researchButton.addEventListener('click', () => {
            if (this.gameState.spendResources(node.cost)) {
              researchTree.completeResearch(node.id);
              researchTree.saveToStorage();
              this.updateResources();
              overlay.remove();
              this.showResearch(); // Refresh research tree
            }
          });

          nodeDiv.appendChild(researchButton);
        }

        categoryDiv.appendChild(nodeDiv);
      });

      researchContainer.appendChild(categoryDiv);
    });

    overlay.appendChild(researchContainer);

    // Close button
    const closeButton = document.createElement('button');
    closeButton.className = 'close-button';
    closeButton.textContent = 'X';
    closeButton.addEventListener('click', () => overlay.remove());

    researchContainer.appendChild(closeButton);
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
      this.gameState.saveToLocalStorage();
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
    const resources = this.gameState.getResources();
    this.resourcesDisplay.textContent = `Resources: ${resources}`;
    
    // Update tower buttons based on available resources
    Array.from(this.towerButtons.children).forEach(button => {
      const buttonEl = button as HTMLButtonElement;
      const towerName = buttonEl.querySelector('img')?.alt || '';
      const towerTypeKey = Object.keys(GAME_SETTINGS.towers).find(
        key => (GAME_SETTINGS.towers[key as TowerType] as any).name === towerName
      );
      if (towerTypeKey) {
        const price = (GAME_SETTINGS.towers[towerTypeKey as TowerType] as any).price;
        buttonEl.disabled = resources < price;
      }
    });
  }

  public showNextRoundButton(callback: () => void) {
    this.startRoundButton.textContent = 'Next Round';
    this.startRoundButton.disabled = false;
    this.startRoundButton.onclick = () => {
      callback();
      this.startRoundButton.textContent = 'Start Round';
      this.startRoundButton.onclick = () => {
        // Transition to combat phase
        this.gameState.transition(GameStateEnum.COMBAT_PHASE);
      };
    };
  }

  public disableRoundButton(): void {
    if (this.startRoundButton) {
      this.startRoundButton.disabled = true;
      this.startRoundButton.style.opacity = '0.5';
      this.startRoundButton.style.cursor = 'not-allowed';
    }
  }

  public enableRoundButton(): void {
    if (this.startRoundButton) {
      this.startRoundButton.disabled = false;
      this.startRoundButton.style.opacity = '1.0';
      this.startRoundButton.style.cursor = 'pointer';
    }
  }

  public updateRoundButtonText(text: string): void {
    if (this.startRoundButton) {
      this.startRoundButton.textContent = text;
    }
  }

  public getResearchTree(): ResearchTree {
    return ResearchTree.getInstance();
  }
}