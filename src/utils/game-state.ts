import { GAME_SETTINGS } from "../settings"; // Import

export default class GameState {
  private resources: number = GAME_SETTINGS.resources.initialAmount; // Use from settings
  public isInventoryOpen: boolean = false;

  getResources() {
    return this.resources;
  }

  spendResources(amount: number): boolean {
    if (this.resources >= amount) {
      this.resources -= amount;
      console.log(`Spent ${amount}. New total: ${this.resources}`);
      return true;
    }
    console.log(`Not enough resources. Need ${amount}, have ${this.resources}`);
    return false;
  }

  earnResources(amount: number) {
    this.resources += amount;
  }

  canAfford(amount: number): boolean {
    return this.resources >= amount;
  }

  setInventoryOpen(isOpen: boolean): void {
    this.isInventoryOpen = isOpen;
  }

  saveToLocalStorage() {
    localStorage.setItem("game-state", JSON.stringify({ 
      resources: this.resources,
      isInventoryOpen: this.isInventoryOpen
    }));
  }

  loadFromLocalStorage() {
    const data = localStorage.getItem("game-state");
    if (data) {
      const parsed = JSON.parse(data);
      this.resources = parsed.resources || GAME_SETTINGS.resources.initialAmount; //from settings
      this.isInventoryOpen = parsed.isInventoryOpen || false;
    } else {
      this.resources = GAME_SETTINGS.resources.initialAmount; //from settings
      this.isInventoryOpen = false;
    }
  }
}