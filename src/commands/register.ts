import {
  SlashCommandBuilder,
  ChatInputCommandInteraction
} from 'discord.js';
import { SupabaseClient } from '@supabase/supabase-js';
import { Command } from '../types';
import { requireGuildConfig } from '../utils/guild-config';
import { fetchCharacterSummary } from '../utils/warmane-api';
import { gearScoreCalculator } from '../utils/gearscore-calculator';
import { updateGearScore } from '../utils/database';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('register')
    .setDescription('Register a character')
    .addStringOption((opt) =>
      opt
        .setName('character')
        .setDescription('Character name (exact in-game spelling)')
        .setRequired(true)
    ),
  async execute(interaction: ChatInputCommandInteraction, supabase: SupabaseClient) {
    const character = interaction.options.getString('character', true);
    const discordId = interaction.user.id;

    const config = await requireGuildConfig(interaction);
    if (!config) return;
    const realm = config.warmane_realm;

    // Prevent duplicate registration of the same character for this user
    const { data: existing } = await supabase
      .from('Players')
      .select('id')
      .eq('discord_id', discordId)
      .eq('main_character', character)
      .eq('realm', realm)
      .maybeSingle();

    if (existing) {
      await interaction.reply({
        content: `You already registered **${character}** on **${realm}**.`,
        ephemeral: true
      });
      return;
    }

    // Fetch character data from Warmane API
    let summary: any;
    try {
      summary = await fetchCharacterSummary(character, realm);
    } catch {
      await interaction.reply({ content: 'Character not found on Warmane.', ephemeral: true });
      return;
    }

    const gearScore = gearScoreCalculator.calculate(summary.equipment ?? []);

    const { data: inserted, error } = await supabase
      .from('Players')
      .insert({ discord_id: discordId, main_character: character, realm })
      .select('id')
      .single();

    if (!inserted || error) {
      await interaction.reply({ content: 'Failed to register character.', ephemeral: true });
      return;
    }

    await updateGearScore(supabase, character, gearScore, inserted.id);

    const armoryUrl = `https://armory.warmane.com/character/${encodeURIComponent(character)}/${encodeURIComponent(realm)}`;

    await interaction.reply({
      content: `Character [${character}](${armoryUrl}) on ${realm} has been registered successfully! Your GearScore is ${gearScore}.`,
      ephemeral: true
    });
  }
};

export default command;
