export class ConfigManager<T> {
    private configs: Map<string, any> = new Map();

    constructor() {
        // No service locator registration
    }

    public loadConfig<K extends keyof T>(key: K, config: T[K]): void {
        this.configs.set(key as string, config);
    }

    public getConfig<K extends keyof T>(key: K): T[K] | undefined {
        return this.configs.get(key as string);
    }
}