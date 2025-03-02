/**
 * EventEmitter
 * A simple event subscription and publishing system
 */
export class EventEmitter {
  private listeners: Map<string, Function[]> = new Map();
  
  /**
   * Subscribe to an event
   * @param event Event name to listen for
   * @param callback Function to call when event is emitted
   */
  public on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.push(callback);
    }
  }
  
  /**
   * Unsubscribe from an event
   * @param event Event name to stop listening for
   * @param callback Function to remove from listeners
   */
  public off(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      return;
    }
    
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
      
      // Clean up empty listener arrays
      if (callbacks.length === 0) {
        this.listeners.delete(event);
      }
    }
  }
  
  /**
   * Emit an event with optional arguments
   * @param event Event name to emit
   * @param args Arguments to pass to the callbacks
   */
  public emit(event: string, ...args: any[]): void {
    if (!this.listeners.has(event)) {
      return;
    }
    
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      // Create a copy of the callbacks array to avoid issues if a callback modifies the listeners
      const callbacksCopy = [...callbacks];
      callbacksCopy.forEach(callback => {
        try {
          callback(...args);
        } catch (err) {
          console.error(`Error in event listener for "${event}":`, err);
        }
      });
    }
  }
  
  /**
   * Subscribe to an event, but only trigger once
   * @param event Event name to listen for
   * @param callback Function to call when event is emitted
   */
  public once(event: string, callback: Function): void {
    const onceWrapper = (...args: any[]) => {
      this.off(event, onceWrapper);
      callback(...args);
    };
    
    this.on(event, onceWrapper);
  }
  
  /**
   * Remove all listeners for a specific event, or all events if no event specified
   * @param event Optional event name
   */
  public removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
  
  /**
   * Get the number of listeners for a specific event
   * @param event Event name
   * @returns Number of listeners
   */
  public listenerCount(event: string): number {
    return this.listeners.has(event) ? this.listeners.get(event)?.length || 0 : 0;
  }
  
  /**
   * Get all registered event names
   * @returns Array of event names
   */
  public eventNames(): string[] {
    return Array.from(this.listeners.keys());
  }
} 