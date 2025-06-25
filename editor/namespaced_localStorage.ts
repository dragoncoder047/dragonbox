// importing Config causes a circular dependency error lol
const localStorage_namespace = /*Config.jsonFormat*/"DragonBox";

export function nsLocalStorage_save(name: string, data: string) {
    window.localStorage.setItem(`${localStorage_namespace}_${name}`, data);
}

export function nsLocalStorage_get(name: string) {
    return window.localStorage.getItem(`${localStorage_namespace}_${name}`);
}

export function nsLocalStorage_clear(name: string) {
    window.localStorage.removeItem(name);
}

export function nsLocalStorage_numKeys() {
    return window.localStorage.length;
}

export function nsLocalStorage_nthKey(n: number) {
    return window.localStorage.key(n);
}
