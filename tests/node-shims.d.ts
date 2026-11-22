// Minimal typings for the Node built-ins used by tests (no @types/node dependency).
declare module 'node:fs' {
  export function readFileSync(path: string): Uint8Array;
  export function copyFileSync(src: string, dest: string): void;
  export function mkdtempSync(prefix: string): string;
}
declare module 'node:os' {
  export function tmpdir(): string;
}
declare module 'node:path' {
  export function join(...parts: string[]): string;
}
