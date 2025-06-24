//A simple events system for effectively direct links without actualy linking files or references
class EventManager<T extends string, D, E, C extends (data: D, extradata: E | undefined) => void> {
    private activeEvents: T[];
    private listeners: Record<T, C[]>;

    constructor() {
        this.activeEvents = [];
        this.listeners = {} as any;
    }


    raise(eventType: T, eventData: D, extraEventData?: E): void {
        if (this.listeners[eventType] == undefined) {
            return;
        }
        this.activeEvents.push(eventType);
        for (let i = 0; i < this.listeners[eventType].length; i++) {
            this.listeners[eventType][i](eventData, extraEventData)
        }
        this.activeEvents.pop();
    }

    listen(eventType: T, callback: C): void {
        if (this.listeners[eventType] == undefined) {
            this.listeners[eventType] = []
        }
        this.listeners[eventType].push(callback)
    }

    unlisten(eventType: T, callback: C): void {
        if (this.listeners[eventType] == undefined) {
            return;
        }
        const lisen = this.listeners[eventType].indexOf(callback);
        if (lisen != -1) {
            this.listeners[eventType].splice(lisen, 1);
        }
    }
    unlistenAll(eventType: T): void {
        if (this.listeners[eventType] == undefined) {
            return;
        }
        this.listeners[eventType] = [];
    }
}

export const events = new EventManager()