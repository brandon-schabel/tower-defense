# Tower Defense Features

## UI  
When the game loads, the main menu should be displayed with options to start a new game or load an existing one. Once the game begins, the player can start building towers to defend their base, with no enemies present initially. When the player clicks the "Start Round" button, enemies will begin to spawn. These enemies will first target the player's towers and will recalculate their paths every second. This allows them to select a new target if their current one (such as a tower) is destroyed. The round ends when all enemies are eliminated, at which point a "Next Round" button appears to initiate the following round.

## UI Build Toolbar  
A build toolbar should always be visible at the bottom of the screen. This toolbar will display icons for each tower along with their prices. If the player lacks sufficient funds to build a tower, the corresponding button should be disabled. When the player clicks a tower icon, the game enters build mode, showing a semi-transparent version of the tower that follows the mouse cursor. The tower is placed at the location of the subsequent click. Design the toolbar with flexibility in mind so it can be reused for other functions besides tower building.

## Build Mode  
Upon selecting a tower, the game enters build mode. A semi-transparent version of the selected tower follows the mouse cursor to indicate the potential placement. When the player clicks, the tower is built at that location.

## Entities  
The game includes several entities:
- **Player:** The user-controlled character.
- **Base:** The structure that must be protected.
- **Towers:** Various types of towers with unique abilities that the player can build.
- **Enemies:** Entities that attack the towers, player, and base.
- **Projectiles:** Fired by towers, the player, and possibly enemies.

If the player dies or the base is destroyed, the game is over. The game is built using Vite, and SVGs created for the game are loaded via Vite.

## Enemies  
Enemy targeting is determined by several factors:
- If the player is within a specific radius, enemies will target the player.
- If the player is not in range, enemies will always prioritize attacking towers.
- Once all towers are destroyed, enemies will focus on the base.

## Player  
The player can move using the WASD keys and shoot projectiles by pressing or holding the spacebar. Both the player and towers have a limited range, though it should be substantial enough (e.g., the player should be able to hit an enemy a couple hundred pixels away). Additionally, the player should gradually recover health each round (e.g., healing 20 health points per round).

## Towers  
There are three types of towers:
- **Normal Tower:** Targets specific enemies.
- **Sniper Tower:** Targets specific enemies, typically with longer range.
- **Area Tower:** Fires multiple projectiles outward in all directions.

**New Feature:** Each tower should have upgradeable attributes, including speed, range, and damage. In addition, each tower should have a one-time upgradeable special power. The special upgrades include:
- **Fire Upgrade:** Ignites enemies, causing continuous damage.
- **Ice Upgrade:** Slows down enemies.
- **Critical Damage Upgrade:** Permanently increases the tower's damage.

## Resources  
When an enemy is killed, the player earns a reward equal to 5 times the current round number per enemy. At the end of each round, the player receives a bonus equal to 100 times the current round number.

---