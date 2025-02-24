# Tower Defense Game

A Phaser 3 tower defense game built with TypeScript and Vite, featuring dynamic rounds, build/combat phases, multiple tower types, upgradable defenses, and straightforward saving/loading logic. This project is designed to be modular and easy to extend—all while staying light on dependencies.

## Table of Contents

- [Introduction](#introduction)
- [Features](#features)
- [Installation](#installation)
  - [Using Bun (Recommended)](#using-bun-recommended)
- [Usage](#usage)
  - [Development Server](#development-server)
  - [Build for Production](#build-for-production)
  - [Testing](#testing)
  - [Deploying to GitHub Pages](#deploying-to-github-pages)
- [Project Structure](#project-structure)
- [Key Scripts](#key-scripts)
- [Contributing](#contributing)
- [License](#license)

## Introduction

This repository is an example tower defense game using:
 • Phaser 3 for game rendering and physics.
 • TypeScript for static typing.
 • Vite for fast development and production builds.

It's open source, minimal in dependencies, and designed to be easy to extend with custom entities, towers, and game logic.

## Features

• Multiple Tower Types:

- Normal
- Sniper
- Area-of-Effect
• Upgrades & Special Powers: Increase speed, range, or damage, or add "fire", "ice", or "critical" effects to towers.
• Simple Saving/Loading: Game state (resources, etc.) is saved to localStorage.
• Minimal Dependencies: Uses only Phaser, TypeScript, and Vite (plus optional dev plugins).
• Fully Typed: Take advantage of TypeScript's strong typing for easier maintenance.

## Installation

### Using Bun (Recommended)

1. Install Bun.
2. Clone this repository:

```bash
git clone <https://github.com/brandon-schabel/tower-defense.git>
cd tower-defense-game
```

3. Install dependencies:

```bash
bun install
```

## Usage

### Development Server

You can run the development server locally using Vite. The default port is set to 3011 in vite-config.ts, but feel free to change it.

Using Bun:

```bash
bun dev
```

Then open your browser at <http://localhost:3011/>.

### Build for Production

Create an optimized build in a dist folder:

```bash
bun build
```

Serve the dist folder on any static web server or follow Deploying to GitHub Pages.

### Deploying to GitHub Pages

1. Make sure your project is built:

```bash
bun build
```

This creates a dist/ folder with production-ready files.

2. Configure your repository to serve from the gh-pages branch. One straightforward approach:
• Commit all your changes, including the built files in dist.
• Push the contents of dist to the gh-pages branch. For instance:

```bash
git subtree push --prefix dist origin gh-pages
```

• In your repository's Settings → Pages (or older GitHub UI: "Settings" → "Pages"), set the source to gh-pages.

3. If your repository name is something other than the default, ensure that your base path is set properly in vite-config.ts. For example:

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import svgr from "vite-plugin-svgr";

export default defineConfig({
  base: "/tower-defense/", 
  plugins: [svgr()],
});
```

4. After a few minutes, your game should be available at <https://your-username.github.io/tower-defense/>.

## Project Structure

A simplified view:

tower-defense-game/
├─ src/
│  ├─ scenes/
│  │  ├─ main-menu-scene.ts
│  │  └─ game-scene.ts
│  ├─ entities/
│  │  ├─ player.ts
│  │  ├─ base.ts
│  │  ├─ tower.ts
│  │  └─ enemy.ts
│  ├─ ui/
│  │  └─ hud.ts
│  ├─ utils/
│  │  ├─ game-state.ts
│  │  └─ health-bar.ts
│  ├─ settings.ts
│  ├─ main.ts
│  ├─ style.css
│  └─ vite-env.d.ts
├─ assets/
│  ├─ base.svg
│  ├─ enemy.svg
│  ├─ normal-tower.svg
│  ├─ ...
├─ index.html
├─ package.json
├─ tsconfig.json
├─ vite-config.ts
└─ ...

Key points:
• scenes/: Contains Phaser Scenes (MainMenuScene, GameScene).
• entities/: Classes for player, base, towers, and enemies.
• ui/: UI handling (e.g., HUD).
• utils/: Game-state management, helper classes (like health bars).
• settings.ts: Centralized game constants (tower stats, enemy stats, etc.).
• index.html: The HTML entry point.
• style.css: Base styling for UI elements.

## Key Scripts

All scripts (defined in package.json) can be run with Bun, npm, or yarn, depending on your preference:
• bun dev or npm run dev: Launch the local dev server.
• bun build or npm run build: Create a production build in dist/.
• bun preview or npm run preview: Locally preview the production build.
• bun test: Run tests (if test files exist).

## Contributing

Contributions are welcome! To contribute:

1. Fork the repository.
2. Create a new branch: git checkout -b feature/my-new-feature.
3. Make changes, ensuring:
• Code remains well-typed and free of new linter errors.
• Tests are updated and pass.
4. Commit your changes: git commit -m 'Add my new feature'.
5. Push to the branch: git push origin feature/my-new-feature.
6. Open a Pull Request describing your changes.

## License

This project is licensed under the MIT License.
Feel free to clone, modify, and distribute for any personal or commercial use.

Enjoy building your own tower defense mechanics, spicing up the AI, or creating entirely new tower types—have fun customizing! If you encounter any issues or have suggestions, feel free to open an issue or pull request. Game on!
