/**
 * Sound Map
 * Centralized configuration of all game sounds
 */

// Interface for sound assets
export interface SoundAsset {
  path: string;
  description?: string;
  volume?: number;
  loop?: boolean;
}

// Map of all sound assets in the game
export const SOUND_MAP: Record<string, SoundAsset> = {
  // UI sounds
  'button-click': {
    path: 'assets/sounds/ui/button-click.mp3',
    description: 'Button click sound effect',
    volume: 0.5
  },
  'button-hover': {
    path: 'assets/sounds/ui/button-hover.mp3',
    description: 'Button hover sound effect',
    volume: 0.3
  },
  'menu-open': {
    path: 'assets/sounds/ui/menu-open.mp3',
    description: 'Menu opening sound effect',
    volume: 0.5
  },
  'menu-close': {
    path: 'assets/sounds/ui/menu-close.mp3',
    description: 'Menu closing sound effect',
    volume: 0.5
  },
  
  // Tower sounds
  'tower-place': {
    path: 'assets/sounds/towers/tower-place.mp3',
    description: 'Tower placement sound effect',
    volume: 0.6
  },
  'tower-upgrade': {
    path: 'assets/sounds/towers/tower-upgrade.mp3',
    description: 'Tower upgrade sound effect',
    volume: 0.6
  },
  'tower-sell': {
    path: 'assets/sounds/towers/tower-sell.mp3',
    description: 'Tower sell sound effect',
    volume: 0.6
  },
  'tower-basic-attack': {
    path: 'assets/sounds/towers/tower-basic-attack.mp3',
    description: 'Basic tower attack sound effect',
    volume: 0.4
  },
  'tower-sniper-attack': {
    path: 'assets/sounds/towers/tower-sniper-attack.mp3',
    description: 'Sniper tower attack sound effect',
    volume: 0.5
  },
  'tower-splash-attack': {
    path: 'assets/sounds/towers/tower-splash-attack.mp3',
    description: 'Splash tower attack sound effect',
    volume: 0.5
  },
  'tower-slow-attack': {
    path: 'assets/sounds/towers/tower-slow-attack.mp3',
    description: 'Slow tower attack sound effect',
    volume: 0.4
  },
  
  // Enemy sounds
  'enemy-hit': {
    path: 'assets/sounds/enemies/enemy-hit.mp3',
    description: 'Enemy hit sound effect',
    volume: 0.4
  },
  'enemy-death': {
    path: 'assets/sounds/enemies/enemy-death.mp3',
    description: 'Enemy death sound effect',
    volume: 0.5
  },
  'enemy-reach-end': {
    path: 'assets/sounds/enemies/enemy-reach-end.mp3',
    description: 'Enemy reaching end of path sound effect',
    volume: 0.6
  },
  'enemy-boss-spawn': {
    path: 'assets/sounds/enemies/enemy-boss-spawn.mp3',
    description: 'Boss enemy spawn sound effect',
    volume: 0.7
  },
  
  // Game state sounds
  'wave-start': {
    path: 'assets/sounds/game/wave-start.mp3',
    description: 'Wave start sound effect',
    volume: 0.6
  },
  'wave-complete': {
    path: 'assets/sounds/game/wave-complete.mp3',
    description: 'Wave complete sound effect',
    volume: 0.6
  },
  'game-over': {
    path: 'assets/sounds/game/game-over.mp3',
    description: 'Game over sound effect',
    volume: 0.7
  },
  'victory': {
    path: 'assets/sounds/game/victory.mp3',
    description: 'Victory sound effect',
    volume: 0.7
  },
  'not-enough-gold': {
    path: 'assets/sounds/game/not-enough-gold.mp3',
    description: 'Not enough gold sound effect',
    volume: 0.5
  },
  
  // Music
  'menu-music': {
    path: 'assets/music/menu-music.mp3',
    description: 'Menu background music',
    volume: 0.4,
    loop: true
  },
  'game-music': {
    path: 'assets/music/game-music.mp3',
    description: 'Main game background music',
    volume: 0.4,
    loop: true
  },
  'game-music-intense': {
    path: 'assets/music/game-music-intense.mp3',
    description: 'Intense game background music for later waves',
    volume: 0.4,
    loop: true
  },
  'victory-music': {
    path: 'assets/music/victory-music.mp3',
    description: 'Victory music',
    volume: 0.5,
    loop: false
  },
  'defeat-music': {
    path: 'assets/music/defeat-music.mp3',
    description: 'Defeat music',
    volume: 0.5,
    loop: false
  },
  
  // Game sounds
  'place-tower': {
    path: 'assets/sounds/game/place-tower.mp3',
    description: 'Tower placement sound',
    volume: 0.6
  }
};

export default SOUND_MAP; 