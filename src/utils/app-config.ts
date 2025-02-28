import { ConfigManager } from "../managers/config-manager";
import { GAME_SETTINGS } from "../settings";

// Use the GAME_SETTINGS type directly
export type GameConfig = typeof GAME_SETTINGS;

// Create and export a pre-configured instance
export const gameConfig = new ConfigManager<GameConfig>();

// Example of accessing a setting (with type safety!)

// Example of trying to access an invalid setting (will cause a type error)
// const invalidSetting = appConfig.getConfig("gameSettings").invalid.setting;

// Example of trying to load an invalid key (will cause a type error)
// appConfig.loadConfig("invalidKey", {});

// Example of trying to get an invalid key (will cause a type error)
// const invalid = appConfig.getConfig("invalidKey");