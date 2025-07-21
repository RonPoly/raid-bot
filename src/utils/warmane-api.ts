import { promises as fs } from 'fs';
import path from 'path';

const BASE_URL = 'https://armory.warmane.com/api';

// Simple token bucket rate limiter
let tokens = 10;
let lastCall = 0;
const queue: Array<() => void> = [];

function processQueue() {
  if (queue.length === 0 || tokens <= 0) return;
  const now = Date.now();
  if (now - lastCall < 100) {
    setTimeout(processQueue, 100 - (now - lastCall));
    return;
  }
  const resolve = queue.shift()!;
  tokens--;
  lastCall = now;
  resolve();
  if (queue.length > 0) {
    setTimeout(processQueue, 100);
  }
}

setInterval(() => {
  tokens = Math.min(tokens + 1, 10);
  processQueue();
}, 6000);

async function rateLimit() {
  return new Promise<void>((resolve) => {
    queue.push(resolve);
    processQueue();
  });
}

const CACHE_DIR = path.join(__dirname, '../../cache');

function slugify(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
}

function rosterCachePath(name: string, realm: string): string {
  return path.join(CACHE_DIR, `${slugify(name)}_${slugify(realm)}_roster.json`);
}

function summaryCachePath(name: string, realm: string): string {
  return path.join(CACHE_DIR, `${slugify(name)}_${slugify(realm)}_summary.json`);
}

function characterCachePath(name: string, realm: string): string {
  return path.join(CACHE_DIR, `${slugify(name)}_${slugify(realm)}_character.json`);
}

async function readCache(file: string, maxAgeMs: number) {
  try {
    const handle = await fs.open(file, 'r');
    try {
      const stat = await handle.stat();
      if (Date.now() - stat.mtimeMs < maxAgeMs) {
        const text = await handle.readFile('utf-8');
        return JSON.parse(text);
      }
    } finally {
      await handle.close();
    }
  } catch {
    // ignore
  }
  return null;
}

async function writeCache(file: string, data: any) {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf-8');
}

function encodeGuildName(name: string): string {
  return encodeURIComponent(name).replace(/%20/g, '+');
}

export async function fetchGuildMembers(name: string, realm: string) {
  const cacheFile = rosterCachePath(name, realm);
  const cached = await readCache(cacheFile, 60 * 60 * 1000);
  if (cached && cached.name === name && cached.realm === realm) {
    const members = cached.members ?? cached.roster ?? [];
    const byName: Record<string, any> = {};
    for (const m of members) {
      byName[m.name] = m;
    }
    return { ...cached, byName };
  }

  const url = `${BASE_URL}/guild/${encodeGuildName(name)}/${encodeURIComponent(realm)}/members`;
  console.log('[WarmaneAPI] Fetching guild members from', url);
  await rateLimit();
  const res = await fetch(url);
  if (res.status === 503) {
    const err: any = new Error('Warmane API maintenance');
    err.status = 503;
    throw err;
  }
  if (!res.ok) {
    throw new Error(`Warmane API error: ${res.status}`);
  }
  const json = await res.json();
  console.log('[WarmaneAPI] Guild members response:', JSON.stringify(json));
  const toCache = { ...json, name, realm };
  await writeCache(cacheFile, toCache);
  const members = json.members ?? json.roster ?? [];
  const byName: Record<string, any> = {};
  for (const m of members) {
    byName[m.name] = m;
  }
  return { ...json, name, realm, byName };
}

export async function fetchCharacterSummary(name: string, realm: string) {
  const cacheFile = characterCachePath(name, realm);
  const cached = await readCache(cacheFile, 60 * 60 * 1000);
  if (cached && cached.name === name && cached.realm === realm) {
    return cached;
  }

  await rateLimit();
  const res = await fetch(
    `${BASE_URL}/character/${encodeURIComponent(name)}/${encodeURIComponent(realm)}/summary`
  );
  if (res.status === 503) {
    const err: any = new Error('Warmane API maintenance');
    err.status = 503;
    throw err;
  }
  if (!res.ok) {
    const err: any = new Error(`Warmane API error: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const json = await res.json();
  const toCache = { ...json, name, realm };
  await writeCache(cacheFile, toCache);
  return toCache;
}

export async function fetchGuildSummary(name: string, realm: string) {
  const cacheFile = summaryCachePath(name, realm);
  const cached = await readCache(cacheFile, 60 * 60 * 1000);
  if (cached && cached.name === name && cached.realm === realm) {
    return cached;
  }

  await rateLimit();
  const res = await fetch(
    `${BASE_URL}/guild/${encodeGuildName(name)}/${encodeURIComponent(realm)}/summary`
  );
  if (res.status === 503) {
    const err: any = new Error('Warmane API maintenance');
    err.status = 503;
    throw err;
  }
  if (!res.ok) {
    const err: any = new Error(`Warmane API error: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const json = await res.json();
  const toCache = { ...json, name, realm };
  await writeCache(cacheFile, toCache);
  return toCache;
}

export const CLASS_COLORS: Record<string, number> = {
  'Death Knight': 0xc41f3b,
  Druid: 0xff7d0a,
  Hunter: 0xabd473,
  Mage: 0x69ccf0,
  Paladin: 0xf58cba,
  Priest: 0xffffff,
  Rogue: 0xfff569,
  Shaman: 0x0070de,
  Warlock: 0x9482c9,
  Warrior: 0xc79c6e
};

export function getClassColor(className: string): number {
  return CLASS_COLORS[className] ?? 0x2f3136;
}
