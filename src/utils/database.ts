import { SupabaseClient } from '@supabase/supabase-js';
import { Player, Character, Raid, RaidSignup } from '../types';
import supabase from '../config/database';

export async function registerCharacter(
  supabase: SupabaseClient,
  guildId: string,
  discordId: string,
  character: string,
  realm: string,
  gearScore: number
): Promise<Player> {
  const { data, error } = await supabase
    .from('players')
    .insert({
      guild_id: guildId,
      discord_id: discordId,
      character_name: character,
      realm,
      gear_score: gearScore,
      last_updated: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data as Player;
}

export async function updateGearScore(
  supabase: SupabaseClient,
  guildId: string,
  discordId: string,
  character: string,
  gearScore: number
): Promise<void> {
  const { error } = await supabase
    .from('players')
    .update({ gear_score: gearScore, last_updated: new Date().toISOString() })
    .eq('guild_id', guildId)
    .eq('discord_id', discordId)
    .eq('character_name', character);
  if (error) throw error;
}

export async function createRaid(
  supabase: SupabaseClient,
  raid: Omit<Raid, 'id' | 'created_at'>
): Promise<Raid> {
  const { data, error } = await supabase.from('raids').insert(raid).select().single();
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
    .from('raid_signups')
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
    .from('raid_signups')
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
    .from('raid_signups')
    .select('*')
    .eq('raid_id', raidId);
  if (error) throw error;
  return data as RaidSignup[];
}

export async function isUserRegistered(discordId: string): Promise<boolean> {
  const { data } = await supabase
    .from('players')
    .select('id')
    .eq('discord_id', discordId)
    .maybeSingle();
  return !!data;
}
