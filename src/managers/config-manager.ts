import ServiceLocator from "../utils/service-locator";

export class ConfigManager<T> {
    private static instances: Map<string, ConfigManager<any>> = new Map();
    private configs: Map<string, any> = new Map();

    private constructor() {
        // Register with service locator
        ServiceLocator.getInstance().register('configManager', this);
    }

    public static getInstance<T>(): ConfigManager<T> {
        const key = "default";
        if (!ConfigManager.instances.has(key)) {
            ConfigManager.instances.set(key, new ConfigManager<T>());
        }
        return ConfigManager.instances.get(key) as ConfigManager<T>;
    }

    public loadConfig<K extends keyof T>(key: K, config: T[K]): void {
        this.configs.set(key as string, config);
    }

    public getConfig<K extends keyof T>(key: K): T[K] | undefined {
        return this.configs.get(key as string);
    }
}