/**
 * TextureLoader
 * Provides type-safe texture loading and management for game entities
 * Guarantees that only valid texture keys from the image map are used
 * 
 * Most Recent Changes:
 * - Initial implementation with type-safe texture loading
 * - Added utility functions for common texture operations
 * - Added scale calculation for consistent sizing
 */

import Phaser from 'phaser';
import { ImageKey } from './asset-loader/image-map';

/**
 * Represents texture loading options
 */
export interface TextureLoadOptions {
  key: ImageKey;
  frame?: string | number;
  desiredSize?: number; // The desired size in pixels
}

/**
 * Result of a texture loading operation
 */
export interface TextureResult {
  key: ImageKey;
  frame?: string | number;
  scale: number;
  width: number;
  height: number;
}

/**
 * Type-safe texture loader for game entities
 * Ensures only valid texture keys from the image map are used
 */
export class TextureLoader {
  /**
   * Get a texture with appropriate scaling based on desired size
   * @param scene The Phaser scene
   * @param options Texture loading options
   * @returns Information about the loaded texture
   */
  public static getTexture(scene: Phaser.Scene, options: TextureLoadOptions): TextureResult {
    const { key, frame, desiredSize = 32 } = options;

    // Verify the texture exists
    if (!scene.textures.exists(key)) {
      console.warn(`TextureLoader: Texture "${key}" does not exist, using fallback`);
      return this.getFallbackTexture(scene, desiredSize);
    }

    // Get texture dimensions
    const texture = scene.textures.get(key);
    const source = texture.source[0];
    const loadedWidth = source.width;
    const loadedHeight = source.height;

    // Calculate scale factor
    const scale = desiredSize / Math.max(loadedWidth, loadedHeight);

    return {
      key,
      frame,
      scale,
      width: loadedWidth,
      height: loadedHeight
    };
  }

  /**
   * Apply a texture to an entity with appropriate scaling
   * @param entity The entity to apply the texture to
   * @param scene The Phaser scene
   * @param options Texture loading options
   */
  public static applyTexture(
    entity: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
    scene: Phaser.Scene,
    options: TextureLoadOptions
  ): TextureResult {
    const result = this.getTexture(scene, options);
    
    // Set the texture
    entity.setTexture(result.key, result.frame);
    
    // Apply scaling
    entity.setScale(result.scale);
    
    return result;
  }

  /**
   * Get a fallback texture when the requested one doesn't exist
   * @param scene The Phaser scene
   * @param desiredSize The desired size in pixels
   * @returns Information about the fallback texture
   */
  private static getFallbackTexture(scene: Phaser.Scene, desiredSize: number): TextureResult {
    // Create a simple colored square as fallback
    const fallbackKey = `fallback-${desiredSize}`;
    
    if (!scene.textures.exists(fallbackKey)) {
      const graphics = scene.add.graphics();
      graphics.fillStyle(0xff00ff, 1); // Purple for visibility
      graphics.fillRect(0, 0, desiredSize, desiredSize);
      graphics.generateTexture(fallbackKey, desiredSize, desiredSize);
      graphics.destroy();
    }
    
    return {
      key: 'terrain-tiles' as ImageKey, // Use a known image key as type hack
      scale: 1,
      width: desiredSize,
      height: desiredSize
    };
  }
} 