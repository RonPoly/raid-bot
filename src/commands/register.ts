import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ComponentType,
} from 'discord.js';
import { SupabaseClient } from '@supabase/supabase-js';
import { Command } from '../types';
import { calculateGearScore } from '../gearscore-calculator';
import { fetchCharacterSummary } from '../utils/warmane-api';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('register')
    .setDescription('Register a character'),

  async execute(interaction: ChatInputCommandInteraction, supabase: SupabaseClient) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const { data: player } = await supabase
      .from('Players')
      .select('id')
      .eq('discord_id', interaction.user.id)
      .maybeSingle();

    if (!player) {
      const button = new ButtonBuilder()
        .setCustomId('register_main')
        .setLabel('Register Main Character')
        .setStyle(ButtonStyle.Primary);
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

      const msg = await interaction.editReply({
        content: "Welcome! Let's get your main character registered.",
        components: [row],
      });

      try {
        const click = await msg.awaitMessageComponent({
          componentType: ComponentType.Button,
          filter: (i) => i.customId === 'register_main' && i.user.id === interaction.user.id,
          time: 60_000,
        });

        const modal = new ModalBuilder()
          .setCustomId('register_modal')
          .setTitle('Register Character')
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('character_name')
                .setLabel('Character Name')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
            ),
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('realm')
                .setLabel('Realm')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
            )
          );

        await click.showModal(modal);
        const modalSubmit = await click.awaitModalSubmit({
          filter: (i) => i.customId === 'register_modal' && i.user.id === interaction.user.id,
          time: 60_000,
        });
        await modalSubmit.deferUpdate();

        const name = modalSubmit.fields.getTextInputValue('character_name').trim();
        const realm = modalSubmit.fields.getTextInputValue('realm').trim();
        try {
          const summary = await fetchCharacterSummary(name, realm);
          if (summary.error) {
            await interaction.editReply({
              content: `Warmane API error: ${summary.error}`,
              components: [],
            });
            return;
          }
          const gearScore = calculateGearScore(summary.equipment);
          const { error } = await supabase.from('Players').insert({
            discord_id: interaction.user.id,
            main_character: name,
            realm,
          });
          if (error) throw error;

          const armoryUrl = `https://armory.warmane.com/character/${encodeURIComponent(name)}/${encodeURIComponent(realm)}`;
          await interaction.editReply({
            content: `Registered **[${summary.name}](${armoryUrl})** on ${summary.realm}! GearScore: **${gearScore}**`,
            components: [],
          });
        } catch (err) {
          console.error('Register main error:', err);
          await interaction.editReply({
            content: 'Failed to register character.',
            components: [],
          });
        }
      } catch {
        await interaction.editReply({ content: 'Registration timed out.', components: [] });
      }
      return;
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId('register_select')
      .setPlaceholder('Choose an option')
      .addOptions(
        { label: 'Register a new Alt', value: 'register_alt' },
        { label: 'Manage my Characters', value: 'manage_chars' }
      );
    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);

    const msg = await interaction.editReply({
      content: 'You already have a main registered. What would you like to do?',
      components: [row],
    });

    try {
      const select = await msg.awaitMessageComponent({
        componentType: ComponentType.StringSelect,
        filter: (i) => i.customId === 'register_select' && i.user.id === interaction.user.id,
        time: 60_000,
      });

      if (select.values[0] === 'manage_chars') {
        await select.update({
          content: 'Use /character view or /character delete to manage your characters.',
          components: [],
        });
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
              .setRequired(true)
          ),
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('realm')
              .setLabel('Realm')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          )
        );

      await select.showModal(modal);
      const modalSubmit = await select.awaitModalSubmit({
        filter: (i) => i.customId === 'register_modal' && i.user.id === interaction.user.id,
        time: 60_000,
      });
      await modalSubmit.deferUpdate();

      const name = modalSubmit.fields.getTextInputValue('character_name').trim();
      const realm = modalSubmit.fields.getTextInputValue('realm').trim();
      try {
        const summary = await fetchCharacterSummary(name, realm);
        if (summary.error) {
          await interaction.editReply({
            content: `Warmane API error: ${summary.error}`,
            components: [],
          });
          return;
        }
        const gearScore = calculateGearScore(summary.equipment);
        const { error } = await supabase.from('Alts').insert({
          player_id: player.id,
          character_name: name,
        });
        if (error) throw error;

        const armoryUrl = `https://armory.warmane.com/character/${encodeURIComponent(name)}/${encodeURIComponent(realm)}`;
        await interaction.editReply({
          content: `Registered alt **[${summary.name}](${armoryUrl})** on ${summary.realm}! GearScore: **${gearScore}**`,
          components: [],
        });
      } catch (err) {
        console.error('Register alt error:', err);
        await interaction.editReply({
          content: 'Failed to register alt.',
          components: [],
        });
      }
    } catch {
      await interaction.editReply({ content: 'Registration timed out.', components: [] });
    }
  },
};

export default command;
