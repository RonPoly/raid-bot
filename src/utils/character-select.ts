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
  customId: string,
  placeholder = 'Select character'
): Promise<CharacterSelectResult> {
  const { data: player } = await supabase
    .from('Players')
    .select('id, main_character')
    .eq('discord_id', discordId)
    .maybeSingle();
  if (!player) {
    throw new Error('No characters registered');
  }

  const { data: alts } = await supabase
    .from('Alts')
    .select('character_name')
    .eq('player_id', player.id);

  const characters = [player.main_character, ...(alts?.map(a => a.character_name) ?? [])];
  if (characters.length === 0) {
    throw new Error('No characters registered');
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(placeholder)
    .addOptions(characters.map(c => ({ label: c, value: c })));

  return { menu, characters };
}
