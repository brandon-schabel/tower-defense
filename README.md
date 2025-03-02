# Tower Defense Game

A Phaser 3 based tower defense game with TypeScript.

## Project Architecture

The game follows a modular architecture for maintainability and extensibility:

```
/src
  /scenes                 # Phaser scenes for different game states
  /entities               # Game objects like towers, enemies, etc.
  /managers               # Systems that coordinate game elements
  /states                 # State machine implementation for entities
  /ui                     # UI components and HUD elements
  /utils                  # Helper functions and utilities
  /config                 # Game constants and configurations
  main.ts                 # Entry point
```

## Key Components

### Scenes

- **PreloadScene**: Handles asset loading and displays a loading bar
- **MenuScene**: Displays the main menu, settings, and start game options
- **GameScene**: Main gameplay scene with tower defense mechanics
- **UIScene**: Overlays the GameScene with UI elements and controls

### Core Systems

- **Entity System**: Base entity class for all game objects
- **State Machine**: Flexible state management for entity behavior
- **Resolution Handling**: Adaptive asset loading based on device capabilities

## Development Setup

### Prerequisites

- Node.js (v14+)
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/tower-defense-game.git

# Navigate to project directory
cd tower-defense-game

# Install dependencies
npm install
# or
yarn install
```

### Running the Development Server

```bash
# Start development server
npm run dev
# or
yarn dev
```

The game will be available at http://localhost:5173 (or similar port).

## Game Design

### Tower Types

- **Normal Tower**: Balanced damage and range
- **Sniper Tower**: Long range, high damage, slow fire rate
- **Area Tower**: Short range, splash damage

### Enemy Types

- **Basic Enemy**: Average speed and health
- **Fast Enemy**: Quick movement but fragile
- **Strong Enemy**: Slow but tough to defeat
- **Flying Enemy**: Can bypass ground obstacles
- **Boss Enemy**: Very tough with high health

### Gameplay Mechanics

- Place towers at strategic positions on the map
- Towers automatically target and attack enemies
- Defend your base against waves of enemies
- Earn resources by defeating enemies
- Upgrade towers to improve their capabilities
- Difficulty increases with each wave

## License

MIT License
