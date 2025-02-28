/**
 * A service container that holds all the game services and dependencies.
 * This helps with initialization order and dependency management.
 * Unlike ServiceLocator, this is not a singleton and should be passed explicitly.
 */
export class ServicesManager {
    private services: Map<string, any> = new Map();

    /**
     * Register a service with the container
     */
    public register<T>(key: string, service: T): void {
        this.services.set(key, service);
    }

    /**
     * Get a service from the container
     */
    public get<T>(key: string): T | undefined {
        return this.services.get(key) as T | undefined;
    }

    /**
     * Check if a service exists in the container
     */
    public has(key: string): boolean {
        return this.services.has(key);
    }
} 