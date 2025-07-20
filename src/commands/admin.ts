import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { SupabaseClient } from '@supabase/supabase-js';
import { Command } from '../types';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('Admin utilities')
    .addSubcommand((sub) =>
      sub.setName('pingdb').setDescription('Check database connection')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction: ChatInputCommandInteraction, supabase: SupabaseClient) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'pingdb') {
      const { error } = await supabase.rpc('version');
      if (error) {
        await interaction.reply({ content: `Database error: ${error.message}`, ephemeral: true });
      } else {
        await interaction.reply({ content: 'Database connection OK.', ephemeral: true });
      }
    }
  }
};

export default command;
