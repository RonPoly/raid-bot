import { ChatInputCommandInteraction } from 'discord.js';
import supabase from '../config/database';
import { GuildConfig } from '../types';

interface CachedConfig {
  config: GuildConfig | null;
  expires: number;
}

const cache = new Map<string, CachedConfig>();

export async function getGuildConfig(
  guildId: string
): Promise<GuildConfig | null> {
  if (!guildId) return null;

  const cached = cache.get(guildId);
  const now = Date.now();
  if (cached && cached.expires > now) {
    return cached.config;
  }

  const { data } = await supabase
    .from('guild_configs')
    .select('*')
    .eq('discord_guild_id', guildId)
    .maybeSingle();

  const config = data && data.setup_complete ? (data as GuildConfig) : null;
  cache.set(guildId, { config, expires: now + 5 * 60 * 1000 });
  return config;
}

export async function requireGuildConfig(
  interaction: ChatInputCommandInteraction
): Promise<GuildConfig | null> {
  const guildId = interaction.guildId ?? '';
  const config = await getGuildConfig(guildId);
  if (!config) {
    await interaction.reply({
      content: 'This server needs to be configured. An admin should run /setup',
      ephemeral: true
    });
    return null;
  }
  return config;
}

export async function updateGuildConfig(
  guildId: string,
  updates: Partial<GuildConfig>
): Promise<GuildConfig | null> {
  if (!guildId) return null;
  await supabase
    .from('guild_configs')
    .update(updates)
    .eq('discord_guild_id', guildId);
  cache.delete(guildId);
  return getGuildConfig(guildId);
}
