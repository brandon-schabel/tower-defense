import Phaser from "phaser";
import GameScene from "../scenes/game-scene";
import { HealthBar } from "../utils/health-bar";
import { GAME_SETTINGS } from "../settings"; // Import

export default class Player extends Phaser.Physics.Arcade.Sprite {
  private health: number = GAME_SETTINGS.player.initialHealth; // Use from settings
  private maxHealth: number = GAME_SETTINGS.player.initialHealth; // Use from settings
  private movementSpeed: number = GAME_SETTINGS.player.movementSpeed; // Use from settings
  // private shootRange: number = GAME_SETTINGS.player.shootRange; // Use from settings
  private lastShotTime: number = 0;
  private shootCooldown: number = GAME_SETTINGS.player.shootCooldown; // Use from settings
  private healthBar: HealthBar;
  private keys: { up: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key; left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key; shoot: Phaser.Input.Keyboard.Key; };

  constructor(scene: GameScene, x: number, y: number) {
    super(scene, x, y, "user");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);

    this.healthBar = new HealthBar(scene, this, this.maxHealth);

    // Initialize keys
    this.keys = scene.input.keyboard!.addKeys({ up: 'W', down: 'S', left: 'A', right: 'D', shoot: 'SPACE' }) as {
      up: Phaser.Input.Keyboard.Key;
      down: Phaser.Input.Keyboard.Key;
      left: Phaser.Input.Keyboard.Key;
      right: Phaser.Input.Keyboard.Key;
      shoot: Phaser.Input.Keyboard.Key;
    };
  }

  update() {
    this.handleMovement();
    this.handleShooting();
    this.healthBar.updateHealth(this.health);
  }

  heal(amount: number) {
    this.health = Math.min(this.health + amount, this.maxHealth);
    this.healthBar.updateHealth(this.health);
  }

  getHealth(): number {
    return this.health;
  }

  takeDamage(damage: number) {
    if (!this.active) return; // Exit if the user is already destroyed
    this.health -= damage;
    this.healthBar.updateHealth(this.health);
    if (this.health <= 0) {
      this.health = 0;
      const gameScene = this.scene as GameScene;
      this.healthBar.cleanup();
      this.destroy();
      console.log("User died!");
      gameScene.gameOver();
    }
  }

  private handleMovement() {
    const velocity = new Phaser.Math.Vector2(0, 0);

    if (this.keys.up.isDown) velocity.y = -this.movementSpeed;
    if (this.keys.down.isDown) velocity.y = this.movementSpeed;
    if (this.keys.left.isDown) velocity.x = -this.movementSpeed;
    if (this.keys.right.isDown) velocity.x = this.movementSpeed;

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

    if (this.keys.shoot.isDown && currentTime - this.lastShotTime >= this.shootCooldown) {
      this.shoot(pointer.worldX, pointer.worldY);
      this.lastShotTime = currentTime;
    }
  }

  private shoot(targetX: number, targetY: number) {
    // Create a temporary physics target sprite at the mouse position
    const target = this.scene.physics.add.sprite(targetX, targetY, 'projectile');
    target.setVisible(false); // Hide the target sprite

    // Pass damage directly to shootProjectile
    (this.scene as GameScene).shootProjectile(this, target, GAME_SETTINGS.player.projectileDamage);

    // Clean up the temporary target sprite
    this.scene.time.delayedCall(100, () => {
      target.destroy();
    });
  }
}