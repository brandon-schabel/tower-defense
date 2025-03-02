/**
 * Auto-generated map of converted SVG images
 * Generated on: 2025-03-01T23:30:54.671Z
 * 
 * Most Recent Changes:
 * - Added getAllImageKeys utility function to return all available image keys
 * - Improved getImagePathForSize to provide better encapsulation
 */

export interface ImageMeta {
    name: string;
    relativePath: string; // Path to the directory where the PNG files are stored
}

// Available sizes for all images
export const AVAILABLE_SIZES = [16,32,64,128,256,512,1024,2048] as const;
export type AvailableSize = typeof AVAILABLE_SIZES[number];

export const imageMap = {
  "inventory-bg": {
    "name": "inventory-bg",
    "relativePath": "ui"
  },
  "inventory-slot": {
    "name": "inventory-slot",
    "relativePath": "ui"
  },
  "gold-crate": {
    "name": "gold-crate",
    "relativePath": "crates"
  },
  "metal-crate": {
    "name": "metal-crate",
    "relativePath": "crates"
  },
  "wood-crate": {
    "name": "wood-crate",
    "relativePath": "crates"
  },
  "terrain-tiles": {
    "name": "terrain-tiles",
    "relativePath": "."
  },
  "bush": {
    "name": "bush",
    "relativePath": "decorations"
  },
  "tree": {
    "name": "tree",
    "relativePath": "decorations"
  },
  "player": {
    "name": "player",
    "relativePath": "."
  },
  "speed-powerup": {
    "name": "speed-powerup",
    "relativePath": "powerups"
  },
  "range-powerup": {
    "name": "range-powerup",
    "relativePath": "powerups"
  },
  "damage-powerup": {
    "name": "damage-powerup",
    "relativePath": "powerups"
  },
  "resources-powerup": {
    "name": "resources-powerup",
    "relativePath": "powerups"
  },
  "health-powerup": {
    "name": "health-powerup",
    "relativePath": "powerups"
  },
  "default-powerup": {
    "name": "default-powerup",
    "relativePath": "powerups"
  },
  "invincibility-powerup": {
    "name": "invincibility-powerup",
    "relativePath": "powerups"
  },
  "laser-tower": {
    "name": "laser-tower",
    "relativePath": "towers"
  },
  "normal-tower": {
    "name": "normal-tower",
    "relativePath": "towers"
  },
  "sniper-tower": {
    "name": "sniper-tower",
    "relativePath": "towers"
  },
  "area-tower": {
    "name": "area-tower",
    "relativePath": "towers"
  },
  "missile-tower": {
    "name": "missile-tower",
    "relativePath": "towers"
  },
  "base": {
    "name": "base",
    "relativePath": "."
  },
  "upgrade-base-armor": {
    "name": "upgrade-base-armor",
    "relativePath": "items"
  },
  "blueprint-normal": {
    "name": "blueprint-normal",
    "relativePath": "items"
  },
  "weapon-blaster": {
    "name": "weapon-blaster",
    "relativePath": "items"
  },
  "health-medium": {
    "name": "health-medium",
    "relativePath": "items"
  },
  "upgrade-player-speed": {
    "name": "upgrade-player-speed",
    "relativePath": "items"
  },
  "blueprint-area": {
    "name": "blueprint-area",
    "relativePath": "items"
  },
  "blueprint-sniper": {
    "name": "blueprint-sniper",
    "relativePath": "items"
  },
  "resource-medium": {
    "name": "resource-medium",
    "relativePath": "items"
  },
  "upgrade-tower-damage": {
    "name": "upgrade-tower-damage",
    "relativePath": "items"
  },
  "resource-small": {
    "name": "resource-small",
    "relativePath": "items"
  },
  "health-large": {
    "name": "health-large",
    "relativePath": "items"
  },
  "health-small": {
    "name": "health-small",
    "relativePath": "items"
  },
  "resource-large": {
    "name": "resource-large",
    "relativePath": "items"
  },
  "weapon-cannon": {
    "name": "weapon-cannon",
    "relativePath": "items"
  },
  "weapon-rapid": {
    "name": "weapon-rapid",
    "relativePath": "items"
  },
  "projectile": {
    "name": "projectile",
    "relativePath": "."
  },
  "flying-enemy": {
    "name": "flying-enemy",
    "relativePath": "enemies"
  },
  "fast-enemy": {
    "name": "fast-enemy",
    "relativePath": "enemies"
  },
  "boss-enemy": {
    "name": "boss-enemy",
    "relativePath": "enemies"
  },
  "normal-enemy": {
    "name": "normal-enemy",
    "relativePath": "enemies"
  },
  "strong-enemy": {
    "name": "strong-enemy",
    "relativePath": "enemies"
  },
  "tank-enemy": {
    "name": "tank-enemy",
    "relativePath": "enemies"
  },
  "heavy-enemy": {
    "name": "heavy-enemy",
    "relativePath": "enemies"
  },
  "basic-enemy": {
    "name": "basic-enemy",
    "relativePath": "enemies"
  }
} satisfies Record<string, ImageMeta>;

// Define a type that represents all valid image keys
export type ImageKey = keyof typeof imageMap;

/**
 * Get all available image keys
 * @returns Array of all available image keys
 */
export function getAllImageKeys(): ImageKey[] {
  return Object.keys(imageMap) as ImageKey[];
}

/**
 * Utility function to get the path for a specific image size
 * @param imageKey - The key/name of the image in the map
 * @param size - The desired size
 * @returns The path to the image of the specified size, or undefined if not available
 */
export function getImagePathForSize(imageKey: ImageKey, size: AvailableSize): string | undefined {
    const imageInfo = imageMap[imageKey];
    if (!imageInfo || !AVAILABLE_SIZES.includes(size)) {
        console.error(`Invalid image key or size: ${imageKey}, ${size}`);
        return undefined;
    }
    
    // Construct the path based on the naming pattern
    let imagePath;
    if (imageInfo.relativePath === '.') {
        // For files directly in the root pngs directory
        imagePath = `/assets/pngs/${imageInfo.name}_${size}x${size}.png`;
    } else {
        // For files in subdirectories
        imagePath = `/assets/pngs/${imageInfo.relativePath}/${imageInfo.name}_${size}x${size}.png`;
    }
    
    // Log the path we're trying to use
    console.log(`Constructed path for ${imageKey}: ${imagePath}`);
    
    return imagePath;
}

