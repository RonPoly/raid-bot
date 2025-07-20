const BASE_URL = 'https://armory.warmane.com/api';

export async function fetchGuildMembers(name: string, realm: string) {
  const res = await fetch(`${BASE_URL}/guild/${encodeURIComponent(name)}/${encodeURIComponent(realm)}/members`);
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
