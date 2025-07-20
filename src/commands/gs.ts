import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SupabaseClient } from '@supabase/supabase-js';
import { Command } from '../types';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('gs')
    .setDescription('Set or view your character GearScore')
    .addStringOption((opt) =>
      opt.setName('character').setDescription('Character name').setRequired(true)
    )
    .addIntegerOption((opt) =>
      opt.setName('score').setDescription('GearScore (3000-7000)').setRequired(true)
    ),
  async execute(interaction: ChatInputCommandInteraction, supabase: SupabaseClient) {
    const character = interaction.options.getString('character', true);
    const score = interaction.options.getInteger('score', true);

    if (score < 3000 || score > 7000) {
      await interaction.reply({ content: 'GearScore must be between 3000 and 7000.', ephemeral: true });
      return;
    }

    await supabase.from('GearScores').upsert({ character_name: character, gear_score: score, last_updated: new Date().toISOString() });
    await interaction.reply({ content: `Set GearScore of ${character} to ${score}.`, ephemeral: true });
  }
};

export default command;
