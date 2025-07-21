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
import { fetchCharacterSummary } from '../utils/warmane-api';
import { calculateGearScore } from '../gearscore-calculator';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('register')
    .setDescription('Register a character'),

  async execute(interaction: ChatInputCommandInteraction, supabase: SupabaseClient) {
    if (!interaction.guildId) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId('register_modal')
      .setTitle('Register Character')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('character_name')
            .setLabel('Character Name')
            .setStyle(TextInputStyle.Short)
            .setRequired(true),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('realm')
            .setLabel('Realm')
            .setStyle(TextInputStyle.Short)
            .setRequired(true),
        ),
      );

    await interaction.showModal(modal);

    try {
      const submit = await interaction.awaitModalSubmit({
        filter: (i) => i.customId === 'register_modal' && i.user.id === interaction.user.id,
        time: 60_000,
      });

      await submit.deferReply({ ephemeral: true });

      const name = submit.fields.getTextInputValue('character_name').trim();
      const realm = submit.fields.getTextInputValue('realm').trim();

      try {
        const summary = await fetchCharacterSummary(name, realm);
        if (summary.error) {
          await submit.editReply({ content: `Warmane API error: ${summary.error}` });
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
          content: `Registered **[${summary.name}](${armoryUrl})** on ${summary.realm}! GearScore: **${gearScore}**`,
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
