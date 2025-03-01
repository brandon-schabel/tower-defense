import Phaser from "phaser";
import { GameScene } from "../scenes/game-scene";
import { TileMapManager } from "../managers/tile-map-manager";

export class MapDecorator {
    private scene: GameScene;
    private tileMapManager: TileMapManager;

    constructor(scene: GameScene, tileMapManager: TileMapManager) {
        this.scene = scene;
        this.tileMapManager = tileMapManager;
    }

    decorateMap() {
        this.addTrees();
        this.addBushes();
        this.addRocks();
        this.addBackgroundVariations();
    }

    private addTrees() {
        const treeCount = Math.floor(this.tileMapManager.getMapWidth() * this.tileMapManager.getMapHeight() * 0.0005);

        for (let i = 0; i < treeCount; i++) {
            const pos = this.tileMapManager.findValidPlacement(2, 2); // Trees are 2x2 tiles

            if (pos) {
                const worldPos = this.tileMapManager.tileToWorld(pos.tileX, pos.tileY);
                const treeType = Phaser.Math.RND.pick(['tree1', 'tree2', 'tree3']);

                const tree = this.scene.add.image(worldPos.x, worldPos.y, treeType);
                tree.setDepth(worldPos.y); // For proper layering

                // Mark tiles as occupied
                this.tileMapManager.occupyTiles(
                    pos.tileX, pos.tileY, 2, 2, 'decoration', `tree_${i}`
                );
            }
        }
    }

    private addBushes() {
        const bushCount = Math.floor(this.tileMapManager.getMapWidth() * this.tileMapManager.getMapHeight() * 0.001);

        for (let i = 0; i < bushCount; i++) {
            const pos = this.tileMapManager.findValidPlacement(1, 1); // Bushes are 1x1 tiles

            if (pos) {
                const worldPos = this.tileMapManager.tileToWorld(pos.tileX, pos.tileY);
                const bushType = Phaser.Math.RND.pick(['bush1', 'bush2']);

                const bush = this.scene.add.image(worldPos.x, worldPos.y, bushType);
                bush.setDepth(worldPos.y);

                // Mark tile as occupied
                this.tileMapManager.occupyTiles(
                    pos.tileX, pos.tileY, 1, 1, 'decoration', `bush_${i}`
                );
            }
        }
    }

    private addRocks() {
        const rockCount = Math.floor(this.tileMapManager.getMapWidth() * this.tileMapManager.getMapHeight() * 0.0008);

        for (let i = 0; i < rockCount; i++) {
            const pos = this.tileMapManager.findValidPlacement(1, 1);

            if (pos) {
                const worldPos = this.tileMapManager.tileToWorld(pos.tileX, pos.tileY);
                const rockType = Phaser.Math.RND.pick(['rock1', 'rock2', 'rock3']);

                const rock = this.scene.add.image(worldPos.x, worldPos.y, rockType);
                rock.setDepth(worldPos.y);

                this.tileMapManager.occupyTiles(
                    pos.tileX, pos.tileY, 1, 1, 'decoration', `rock_${i}`
                );
            }
        }
    }

    private addBackgroundVariations() {
        // Add some visual variation to the ground tiles
        // We'll work directly with the scene instead of trying to get the tilemap

        for (let y = 0; y < this.tileMapManager.getMapHeight(); y++) {
            for (let x = 0; x < this.tileMapManager.getMapWidth(); x++) {
                // Skip if tile is occupied
                if (!this.tileMapManager.isTileAvailable(x, y, 1, 1)) continue;

                // 10% chance to add a ground variation
                if (Phaser.Math.RND.frac() < 0.1) {
                    // Just add a decorative sprite instead of modifying the tilemap
                    const worldPos = this.tileMapManager.tileToWorld(x, y);
                    const variationType = Phaser.Math.RND.pick(['grass-var1', 'grass-var2', 'grass-var3']);
                    this.scene.add.image(worldPos.x, worldPos.y, variationType).setDepth(0);
                }
            }
        }
    }
}