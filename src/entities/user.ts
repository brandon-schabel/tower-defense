import Phaser from "phaser";
import GameScene from "../scenes/game-scene";

export default class User extends Phaser.Physics.Arcade.Sprite {
  private health: number = 100;
  private maxHealth: number = 100;
  private movementSpeed: number = 200;
  private shootRange: number = 200;
  private lastShotTime: number = 0;
  private shootCooldown: number = 200; // 200ms between shots
  private healthBar: Phaser.GameObjects.Graphics;

  constructor(scene: GameScene, x: number, y: number) {
    super(scene, x, y, "user");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);

    // Create health bar
    this.healthBar = scene.add.graphics();
    this.healthBar.setDepth(100);
    this.updateHealthBar();
  }

  update() {
    this.handleMovement();
    this.handleShooting();
    this.updateHealthBar(); // Update health bar every frame
  }

  heal(amount: number) {
    this.health = Math.min(this.health + amount, this.maxHealth);
    this.updateHealthBar();
  }

  getHealth(): number {
    return this.health;
  }

  takeDamage(amount: number) {
    this.health -= amount;
    this.updateHealthBar(); // Update on damage
    if (this.health <= 0) {
      this.scene.scene.start("MainMenuScene");
    }
  }

  private updateHealthBar() {
    this.healthBar.clear();

    // Background of health bar
    this.healthBar.fillStyle(0xff0000);
    this.healthBar.fillRect(this.x - 25, this.y - 40, 50, 5);

    // Health remaining
    this.healthBar.fillStyle(0x00ff00);
    this.healthBar.fillRect(
      this.x - 25,
      this.y - 40,
      Math.max(0, (this.health / this.maxHealth) * 50),
      5
    );
  }

  private handleMovement() {
    const keyboard = (this.scene as GameScene).input.keyboard!;
    const velocity = new Phaser.Math.Vector2(0, 0);

    // WASD movement
    if (keyboard.addKey("W").isDown) velocity.y = -this.movementSpeed;
    if (keyboard.addKey("S").isDown) velocity.y = this.movementSpeed;
    if (keyboard.addKey("A").isDown) velocity.x = -this.movementSpeed;
    if (keyboard.addKey("D").isDown) velocity.x = this.movementSpeed;

    // Normalize diagonal movement
    if (velocity.length() > 0) {
      velocity.normalize().scale(this.movementSpeed);
    }

    this.setVelocity(velocity.x, velocity.y);

    // Rotate user to face mouse cursor
    const pointer = (this.scene as GameScene).input.activePointer;
    this.rotation = Phaser.Math.Angle.Between(this.x, this.y, pointer.x, pointer.y);
  }

  private handleShooting() {
    const currentTime = (this.scene as GameScene).time.now;
    const pointer = (this.scene as GameScene).input.activePointer;

    if ((this.scene as GameScene).input.keyboard!.addKey("SPACE").isDown &&
      currentTime - this.lastShotTime >= this.shootCooldown) {

      const distance = Phaser.Math.Distance.Between(this.x, this.y, pointer.x, pointer.y);

      if (distance <= this.shootRange) {
        this.shoot(pointer.x, pointer.y);
        this.lastShotTime = currentTime;
      }
    }
  }

  private shoot(targetX: number, targetY: number) {
    const angle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);
    const projectile = (this.scene as GameScene).physics.add.sprite(this.x, this.y, "projectile");
    projectile.setScale(0.5);
    projectile.setData("damage", 20);
    projectile.setData("target", { x: targetX, y: targetY });
    const body = projectile.body as Phaser.Physics.Arcade.Body;
    (this.scene as GameScene).physics.velocityFromRotation(angle, 400, body.velocity);

    (this.scene as GameScene).projectiles?.add(projectile);
    (this.scene as GameScene).time.delayedCall(1000, () => {
      if (projectile.active) projectile.destroy();
    });
  }
}