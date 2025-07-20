import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { createClient } from '@supabase/supabase-js';

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Replies with Pong!');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.reply('Pong!');
}

export default { data, execute };
