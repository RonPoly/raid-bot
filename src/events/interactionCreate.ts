import { Client, Events, MessageFlags, InteractionReplyOptions } from 'discord.js';
import { SupabaseClient } from '@supabase/supabase-js';
import { Command } from '../types';
import { handleRegisterModal } from '../commands/register';
import {
  handleRaidSignupButton,
  handleRaidLeaveButton,
  handleRaidRoleSelect,
  handleRaidCharacterSelect,
} from '../utils/button-handlers';
import { handleGsSelectMenu } from '../commands/gearscore';
import { logError } from '../utils/logger';

export default function registerInteractionCreate(client: Client, commands: Map<string, Command>, supabase: SupabaseClient) {
  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction, supabase);
      } catch (err) {
        logError(err);
        const errorMessage: InteractionReplyOptions = {
          content: 'There was an error while executing this command!',
          flags: MessageFlags.Ephemeral,
        };
        try {
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMessage);
          } else {
            await interaction.reply(errorMessage);
          }
        } catch (e) {
          logError(e);
        }
      }
    } else if (interaction.isModalSubmit()) {
      if (interaction.customId === 'register_modal') {
        await handleRegisterModal(interaction, supabase);
      }
    } else if (interaction.isButton()) {
      if (interaction.customId.startsWith('raid-signup:')) {
        await handleRaidSignupButton(interaction, supabase);
      } else if (interaction.customId.startsWith('raid-leave:')) {
        await handleRaidLeaveButton(interaction, supabase);
      }
    } else if (interaction.isStringSelectMenu()) {
      if (interaction.customId.startsWith('raid-role-select:')) {
        await handleRaidRoleSelect(interaction, supabase);
      } else if (interaction.customId.startsWith('raid-char-select:')) {
        await handleRaidCharacterSelect(interaction, supabase);
      } else if (interaction.customId === 'gs-select') {
        await handleGsSelectMenu(interaction, supabase);
      }
    }
  });
}
