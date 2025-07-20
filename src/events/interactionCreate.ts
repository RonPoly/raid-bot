import { Client, Events } from 'discord.js';
import { SupabaseClient } from '@supabase/supabase-js';
import { Command } from '../types';

export default function registerInteractionCreate(client: Client, commands: Map<string, Command>, supabase: SupabaseClient) {
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const command = commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction, supabase);
    } catch (err) {
      console.error('Command error:', err);
      if (!interaction.replied) {
        await interaction.reply({ content: 'An error occurred.', ephemeral: true });
      }
    }
  });
}
