const BASE_URL = 'https://armory.warmane.com/api';

function encodeGuildName(name: string): string {
  return encodeURIComponent(name).replace(/%20/g, '+');
}

export async function fetchGuildMembers(name: string, realm: string) {
  const res = await fetch(
    `${BASE_URL}/guild/${encodeGuildName(name)}/${encodeURIComponent(realm)}/members`
  );
  if (res.status === 503) {
    const err: any = new Error('Warmane API maintenance');
    err.status = 503;
    throw err;
  }
  if (!res.ok) {
    throw new Error(`Warmane API error: ${res.status}`);
  }
  return res.json();
}

export async function fetchCharacterSummary(name: string, realm: string) {
  const res = await fetch(`${BASE_URL}/character/${encodeURIComponent(name)}/${encodeURIComponent(realm)}/summary`);
  if (!res.ok) {
    throw new Error(`Warmane API error: ${res.status}`);
  }
  return res.json();
}

export async function fetchGuildSummary(name: string, realm: string) {
  const res = await fetch(
    `${BASE_URL}/guild/${encodeGuildName(name)}/${encodeURIComponent(realm)}/summary`
  );
  if (!res.ok) {
    const err: any = new Error(`Warmane API error: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
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
