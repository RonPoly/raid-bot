import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} from 'discord.js';
import { SupabaseClient } from '@supabase/supabase-js';
import { Command } from '../types';

const DELETE_SELECT_ID = 'character-delete-select';
const DELETE_CONFIRM_ID = 'character-delete-confirm';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('character')
    .setDescription('Manage your characters')
    .addSubcommand((sub) => sub.setName('view').setDescription('View your characters'))
    .addSubcommand((sub) => sub.setName('delete').setDescription('Delete a character')),
  async execute(interaction: ChatInputCommandInteraction, supabase: SupabaseClient) {
    const sub = interaction.options.getSubcommand();
    const discordId = interaction.user.id;

    if (sub === 'view') {
      const { data: chars } = await supabase
        .from('Players')
        .select('id, main_character, realm')
        .eq('discord_id', discordId);

      if (!chars || chars.length === 0) {
        await interaction.reply({ content: 'You have no registered characters.', ephemeral: true });
        return;
      }

      const list = chars.map(c => `* **${c.main_character}** - *${c.realm}*`).join('\n');
      await interaction.reply({ content: `Your Registered Characters:\n${list}`, ephemeral: true });
    } else if (sub === 'delete') {
      const { data: chars } = await supabase
        .from('Players')
        .select('id, main_character, realm')
        .eq('discord_id', discordId);

      if (!chars || chars.length === 0) {
        await interaction.reply({ content: 'You have no registered characters.', ephemeral: true });
        return;
      }

      const menu = new StringSelectMenuBuilder()
        .setCustomId(DELETE_SELECT_ID)
        .setPlaceholder('Select character')
        .addOptions(chars.map(c => ({
          label: `${c.main_character} (${c.realm})`,
          value: c.id
        })));

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
      const msg = await interaction.reply({ content: 'Choose a character to delete:', components: [row], ephemeral: true, fetchReply: true });

      try {
        const select = await msg.awaitMessageComponent({
          componentType: ComponentType.StringSelect,
          time: 30_000,
          filter: i => i.user.id === discordId
        });

        const charId = select.values[0];
        const chosen = chars.find(c => c.id === charId);
        if (!chosen) {
          await select.update({ content: 'Invalid selection.', components: [] });
          return;
        }

        const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(DELETE_CONFIRM_ID).setLabel('Confirm').setStyle(ButtonStyle.Danger)
        );
        const confirmMsg = await select.update({ content: `Delete ${chosen.main_character} on ${chosen.realm}?`, components: [confirmRow] });

        const btn = await confirmMsg.awaitMessageComponent({
          componentType: ComponentType.Button,
          time: 30_000,
          filter: i => i.user.id === discordId
        });

        if (btn.customId === DELETE_CONFIRM_ID) {
          await supabase.from('Players').delete().eq('id', charId);
          await btn.update({ content: `${chosen.main_character} has been deleted.`, components: [] });
        }
      } catch {
        await interaction.editReply({ content: 'Action timed out.', components: [] });
      }
    }
  }
};

export default command;

