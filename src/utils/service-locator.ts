export default class ServiceLocator {
    private static instance: ServiceLocator;
    private services: Map<string, any> = new Map();

    private constructor() { }

    public static getInstance(): ServiceLocator {
        if (!ServiceLocator.instance) {
            ServiceLocator.instance = new ServiceLocator();
        }
        return ServiceLocator.instance;
    }

    public register<T>(key: string, service: T): void {
        this.services.set(key, service);
    }

    public get<T>(key: string): T | undefined {
        return this.services.get(key) as T | undefined;
    }

    public has(key: string): boolean {
        return this.services.has(key);
    }

    public clear(): void {
        this.services.clear();
    }
}