/**
 * AssetLoader
 * Handles loading and management of game assets
 * 
 * Most Recent Changes:
 * - Removed direct dependencies on imageMap object
 * - Now using functions from image-map.ts for all image operations
 * - Added better error handling for asset loading failures
 * - Improved console logging for critical texture loading
 */
import Phaser from 'phaser';
import { 
  ImageKey, 
  AvailableSize, 
  AVAILABLE_SIZES, 
  getImagePathForSize,
  getAllImageKeys
} from './image-map';

type ProgressCallback = (value: number) => void;

export class AssetLoader {
  private scene: Phaser.Scene;
  private imageKeys: ImageKey[] = [];
  private selectedSize: AvailableSize;
  
  /**
   * Create a new asset loader
   * @param scene Phaser scene to load assets into
   * @param preferredSize Default image size to use (defaults to 128px)
   */
  constructor(scene: Phaser.Scene, preferredSize: AvailableSize = 128) {
    this.scene = scene;
    this.selectedSize = preferredSize;
    
    // Build list of image keys
    this.buildAssetLists();
  }
  
  /**
   * Build lists of available asset keys
   */
  private buildAssetLists(): void {
    // Get all image keys using the utility function
    this.imageKeys = getAllImageKeys();
  }
  
  /**
   * Set the preferred image size for loading
   * @param size Preferred image size
   */
  public setPreferredSize(size: AvailableSize): void {
    this.selectedSize = size;
  }
  
  /**
   * Get the current preferred image size
   * @returns Current preferred size
   */
  public getPreferredSize(): AvailableSize {
    return this.selectedSize;
  }
  
  /**
   * Determine the best image size based on device capabilities
   * @returns Recommended image size
   */
  public determineOptimalSize(): AvailableSize {
    // Get device pixel ratio and screen size
    const pixelRatio = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    
    // Choose appropriate resolution based on device capabilities
    let optimalSize: AvailableSize = 128; // Default medium size
    
    if (pixelRatio >= 2 && width > 1440) {
      optimalSize = 512; // Ultra
    } else if (pixelRatio >= 1.5 && width > 1080) {
      optimalSize = 256; // High
    } else if (width > 768) {
      optimalSize = 128; // Medium
    } else if (width > 480) {
      optimalSize = 64; // Low
    } else {
      optimalSize = 32; // Very Low
    }
    
    this.selectedSize = optimalSize;
    return optimalSize;
  }
  
  /**
   * Preload all assets
   * @param progressCallback Optional callback to track load progress
   */
  public preloadAll(progressCallback?: ProgressCallback): void {
    // Set up progress tracking
    if (progressCallback) {
      this.scene.load.on('progress', progressCallback);
    }
    
    // Load all images at selected size
    this.preloadAllImages(progressCallback);
  }
  
  /**
   * Preload a specific set of assets by type and keys
   * @param type Asset type ('image')
   * @param keys Array of asset keys to load
   * @param progressCallback Optional callback to track load progress
   */
  public preloadAssetSet(
    type: 'image',
    keys: ImageKey[],
    progressCallback?: ProgressCallback
  ): void {
    // Only support image type now
    if (type === 'image') {
      this.preloadSpecificImages(keys, progressCallback);
    }
  }
  
  /**
   * Preload all images at the selected size
   * @param progressCallback Optional callback to track load progress
   */
  public preloadAllImages(progressCallback?: ProgressCallback): void {
    // Set up progress tracking
    if (progressCallback) {
      this.scene.load.on('progress', progressCallback);
    }
    
    console.log(`[AssetLoader] Loading ${this.imageKeys.length} images at size: ${this.selectedSize}px`);
    
    // First check if any critical textures are already loaded
    const existingTextureKeys = this.scene.textures.getTextureKeys();
    console.log(`[AssetLoader] Existing textures: ${existingTextureKeys.join(', ')}`);
    
    // Check if important entity textures are already loaded
    const criticalTextures = ['base', 'normal-tower', 'basic-enemy', 'player'];
    criticalTextures.forEach(key => {
      if (this.scene.textures.exists(key)) {
        console.log(`[AssetLoader] Critical texture already loaded: ${key}`);
      } else {
        console.log(`[AssetLoader] Critical texture not loaded yet: ${key}`);
      }
    });
    
    // Load all images at selected size with error handling
    this.imageKeys.forEach(key => {
      try {
        const success = this.loadImageAtSize(key, this.selectedSize);
        if (!success) {
          console.warn(`[AssetLoader] Failed initial load for: ${key}`);
        }
      } catch (error) {
        console.error(`[AssetLoader] Error loading ${key}:`, error);
        
        // If the first attempt fails, try the fallback approach
        try {
          // Try with a smaller size as fallback
          const fallbackSize = 64 as AvailableSize;
          console.log(`[AssetLoader] Trying fallback size ${fallbackSize}px for ${key}`);
          this.loadImageAtSize(key, fallbackSize);
        } catch (fallbackError) {
          console.error(`[AssetLoader] Fallback also failed for ${key}:`, fallbackError);
        }
      }
    });
  }
  
  /**
   * Preload specific images at the selected size
   * @param keys Array of image keys to load
   * @param progressCallback Optional callback to track load progress
   */
  public preloadSpecificImages(keys: ImageKey[], progressCallback?: ProgressCallback): void {
    // Set up progress tracking
    if (progressCallback) {
      this.scene.load.on('progress', progressCallback);
    }
    
    // Load specified images at selected size
    keys.forEach(key => {
      this.loadImageAtSize(key, this.selectedSize);
    });
  }
  
  /**
   * Load an image at a specific size
   * @param key Image key
   * @param size Desired size
   * @returns Whether the image was loaded
   */
  private loadImageAtSize(key: ImageKey, size: AvailableSize): boolean {
    const path = getImagePathForSize(key, size);
    
    if (!path) {
      console.warn(`[AssetLoader] Failed to load image: ${key} at size ${size}px - path construction failed`);
      
      // Try to find the closest available size
      const closestSize = this.findClosestSize(key, size);
      if (closestSize && closestSize !== size) {
        console.log(`[AssetLoader] Trying fallback size: ${closestSize}px for ${key}`);
        return this.loadImageAtSize(key, closestSize);
      }
      
      return false;
    }
    
    // For critical textures, log more details
    const criticalTextures = ['base', 'normal-tower', 'basic-enemy', 'player'];
    if (criticalTextures.includes(key)) {
      console.log(`[AssetLoader] Loading CRITICAL image: ${key} from path: ${path}`);
      
      // Create a fake Image element to test if the file actually exists
      const img = new Image();
      img.onerror = () => {
        console.error(`[AssetLoader] ERROR: Critical image file not found at: ${path}`);
        console.error(`[AssetLoader] Please ensure the file exists at this location.`);
        
        // Log helpful information about where the file should be
        console.info(`[AssetLoader] This image should be located at:`);
        console.info(`[AssetLoader] public${path}`);
      };
      img.src = path;
    } else {
      console.log(`[AssetLoader] Loading image: ${key} from path: ${path}`);
    }
    
    // Setup event listeners for debugging
    this.scene.load.once(`filecomplete-image-${key}`, () => {
      console.log(`[AssetLoader] Successfully loaded image: ${key} at size ${size}px`);
    });
    
    this.scene.load.once(`fileerror-image-${key}`, () => {
      console.error(`[AssetLoader] Failed to load image: ${key} at size ${size}px with path: ${path}`);
      
      // Provide more details for troubleshooting
      console.info(`[AssetLoader] Expected file location: public${path}`);
      
      if (criticalTextures.includes(key)) {
        console.error(`[AssetLoader] This is a CRITICAL texture for the game to function properly.`);
        console.info(`[AssetLoader] Recommended fixes:`);
        console.info(`[AssetLoader] 1. Check if the file exists at the correct location`);
        console.info(`[AssetLoader] 2. Verify the file has the correct name (case-sensitive)`);
        console.info(`[AssetLoader] 3. Ensure the image path is correctly configured for this asset`);
      }
    });
    
    // Load the image with the constructed path
    this.scene.load.image(key, path);
    return true;
  }
  
  /**
   * Find the closest available size for an image
   * @param key Image key
   * @param targetSize Target size
   * @returns Closest available size or undefined if none found
   */
  private findClosestSize(key: ImageKey, targetSize: AvailableSize): AvailableSize | undefined {
    // Create an array of sizes that have a valid path for this image
    const validSizes = AVAILABLE_SIZES.filter(size => getImagePathForSize(key, size) !== undefined);
    
    if (validSizes.length === 0) {
      return undefined;
    }
    
    // Sort sizes by their distance from the target size
    validSizes.sort((a, b) => {
      return Math.abs(a - targetSize) - Math.abs(b - targetSize);
    });
    
    // Return the closest size
    return validSizes[0];
  }
  
  /**
   * Check if all assets are loaded
   * @returns Whether all assets are loaded
   */
  public areAssetsLoaded(): boolean {
    return this.scene.load.isReady();
  }
  
  /**
   * Get all available image keys
   * @returns Array of image keys
   */
  public getImageKeys(): ImageKey[] {
    return [...this.imageKeys];
  }
} 