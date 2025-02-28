import Phaser from "phaser";
import GameScene from "../../scenes/game-scene";
import { HealthBar } from "../../utils/health-bar";
import { GameItem } from "../../types/item";
import Player from "../player/player";
import { HealthComponent } from "../components/health-component";
import { CrateType, CrateContents } from "../../types/crate-types";
import TileMapManager from "../../managers/tile-map-manager";
import ItemDropManager from "../../managers/item-drop-manager";
import GameState from "../../utils/game-state";
import { EventBus } from "../../core/event-bus";


export default class Crate extends Phaser.Physics.Arcade.Sprite {
    private healthComponent: HealthComponent;
    private maxHealth: number;
    private healthBar: HealthBar;
    private crateType: CrateType;
    private contents: CrateContents;
    private tileX: number;
    private tileY: number;
    private broken: boolean = false;
    private eventBus: EventBus;
    private tileMapManager: TileMapManager;
    private itemDropManager: ItemDropManager;
    private gameState: GameState;

    constructor(
        scene: GameScene,
        tileX: number,
        tileY: number,
        type: CrateType,
        tileMapManager: TileMapManager,
        eventBus: EventBus,
        itemDropManager: ItemDropManager,
        gameState: GameState,
        health: number = 50,
        contents: CrateContents = { resources: 50 }
    ) {
        const worldPos = tileMapManager.tileToWorld(tileX, tileY);

        super(scene, worldPos.x, worldPos.y, `crate-${type}`);

        this.crateType = type;
        this.maxHealth = health;
        this.healthComponent = new HealthComponent(
            this,
            scene,
            health,
            health,
            () => this.breakCrate()
        );
        this.contents = contents;
        this.tileX = tileX;
        this.tileY = tileY;
        this.eventBus = eventBus;
        this.tileMapManager = tileMapManager;
        this.itemDropManager = itemDropManager;
        this.gameState = gameState;

        scene.add.existing(this);
        scene.physics.add.existing(this, true); // true = static body

        tileMapManager.occupyTiles(tileX, tileY, 1, 1, 'crate', `crate_${tileX}_${tileY}`);

        this.setOrigin(0.5, 0.5);
        this.setScale(0.5);

        switch (type) {
            case CrateType.Metal:
                this.setTint(0x888888);
                break;
            case CrateType.Gold:
                this.setTint(0xFFD700);
                break;
            // Wood crate has default appearance
        }

        this.setInteractive();

        this.healthBar = new HealthBar(scene, this, this.maxHealth);

        this.on('pointerdown', this.handleCrateClick, this);
    }

    private handleCrateClick() {
        this.breakCrate();
    }

    /**
     * Damage the crate. If health reaches 0, the crate breaks and drops its contents.
     */
    public takeDamage(damage: number): void {
        if (this.broken) return;

        this.healthComponent.takeDamage(damage);

        // Visual feedback
        this.scene.tweens.add({
            targets: this,
            alpha: 0.6,
            duration: 100,
            yoyo: true
        });

        if (this.healthComponent.getHealth() <= 0) {
            this.breakCrate();
        }
    }

    /**
     * Break the crate and drop its contents
     */
    private breakCrate(): void {
        if (this.broken) return;
        this.broken = true;

        // Drop resources if any
        if (this.contents.resources) {
            this.gameState.earnResources(this.contents.resources);

            // Show floating text for resources
            const resourceText = this.scene.add.text(
                this.x,
                this.y - 20,
                `+${this.contents.resources}`,
                { fontSize: '16px', color: '#ffff00' }
            );

            this.scene.tweens.add({
                targets: resourceText,
                y: this.y - 50,
                alpha: 0,
                duration: 1500,
                onComplete: () => resourceText.destroy()
            });
        }

        // Drop items if any
        if (this.contents.items && this.contents.items.length > 0) {
            this.contents.items.forEach((item: GameItem) => {
                this.itemDropManager.dropItem(item, this.x, this.y);
            });
        }

        // Visual break effect
        const particles = this.scene.add.particles(this.x, this.y, 'projectile', {
            speed: { min: 50, max: 150 },
            angle: { min: 0, max: 360 },
            scale: { start: 0.5, end: 0 },
            blendMode: 'ADD',
            lifespan: 1000,
            quantity: 20
        });

        this.scene.time.delayedCall(1000, () => {
            particles.destroy();
        });

        // Free up the tile
        this.tileMapManager.releaseTiles(this.tileX, this.tileY, 1, 1);
        
        // Emit event
        this.eventBus.emit('crate-broken', {
            position: { x: this.x, y: this.y },
            type: this.crateType,
            contents: this.contents
        });

        // Clean up and destroy
        this.healthBar.cleanup();
        this.destroy();
    }

    // Method to force-break the crate (e.g., from a special weapon or ability)
    public forceBreak(): void {
        this.healthComponent.takeDamage(this.healthComponent.getHealth());
        this.breakCrate();
    }

    public openCrate(player: Player): void {
        this.breakCrate();
    }

    destroy(fromScene?: boolean): void {
        this.healthComponent.cleanup();
        super.destroy(fromScene);
    }
} 