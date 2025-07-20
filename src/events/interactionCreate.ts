import { Client, Events } from 'discord.js';
import { SupabaseClient } from '@supabase/supabase-js';
import { Command } from '../types';
import { handleRaidCreateModal, handleRaidSignupButton } from '../commands/raid';
import { handleGsSetSelectMenu } from '../commands/gs';

export default function registerInteractionCreate(client: Client, commands: Map<string, Command>, supabase: SupabaseClient) {
  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isChatInputCommand()) {
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
    } else if (interaction.isModalSubmit()) {
      if (interaction.customId === 'raid-create-modal') {
        await handleRaidCreateModal(interaction, supabase);
      }
    } else if (interaction.isButton()) {
      if (interaction.customId.startsWith('raid-signup:')) {
        await handleRaidSignupButton(interaction, supabase);
      }
    } else if (interaction.isStringSelectMenu()) {
      if (interaction.customId.startsWith('gs-set-select:')) {
        await handleGsSetSelectMenu(interaction, supabase);
      }
    }
  });
}
