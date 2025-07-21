import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ModalSubmitInteraction,
  MessageFlags,
} from 'discord.js';
import { SupabaseClient } from '@supabase/supabase-js';
import { Command } from '../types';
import { fetchCharacterSummary, fetchGuildMembers } from '../utils/warmane-api';
import { calculateGearScore } from '../gearscore-calculator';
import { requireGuildConfig } from '../utils/guild-config';

function normalize(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('register')
    .setDescription('Register a character'),

  async execute(interaction: ChatInputCommandInteraction, _supabase: SupabaseClient) {
    if (!interaction.guildId) {
      await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId('register_modal')
      .setTitle('Register Character')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('character_name')
            .setLabel('Character Name (exact - case sensitive)')
            .setPlaceholder('e.g. Arth\u00e1s')
            .setStyle(TextInputStyle.Short)
            .setRequired(true),
        )
      );

    await interaction.showModal(modal);
    return;
  },
};

export default command;

export async function handleRegisterModal(
  interaction: ModalSubmitInteraction,
  supabase: SupabaseClient
) {
  const config = await requireGuildConfig(interaction);
  if (!config) {
    await interaction.editReply({ content: 'This server needs to be configured. An admin should run /setup' });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const name = interaction.fields.getTextInputValue('character_name').trim();
  const realm = config.warmane_realm;

  try {
    let summary;
    let existingGs: number | null = null;
    try {
      summary = await fetchCharacterSummary(name, realm);
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
      const { data: existing } = await supabase
        .from('players')
        .select('class, gear_score')
        .eq('guild_id', interaction.guildId || '')
        .eq('character_name', name)
        .maybeSingle();
      if (existing) {
        summary = { name, class: existing.class, equipment: [] } as any;
        existingGs = existing.gear_score;
      } else {
        throw err;
      }
    }

    const rosterData = await fetchGuildMembers(config.warmane_guild_name, realm);
    const members = rosterData.members ?? rosterData.roster ?? [];
    const inGuild = members.some((m: any) => normalize(m.name) === normalize(name));
    if (!inGuild) {
      await interaction.editReply({
        content: `Character ${name} is not in ${config.warmane_guild_name}. Only guild members can register their characters.`
      });
      return;
    }

    console.log('Warmane equipment data:', summary.equipment);
    const gearScore = summary.equipment && summary.equipment.length > 0
      ? calculateGearScore(summary.equipment, summary.class)
      : existingGs ?? 0;
    const { error } = await supabase.from('players').insert({
      guild_id: interaction.guildId,
      discord_id: interaction.user.id,
      character_name: name,
      realm,
      class: summary.class,
      gear_score: gearScore,
      last_updated: new Date().toISOString(),
    });
    if (error) {
      await interaction.editReply({ content: `Database error: ${error.message}` });
      return;
    }

    const armoryUrl = `https://armory.warmane.com/character/${encodeURIComponent(name)}/${encodeURIComponent(realm)}`;
    await interaction.editReply({
      content: `Registered **[${summary.name}](${armoryUrl})** on ${realm}! GearScore: **${gearScore}**`,
    });
  } catch (err) {
    console.error('Register character error:', err);
    await interaction.editReply({ content: 'Failed to register character.' });
  }
}
