import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
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

  async execute(interaction: ChatInputCommandInteraction, supabase: SupabaseClient) {
    if (!interaction.guildId) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const config = await requireGuildConfig(interaction);
    if (!config) return;

    const modal = new ModalBuilder()
      .setCustomId('register_modal')
      .setTitle('Register Character')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('character_name')
            .setLabel('Character Name (case sensitive - exact in-game)')
            .setPlaceholder('e.g. Arth\u00e1s')
            .setStyle(TextInputStyle.Short)
            .setRequired(true),
        )
      );

    await interaction.showModal(modal);

    try {
      const submit = await interaction.awaitModalSubmit({
        filter: (i) => i.customId === 'register_modal' && i.user.id === interaction.user.id,
        time: 60_000,
      });

      await submit.deferReply({ ephemeral: true });

      const name = submit.fields.getTextInputValue('character_name').trim();
      const realm = config.warmane_realm;

      try {
        const summary = await fetchCharacterSummary(name, realm);
        if (summary.error) {
          await submit.editReply({ content: `Warmane API error: ${summary.error}` });
          return;
        }

        const rosterData = await fetchGuildMembers(config.warmane_guild_name, realm);
        const members = rosterData.members ?? rosterData.roster ?? [];
        const inGuild = members.some((m: any) => normalize(m.name) === normalize(name));
        if (!inGuild) {
          await submit.editReply({
            content: `Character ${name} is not in ${config.warmane_guild_name}. Only guild members can register their characters.`
          });
          return;
        }

        console.log('Warmane equipment data:', summary.equipment);
        const gearScore = calculateGearScore(summary.equipment);
        const { error } = await supabase.from('players').insert({
          guild_id: interaction.guildId,
          discord_id: interaction.user.id,
          character_name: name,
          realm,
          gear_score: gearScore,
          last_updated: new Date().toISOString(),
        });
        if (error) {
          await submit.editReply({ content: `Database error: ${error.message}` });
          return;
        }

        const armoryUrl = `https://armory.warmane.com/character/${encodeURIComponent(name)}/${encodeURIComponent(realm)}`;
        await submit.editReply({
          content: `Registered **[${summary.name}](${armoryUrl})** on ${realm}! GearScore: **${gearScore}**`,
        });
      } catch (err) {
        console.error('Register character error:', err);
        await submit.editReply({ content: 'Failed to register character.' });
      }
    } catch {
      await interaction.followUp({ content: 'Registration timed out.', ephemeral: true, flags: MessageFlags.Ephemeral });
    }
  },
};

export default command;
