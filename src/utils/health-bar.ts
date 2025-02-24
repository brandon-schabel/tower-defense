import Phaser from "phaser";

export class HealthBar {
  private healthBar: Phaser.GameObjects.Graphics;
  private entity: Phaser.GameObjects.Sprite;
  private health: number;
  private maxHealth: number;
  private width: number = 50;
  private height: number = 5;
  private offsetY: number = -40;

  constructor(scene: Phaser.Scene, entity: Phaser.GameObjects.Sprite, maxHealth: number) {
    this.entity = entity;
    this.health = maxHealth;
    this.maxHealth = maxHealth;
    this.healthBar = scene.add.graphics().setDepth(100);
    this.updateHealthBar();
  }

  updateHealth(health: number) {
    this.health = Phaser.Math.Clamp(health, 0, this.maxHealth);
    this.updateHealthBar();
  }

  cleanup() {
    this.healthBar.destroy();
  }

  private updateHealthBar() {
    this.healthBar.clear();
    this.healthBar.fillStyle(0xff0000);
    this.healthBar.fillRect(
      this.entity.x - this.width / 2,
      this.entity.y + this.offsetY,
      this.width,
      this.height
    );
    this.healthBar.fillStyle(0x00ff00);
    this.healthBar.fillRect(
      this.entity.x - this.width / 2,
      this.entity.y + this.offsetY,
      (this.health / this.maxHealth) * this.width,
      this.height
    );
  }
} 