import { SupabaseClient } from '@supabase/supabase-js';
import { Player, Character, Raid, RaidSignup } from '../types';

export async function registerMain(
  supabase: SupabaseClient,
  discordId: string,
  character: string,
  realm: string
): Promise<Player> {
  const { data: existing } = await supabase
    .from('Players')
    .select('*')
    .eq('discord_id', discordId)
    .maybeSingle();
  if (existing) {
    throw new Error('Main character already registered');
  }
  const { data, error } = await supabase
    .from('Players')
    .insert({ discord_id: discordId, main_character: character, realm })
    .select()
    .single();
  if (error) throw error;
  return data as Player;
}

export async function registerAlt(
  supabase: SupabaseClient,
  playerId: string,
  character: string
): Promise<Character> {
  const { data, error } = await supabase
    .from('Alts')
    .insert({ player_id: playerId, character_name: character })
    .select()
    .single();
  if (error) throw error;
  return { character_name: data.character_name, player_id: data.player_id };
}

export async function updateGearScore(
  supabase: SupabaseClient,
  character: string,
  gearScore: number,
  updatedBy: string
): Promise<void> {
  const { error } = await supabase.from('GearScores').upsert({
    character_name: character,
    gear_score: gearScore,
    last_updated: new Date().toISOString(),
    updated_by: updatedBy
  });
  if (error) throw error;
}

export async function createRaid(
  supabase: SupabaseClient,
  raid: Omit<Raid, 'id' | 'created_at'>
): Promise<Raid> {
  const { data, error } = await supabase.from('Raids').insert(raid).select().single();
  if (error) throw error;
  return data as Raid;
}

export async function addRaidSignup(
  supabase: SupabaseClient,
  raidId: string,
  characterName: string,
  role: 'tank' | 'healer' | 'dps',
  gearScore: number,
  comment?: string
): Promise<RaidSignup> {
  const { data, error } = await supabase
    .from('RaidSignups')
    .insert({
      raid_id: raidId,
      character_name: characterName,
      role,
      gear_score: gearScore,
      signed_up_at: new Date().toISOString(),
      comment
    })
    .select()
    .single();
  if (error) throw error;
  return data as RaidSignup;
}

export async function removeRaidSignup(
  supabase: SupabaseClient,
  raidId: string,
  characterName: string
): Promise<void> {
  const { error } = await supabase
    .from('RaidSignups')
    .delete()
    .eq('raid_id', raidId)
    .eq('character_name', characterName);
  if (error) throw error;
}

export async function listRaidSignups(
  supabase: SupabaseClient,
  raidId: string
): Promise<RaidSignup[]> {
  const { data, error } = await supabase
    .from('RaidSignups')
    .select('*')
    .eq('raid_id', raidId);
  if (error) throw error;
  return data as RaidSignup[];
}
