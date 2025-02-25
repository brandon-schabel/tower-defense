import Phaser from "phaser";
import GameScene from "../scenes/game-scene";
import { HealthBar } from "../utils/health-bar";
import { GameItem } from "../types/item";

export enum CrateType {
    Wood = 'wood',
    Metal = 'metal',
    Gold = 'gold'
}

export interface CrateContents {
    resources?: number;
    items?: GameItem[];
}

export default class Crate extends Phaser.Physics.Arcade.Sprite {
    private health: number;
    private maxHealth: number;
    private healthBar: HealthBar;
    private crateType: CrateType;
    private contents: CrateContents;
    private tileX: number;
    private tileY: number;
    private broken: boolean = false;

    constructor(
        scene: GameScene, 
        tileX: number, 
        tileY: number, 
        type: CrateType = CrateType.Wood,
        health: number = 50,
        contents: CrateContents = { resources: 50 }
    ) {
        // Get world position from tiles
        const tileMapManager = scene.getTileMapManager();
        const worldPos = tileMapManager.tileToWorld(tileX, tileY);

        super(scene, worldPos.x, worldPos.y, `crate-${type}`);
        
        this.crateType = type;
        this.maxHealth = health;
        this.health = health;
        this.contents = contents;
        this.tileX = tileX;
        this.tileY = tileY;

        scene.add.existing(this);
        scene.physics.add.existing(this, true); // true = static body
        
        // Mark tile as occupied
        tileMapManager.occupyTiles(tileX, tileY, 1, 1, 'crate', `crate_${tileX}_${tileY}`);
        
        // Set appearance based on type
        this.setOrigin(0.5, 0.5);
        this.setScale(0.5);
        
        switch (type) {
            case CrateType.Metal:
                this.setTint(0x888888); // Gray tint for metal
                break;
            case CrateType.Gold:
                this.setTint(0xFFD700); // Gold tint
                break;
            // Wood crate has default appearance
        }
        
        // Make crate clickable/interactive
        this.setInteractive();
        
        // Health bar
        this.healthBar = new HealthBar(scene, this, this.maxHealth);
    }
    
    /**
     * Damage the crate. If health reaches 0, the crate breaks and drops its contents.
     */
    takeDamage(damage: number): void {
        if (this.broken) return;
        
        this.health -= damage;
        this.healthBar.updateHealth(this.health);
        
        // Visual feedback
        this.scene.tweens.add({
            targets: this,
            alpha: 0.6,
            duration: 100,
            yoyo: true
        });
        
        if (this.health <= 0) {
            this.breakCrate();
        }
    }
    
    /**
     * Break the crate and drop its contents
     */
    private breakCrate(): void {
        if (this.broken) return;
        this.broken = true;
        
        const gameScene = this.scene as GameScene;
        
        // Drop resources if any
        if (this.contents.resources) {
            gameScene.getGameState().earnResources(this.contents.resources);
            
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
            const itemDropManager = gameScene.getItemDropManager();
            
            this.contents.items.forEach(item => {
                itemDropManager.dropItem(item, this.x, this.y);
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
        const tileMapManager = (this.scene as GameScene).getTileMapManager();
        tileMapManager.releaseTiles(this.tileX, this.tileY, 1, 1);
        
        // Clean up and destroy
        this.healthBar.cleanup();
        this.destroy();
    }
    
    // Method to force-break the crate (e.g., from a special weapon or ability)
    forceBreak(): void {
        this.health = 0;
        this.breakCrate();
    }
} 