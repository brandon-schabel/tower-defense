export class EventBus {
    private events: { [key: string]: { fn: Function, ctx: any }[] } = {};

    on(event: string, callback: Function, context?: any): void {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push({ fn: callback, ctx: context });
    }

    off(event: string, callback: Function, context?: any): void {
        if (!this.events[event]) {
            return;
        }
        this.events[event] = this.events[event].filter(
            listener => listener.fn !== callback || listener.ctx !== context
        );
    }

    emit(event: string, ...args: any[]): void {
        if (!this.events[event]) {
            return;
        }
        this.events[event].forEach(listener => {
            listener.fn.apply(listener.ctx || null, args);
        });
    }
}