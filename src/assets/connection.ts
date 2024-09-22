import { User } from "..";
import { WebSocket } from "ws";

export class Connections {
    entries: [k: number, v: {
        isAlive: Boolean,
        user: User,
        ws: WebSocket
    }][];

    constructor() {
        this.entries = []
        return this;
    }

    push(value: any) {
        this.entries.push([this.entries.length, value])
    }

    delete(predicate: (value: {
        isAlive: Boolean,
        user: User,
        ws: WebSocket
    }) => boolean) {
        const index = this.entries.findIndex(([k, v]) => predicate(v))
        if (!index) return -1;
        this.entries = this.entries.filter(([k, v]) => k !== index);
        return 1;
    }

    find(predicate: (value: {
        isAlive: Boolean,
        user: User,
        ws: WebSocket
    }) => boolean) {
        return this.entries.find(([k, v]) => predicate(v))?.[1]
    }

    filter(predicate: (value: {
        isAlive: Boolean,
        user: User,
        ws: WebSocket
    }) => boolean) {
        return this.entries.filter(([k, v]) => predicate(v)).map(([k, v]) => v)
    }

    map(predicate: (value: {
        isAlive: Boolean,
        user: User,
        ws: WebSocket
    }) => any) {
        return this.entries.map(([k, v]) => predicate(v))
    }

    toArray() {
        return this.entries.map(([k, v]) => v)
    }
}