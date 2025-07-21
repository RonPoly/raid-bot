import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ComponentType,
} from 'discord.js';
import { SupabaseClient } from '@supabase/supabase-js';
import { Command } from '../types';
import { fetchCharacterSummary, getClassColor } from '../utils/warmane-api';
import { requireGuildConfig } from '../utils/guild-config';
import { gearScoreCalculator } from '../utils/gearscore-calculator';
import { updateGearScore } from '../utils/database';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('register')
    .setDescription('Register your character')
    .addStringOption((opt) =>
      opt.setName('character')
        .setDescription('Character name (must be spelled exactly as in-game)')
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('alt_of')
        .setDescription(
          'Main character if registering an alt (must be spelled exactly as in-game)'
        )
        .setRequired(false)
    ),
  async execute(interaction: ChatInputCommandInteraction, supabase: SupabaseClient) {
    const character = interaction.options.getString('character', true);
    const altOf = interaction.options.getString('alt_of');
    const discordId = interaction.user.id;

    const config = await requireGuildConfig(interaction);
    if (!config) return;
    const realm = config.warmane_realm;

    if (!/^[A-Za-z\u00C0-\u017F]{2,12}$/.test(character)) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setDescription('Invalid character name.');
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    let summary: any;
    try {
      summary = await fetchCharacterSummary(character, realm);
    } catch {
      await interaction.reply({ content: 'Character not found on Warmane.', ephemeral: true });
      return;
    }

    const gearScore = gearScoreCalculator.calculate(summary.equipment ?? []);
    const color = getClassColor(summary.class);

    const confirmEmbed = new EmbedBuilder()
      .setTitle('Confirm Registration')
      .setColor(color)
      .addFields(
        { name: 'Name', value: summary.name, inline: true },
        { name: 'Class', value: summary.class, inline: true },
        { name: 'Guild', value: summary.guild ?? 'None', inline: true },
        { name: 'GearScore', value: gearScore.toString(), inline: true }
      );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('register-confirm').setLabel('Confirm').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('register-cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
    );

    const msg = await interaction.reply({ embeds: [confirmEmbed], components: [row], ephemeral: true, fetchReply: true });

    try {
      const button = await msg.awaitMessageComponent({
        componentType: ComponentType.Button,
        time: 30_000,
        filter: (i) => i.user.id === interaction.user.id,
      });

      if (button.customId === 'register-cancel') {
        await button.update({ content: 'Registration cancelled.', components: [], embeds: [] });
        return;
      }

      if (!altOf) {
        const { data: existing } = await supabase
          .from('Players')
          .select('*')
          .eq('discord_id', discordId)
          .maybeSingle();

        if (existing) {
          await button.update({ content: 'You already registered a main character.', components: [] });
          return;
        }

        const { data: inserted, error } = await supabase
          .from('Players')
          .insert({ discord_id: discordId, main_character: character, realm })
          .select('id, main_character')
          .single();

        if (!inserted || error) {
          await button.update({ content: 'Failed to register character.', components: [] });
          return;
        }

        await updateGearScore(supabase, character, gearScore, inserted.id);

        const { data: alts } = await supabase
          .from('Alts')
          .select('character_name')
          .eq('player_id', inserted.id);

        const charList = [inserted.main_character, ...(alts?.map((a) => a.character_name) ?? [])];

        const embed = new EmbedBuilder()
          .setTitle('Registered Characters')
          .setColor(color)
          .setDescription(charList.join('\n'));

        await button.update({ embeds: [embed], components: [] });
      } else {
        const { data: player } = await supabase
          .from('Players')
          .select('id, main_character')
          .eq('discord_id', discordId)
          .maybeSingle();

        if (!player) {
          await button.update({ content: 'You must register a main character first.', components: [] });
          return;
        }

        if (player.main_character.toLowerCase() !== altOf.toLowerCase()) {
          await button.update({ content: 'Alt must belong to your registered main.', components: [] });
          return;
        }

        await supabase.from('Alts').insert({ player_id: player.id, character_name: character });
        await updateGearScore(supabase, character, gearScore, player.id);

        const { data: alts } = await supabase
          .from('Alts')
          .select('character_name')
          .eq('player_id', player.id);

        const charList = [player.main_character, ...(alts?.map((a) => a.character_name) ?? [])];

        const embed = new EmbedBuilder()
          .setTitle('Registered Characters')
          .setColor(color)
          .setDescription(charList.join('\n'));

        await button.update({ embeds: [embed], components: [] });
      }
    } catch {
      await interaction.editReply({ content: 'Registration timed out.', components: [], embeds: [] });
    }
  }
  };

export default command;
