import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SupabaseClient } from '@supabase/supabase-js';
import { Command } from '../types';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!'),
  async execute(interaction: ChatInputCommandInteraction, _supabase: SupabaseClient) {
    await interaction.reply('Pong!');
  }
};

export default command;
