# Tower Defense Game Feature List

## Game UI

- **Main Menu**
  - New Game
  - Load Game

- **In-Game Interface**
  - Start Round Button (initiates enemy spawning)
  - Play/Pause Button
  - Menu Button (exit with confirmation, save game, settings)

- **Build Toolbar**
  - Always visible at the bottom of the screen
  - Displays icons and costs for each tower type
  - Disabled buttons when insufficient funds
  - Supports future items (power-ups, upgrades)

## Gameplay Mechanics

### Build Mode

- Activated when selecting a tower from the toolbar
- Shows a semi-transparent tower following cursor position
- Clicking places the tower permanently on the map

### User Controls

- Movement: WASD keys
- Attack: Spacebar to shoot projectiles
- User heals 20 HP per round

### Entities

- **User:** Movable, attack-capable character
- **Base:** Structure that must be protected; destruction results in game over
- **Towers:**
  - Normal Tower: Single-target attacks
  - Sniper Tower: Long-range, single-target attacks
  - Area Tower: Shoots projectiles outward in multiple directions
  - Upgradeable attributes: Speed, Range, Damage
  - Single-purchase special upgrades: Fire (ongoing damage), Ice (slows enemies), Critical Damage (permanent damage increase)

### Enemies

- Spawn only after initiating rounds
- Priority targeting:
  1. User (if within range)
  2. Towers
  3. Base
- Pathfinding recalculates every second

### Projectiles

- Fired by User, Towers, and certain Enemies
- Limited but significant range (few hundred pixels)

### Resource System

- Kill rewards: 5x current round number per enemy
- Round completion reward: 100x current round number

## Additional Features

- **Player Upgrades:** Speed, damage, attack range, health
- **Enhanced Tower Scaling:** Stronger incremental upgrades
- **Temporary Power-Ups:** Random spawns (e.g., 100% increased attack speed)
- **Decorative Elements:** Static SVG items (bushes, plants) and basic ground textures
- **Tower Statistics:** Kill count and shots fired
- **Research Tree:** Permanent upgrades (damage, range, speed) for towers or tower types
- **Item Progression:**
  - Enemies drop progressively better items (5 tiers of armor, weapons)
  - Tier 1 primitive equipment (archer towers, bows)
- **Enemy Variations:** Diverse abilities and strategies
- **Difficulty Levels:** Easy, Medium, Hard affecting enemy quantity, health, and speed
- **Equippable Items:**
  - SVG-rendered armor, helmets, weapons
  - Items upgradeable for enhanced stats
- **Tile-Based Map System:**
  - Small tiles allowing detailed positioning (4x4 tiles per tower, 4 tiles per armor, 1 tile per helmet)
  - Initial map size: 75x75 tiles
- **Explorable Map:**
  - Player can freely move beyond initial visible bounds
  - Discover hidden or randomly placed items/crates
- **Random Loot Crates:**
  - Breakable crates scattered on the map
  - Contain random loot (items, resources, currency)

This comprehensive feature list serves both as documentation and as a development reference for implementing game mechanics, UI elements, and player interactions.
