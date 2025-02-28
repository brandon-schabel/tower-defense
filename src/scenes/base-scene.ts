// src/scenes/base-scene.ts
import Phaser from "phaser";
import { GAME_SETTINGS } from "../settings";
import { EnemyType } from "../entities/enemy/enemy-type";

export abstract class BaseScene extends Phaser.Scene {
    protected setupPhysics(): void {
        this.physics.world.setBounds(
            0,
            0,
            GAME_SETTINGS.map.width * GAME_SETTINGS.map.tileSize,
            GAME_SETTINGS.map.height * GAME_SETTINGS.map.tileSize
        );
        this.physics.world.setBoundsCollision(true, true, true, true);
    }

    protected setupCamera(): void {
        this.cameras.main.setBackgroundColor(0x333333);
    }

    protected loadAssets(): void {
        // Base assets
        this.load.image("player", "assets/player.svg");
        this.load.image("base", "assets/base.svg");
        this.load.image("projectile", "assets/projectile.svg");

        // Load terrain-tiles as an SVG for the tilemap
        this.load.svg("terrain-tiles", "assets/terrain-tiles.svg", { width: 96, height: 96 });

        // Tower assets
        Object.entries(GAME_SETTINGS.towers).forEach(([key, data]) => {
            this.load.image(key, `assets/${(data as any).texture}.svg`);
        });

        // Enemy assets - Fix texture loading to use consistent keys with Enemy class
        Object.values(EnemyType).forEach((type) => {
            this.load.image(`${type}-enemy`, `assets/enemies/${type}-enemy.svg`);
            console.log(`Loaded enemy texture: ${type}-enemy`);
        });

        // Crate assets
        this.load.image('crate-wood', 'assets/crates/wood-crate.svg');
        this.load.image('crate-metal', 'assets/crates/metal-crate.svg');
        this.load.image('crate-gold', 'assets/crates/gold-crate.svg');

        // Power-up assets
        this.load.image('powerup-speed', 'assets/powerups/speed-powerup.svg');
        this.load.image('powerup-damage', 'assets/powerups/damage-powerup.svg');
        this.load.image('powerup-range', 'assets/powerups/range-powerup.svg');
        this.load.image('powerup-health', 'assets/powerups/health-powerup.svg');
        this.load.image('powerup-invincibility', 'assets/powerups/invincibility-powerup.svg');
        this.load.image('powerup-resources', 'assets/powerups/resources-powerup.svg');
        this.load.image('powerup-default', 'assets/powerups/default-powerup.svg');

        // inventory
        this.load.image("inventory-bg", "assets/ui/inventory-bg.svg");
        this.load.image("inventory-slot", "assets/ui/inventory-slot.svg");

        // Items
        this.load.image('resource-small', 'assets/items/resource-small.svg');
        this.load.image('resource-medium', 'assets/items/resource-medium.svg');
        this.load.image('resource-large', 'assets/items/resource-large.svg');
        this.load.image('health-small', 'assets/items/health-small.svg');
        this.load.image('health-medium', 'assets/items/health-medium.svg');
        this.load.image('health-large', 'assets/items/health-large.svg');
        this.load.image('weapon-blaster', 'assets/items/weapon-blaster.svg');
        this.load.image('weapon-rapid', 'assets/items/weapon-rapid.svg');
        this.load.image('weapon-cannon', 'assets/items/weapon-cannon.svg');
        this.load.image('blueprint-normal', 'assets/items/blueprint-normal.svg');
        this.load.image('blueprint-sniper', 'assets/items/blueprint-sniper.svg');
        this.load.image('blueprint-area', 'assets/items/blueprint-area.svg');
        this.load.image('upgrade-tower-damage', 'assets/items/upgrade-tower-damage.svg');
        this.load.image('upgrade-player-speed', 'assets/items/upgrade-player-speed.svg');
        this.load.image('upgrade-base-armor', 'assets/items/upgrade-base-armor.svg');
    }
}