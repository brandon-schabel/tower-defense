export default class GameState {
  private resources: number = 100;

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

  saveToLocalStorage() {
    localStorage.setItem("game-state", JSON.stringify({ resources: this.resources }));
  }

  loadFromLocalStorage() {
    const data = localStorage.getItem("game-state");
    if (data) {
      const parsed = JSON.parse(data);
      this.resources = parsed.resources || 100;
    } else {
        this.resources = 100;
    }
  }
}