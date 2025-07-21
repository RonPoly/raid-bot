import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  User,
  MessageFlags
} from 'discord.js';
import { SupabaseClient } from '@supabase/supabase-js';
import { Command } from '../types';
import { buildCharacterSelectMenu } from '../utils/character-select';
import { calculateGearScore, EquippedItem } from '../gearscore-calculator';
import { fetchCharacterSummary } from '../utils/warmane-api';
import { requireGuildConfig, getGuildConfig } from '../utils/guild-config';

function gsColor(score: number) {
  if (score < 5000) return 0xff0000;
  if (score < 6000) return 0xffff00;
  return 0x00ff00;
}

const SELECT_ID = 'gs-select';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('gearscore')
    .setDescription('Fetch a character\'s GearScore from Warmane')
    .addStringOption((opt) =>
      opt
        .setName('character')
        .setDescription('Character name')
        .setRequired(false)
    )
    .addUserOption((opt) =>
      opt.setName('user').setDescription('Discord user').setRequired(false)
    ),
  async execute(interaction: ChatInputCommandInteraction, supabase: SupabaseClient) {
    const characterOpt = interaction.options.getString('character');
    const userOpt: User | null = interaction.options.getUser('user');

    const config = await requireGuildConfig(interaction);
    if (!config) return;

    if (characterOpt) {
      await interaction.deferReply();
      try {
        let summary;
        let cachedGs: number | null = null;
        try {
          summary = await fetchCharacterSummary(characterOpt, config.warmane_realm);
          if (summary.error) {
            await interaction.editReply({ content: `Warmane API error: ${summary.error}` });
            return;
          }
        } catch (err: any) {
          if (err.status === 503) {
            await interaction.editReply({
              content: 'Warmane API is currently under maintenance. Please try again later.',
            });
            return;
          }
          const { data } = await supabase
            .from('players')
            .select('gear_score')
            .eq('guild_id', interaction.guildId || '')
            .eq('character_name', characterOpt)
            .maybeSingle();
          if (data) {
            cachedGs = data.gear_score;
            summary = { name: characterOpt, equipment: [], class: null } as any;
          } else {
            throw err;
          }
        }
        const gs = summary.equipment && summary.equipment.length > 0
          ? calculateGearScore(summary.equipment as EquippedItem[], summary.class)
          : cachedGs ?? 0;
        await supabase
          .from('players')
          .update({ gear_score: gs, last_updated: new Date().toISOString() })
          .eq('guild_id', interaction.guildId || '')
          .eq('character_name', summary.name);
        const armoryUrl = `https://armory.warmane.com/character/${encodeURIComponent(summary.name)}/${encodeURIComponent(config.warmane_realm)}`;
        const embed = new EmbedBuilder()
          .setTitle(summary.name)
          .setURL(armoryUrl)
          .setColor(gsColor(gs))
          .setDescription(`${gs} GS`);
        await interaction.editReply({ embeds: [embed] });
      } catch (err) {
        await interaction.editReply({ content: 'Failed to fetch character.' });
      }
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const target = userOpt ?? interaction.user;
    try {
      const { menu, characters } = await buildCharacterSelectMenu(
        supabase,
        target.id,
        interaction.guildId || '',
        SELECT_ID
      );

      if (characters.length === 1) {
        const name = characters[0];
        let summary;
        let cachedGs: number | null = null;
        try {
          summary = await fetchCharacterSummary(name, config.warmane_realm);
          if (summary.error) {
            await interaction.editReply({ content: `Warmane API error: ${summary.error}` });
            return;
          }
        } catch (err: any) {
          if (err.status === 503) {
            await interaction.editReply({ content: 'Warmane API is currently under maintenance. Please try again later.' });
            return;
          }
          const { data } = await supabase
            .from('players')
            .select('gear_score')
            .eq('guild_id', interaction.guildId || '')
            .eq('character_name', name)
            .maybeSingle();
          if (data) {
            cachedGs = data.gear_score;
            summary = { name, equipment: [], class: null } as any;
          } else {
            await interaction.editReply({ content: 'Failed to fetch character.' });
            return;
          }
        }
        const gs = summary.equipment && summary.equipment.length > 0
          ? calculateGearScore(summary.equipment as EquippedItem[], summary.class)
          : cachedGs ?? 0;
        await supabase
          .from('players')
          .update({ gear_score: gs, last_updated: new Date().toISOString() })
          .eq('guild_id', interaction.guildId || '')
          .eq('character_name', summary.name);
        const armoryUrl = `https://armory.warmane.com/character/${encodeURIComponent(summary.name)}/${encodeURIComponent(config.warmane_realm)}`;
        const embed = new EmbedBuilder()
          .setTitle(summary.name)
          .setURL(armoryUrl)
          .setColor(gsColor(gs))
          .setDescription(`${gs} GS`);
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
      await interaction.editReply({ content: 'Choose a character:', components: [row] });
    } catch {
      await interaction.editReply({ content: 'No registered characters found.' });
    }
  }
};

export default command;

export async function handleGsSelectMenu(
  interaction: StringSelectMenuInteraction,
  supabase: SupabaseClient
) {
  await interaction.deferUpdate();
  const character = interaction.values[0];
  const config = await getGuildConfig(interaction.guildId || '');
  if (!config) return;
  try {
    let summary;
    let cachedGs: number | null = null;
    try {
      summary = await fetchCharacterSummary(character, config.warmane_realm);
      if (summary.error) {
        await interaction.editReply({ content: `Warmane API error: ${summary.error}`, components: [] });
        return;
      }
    } catch (err: any) {
      if (err.status === 503) {
        await interaction.editReply({ content: 'Warmane API is currently under maintenance. Please try again later.', components: [] });
        return;
      }
      const { data } = await supabase
        .from('players')
        .select('gear_score')
        .eq('guild_id', interaction.guildId || '')
        .eq('character_name', character)
        .maybeSingle();
      if (data) {
        cachedGs = data.gear_score;
        summary = { name: character, equipment: [], class: null } as any;
      } else {
        throw err;
      }
    }
    const gs = summary.equipment && summary.equipment.length > 0
      ? calculateGearScore(summary.equipment as EquippedItem[], summary.class)
      : cachedGs ?? 0;
    await supabase
      .from('players')
      .update({ gear_score: gs, last_updated: new Date().toISOString() })
      .eq('guild_id', interaction.guildId || '')
      .eq('character_name', summary.name);
    const armoryUrl = `https://armory.warmane.com/character/${encodeURIComponent(summary.name)}/${encodeURIComponent(config.warmane_realm)}`;
    await interaction.editReply({ content: `[${summary.name}](${armoryUrl}) has ${gs} GS.`, components: [] });
  } catch {
    await interaction.editReply({ content: 'Failed to fetch character.', components: [] });
  }
}
