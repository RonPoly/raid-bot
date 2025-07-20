import supabase from '../config/database';
import { GuildConfig } from '../types';

export async function getGuildConfig(guildId: string): Promise<GuildConfig | null> {
  if (!guildId) return null;
  const { data } = await supabase
    .from('guild_configs')
    .select('*')
    .eq('discord_guild_id', guildId)
    .maybeSingle();
  return data as GuildConfig | null;
}
