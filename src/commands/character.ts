import { SlashCommandBuilder, ChatInputCommandInteraction, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType, StringSelectMenuOptionBuilder } from 'discord.js';
import { supabase } from '../supabaseClient';
import { Command } from '../types';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('character')
    .setDescription('Manage your registered characters.')
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('View all your registered characters.'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('Delete one of your registered characters.')),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    await interaction.deferReply({ ephemeral: true });

    if (subcommand === 'view') {
      await viewCharacters(interaction);
    } else if (subcommand === 'delete') {
      await deleteCharacter(interaction);
    }
  }
};
export default command;

async function viewCharacters(interaction: ChatInputCommandInteraction) {
  const discordId = interaction.user.id;
  const { data: characters, error } = await supabase
    .from('players')
    .select('character_name, realm')
    .eq('discord_id', discordId)
    .eq('guild_id', interaction.guildId ?? '');

  if (error) {
    await interaction.editReply({ content: 'There was an error fetching your characters.' });
    return;
  }
  if (!characters || characters.length === 0) {
    await interaction.editReply({ content: 'You have no characters registered.' });
    return;
  }

  const characterList = characters.map(c => `• **${c.character_name}** - *${c.realm}*`).join('\n');
  await interaction.editReply({ content: `**Your Registered Characters:**\n${characterList}` });
}

async function deleteCharacter(interaction: ChatInputCommandInteraction) {
  const discordId = interaction.user.id;
  const { data: characters, error } = await supabase
    .from('players')
    .select('id, character_name, realm')
    .eq('discord_id', discordId)
    .eq('guild_id', interaction.guildId ?? '');

  if (error || !characters || characters.length === 0) {
    await interaction.editReply({ content: 'You have no characters to delete.' });
    return;
  }

  const options = characters.map(char =>
    new StringSelectMenuOptionBuilder()
      .setLabel(`${char.character_name} (${char.realm})`)
      .setValue(char.id.toString())
  );

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('delete_character_menu')
    .setPlaceholder('Select a character to delete')
    .addOptions(options);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  const response = await interaction.editReply({
    content: 'Which character would you like to delete?',
    components: [row]
  });

  try {
    const confirmation = await response.awaitMessageComponent({
      filter: i => i.user.id === interaction.user.id && i.customId === 'delete_character_menu',
      time: 60_000,
      componentType: ComponentType.StringSelect
    });

    const characterIdToDelete = confirmation.values[0];
    const characterToDelete = characters.find(c => c.id.toString() === characterIdToDelete);

    const confirmButton = new ButtonBuilder()
      .setCustomId('confirm_delete')
      .setLabel('Confirm Delete')
      .setStyle(ButtonStyle.Danger);

    const cancelButton = new ButtonBuilder()
      .setCustomId('cancel_delete')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary);

    const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, cancelButton);

    await confirmation.update({
      content: `Are you sure you want to delete **${characterToDelete?.character_name}**? This cannot be undone.`,
      components: [buttonRow]
    });

    const buttonInteraction = await response.awaitMessageComponent({
      filter: i => i.user.id === interaction.user.id,
      time: 60_000
    });

    if (buttonInteraction.customId === 'confirm_delete') {
      await supabase.from('players').delete().eq('id', characterIdToDelete);
      await buttonInteraction.update({ content: `Successfully deleted character **${characterToDelete?.character_name}**.`, components: [] });
    } else if (buttonInteraction.customId === 'cancel_delete') {
      await buttonInteraction.update({ content: 'Deletion cancelled.', components: [] });
    }
  } catch (e) {
    await interaction.editReply({ content: 'Confirmation not received within 1 minute, cancelling.', components: [] });
  }
}
