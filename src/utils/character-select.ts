import { StringSelectMenuBuilder } from 'discord.js';
import { SupabaseClient } from '@supabase/supabase-js';

export interface CharacterSelectResult {
  menu: StringSelectMenuBuilder;
  characters: string[];
}

/**
 * Build a character selection menu for a Discord user.
 * Throws an error if the user has no registered characters.
 */
export async function buildCharacterSelectMenu(
  supabase: SupabaseClient,
  discordId: string,
  guildId: string,
  customId: string,
  placeholder = 'Select character'
): Promise<CharacterSelectResult> {
  const { data } = await supabase
    .from('players')
    .select('character_name, gear_score')
    .eq('discord_id', discordId)
    .eq('guild_id', guildId);

  if (!data || data.length === 0) {
    throw new Error('No characters registered');
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(placeholder)
    .addOptions(
      data.map((c) => ({
        label: c.character_name,
        value: c.character_name,
        description: c.gear_score ? `${c.gear_score} GS` : 'No GS set',
      }))
    );

  return { menu, characters: data.map((c) => c.character_name) };
}
