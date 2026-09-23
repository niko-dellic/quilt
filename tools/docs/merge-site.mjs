import { cpSync, mkdirSync, rmSync } from 'node:fs';
const source = new URL('../../docs/.vitepress/site/', import.meta.url);
const destination = new URL('../../dist/', import.meta.url);
mkdirSync(destination, { recursive: true });
rmSync(new URL('docs/', destination), { recursive: true, force: true });
cpSync(source, destination, { recursive: true });
