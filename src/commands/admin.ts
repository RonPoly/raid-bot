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
    await interaction.deferReply({ ephemeral: true });
    if (sub === 'pingdb') {
      const { error } = await supabase.rpc('version');
      if (error) {
        await interaction.editReply({ content: `Database error: ${error.message}` });
      } else {
        await interaction.editReply({ content: 'Database connection OK.' });
      }
    }
  }
};

export default command;
