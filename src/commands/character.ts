import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ComponentType,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  Interaction,
} from 'discord.js';
import { supabase } from '../supabaseClient';
import { Command } from '../types';
import { requireGuildConfig } from '../utils/guild-config';
import { fetchCharacterSummary } from '../utils/warmane-api';
import { calculateGearScore } from '../gearscore-calculator';

// --- Custom IDs for our components ---
const CHARACTER_SELECT_ID = 'character_management_select';
const SET_MAIN_BUTTON_ID = 'character_management_set_main';
const DELETE_BUTTON_ID = 'character_management_delete';
const ARMORY_BUTTON_ID = 'character_management_armory';
const REGISTER_BUTTON_ID = 'character_management_register';
const REFRESH_GS_BUTTON_ID = 'character_management_refresh_gs';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('character')
    .setDescription('View and manage your registered characters.'),

  async execute(interaction: ChatInputCommandInteraction) {
    // We make the initial reply ephemeral. All subsequent messages will be ephemeral edits or follow-ups.
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const config = await requireGuildConfig(interaction);
    if (!config) {
      // requireGuildConfig already sends a reply, so we just return.
      return;
    }

    const generateCharacterEmbed = async (userId: string, guildId: string) => {
      const { data: characters, error } = await supabase
        .from('players')
        .select('id, character_name, realm, gear_score, is_main')
        .eq('discord_id', userId)
        .eq('guild_id', guildId);

      if (error || !characters || characters.length === 0) {
        return null;
      }

      const description = characters
        .map(c => {
          const mainIndicator = c.is_main ? '⭐ **(Main)**' : '';
          const gs = c.gear_score ? `${c.gear_score} GS` : 'GS not set';
          return `• **${c.character_name}** (${c.realm}) - ${gs} ${mainIndicator}`;
        })
        .join('\n');

      return new EmbedBuilder()
        .setTitle(`${interaction.user.username}'s Characters`)
        .setDescription(description || 'You have no characters registered.')
        .setColor('#0099ff')
        .setFooter({ text: 'Select a character from the dropdown to manage them.' });
    };

    const embed = await generateCharacterEmbed(interaction.user.id, interaction.guildId!);

    // Handle case where user has no characters
    if (!embed) {
      const registerButton = new ButtonBuilder()
        .setCustomId(REGISTER_BUTTON_ID)
        .setLabel('Register a Character')
        .setStyle(ButtonStyle.Success);
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(registerButton);

      await interaction.editReply({
        content: 'You have no characters registered yet. Use the button below or the `/register` command to add one!',
        components: [row],
      });

      // Listen for the register button click
      const buttonInteraction = await interaction.channel?.awaitMessageComponent({
          filter: i => i.customId === REGISTER_BUTTON_ID && i.user.id === interaction.user.id,
          componentType: ComponentType.Button,
          time: 60000,
      }).catch(() => null);

      if (buttonInteraction) {
          await buttonInteraction.reply({
              content: "Please use the `/register` command to add a new character.",
              flags: MessageFlags.Ephemeral
          });
      }
      await interaction.editReply({ components: [] }); // Clean up initial message
      return;
    }

    // --- Build Components for users with characters ---
    const { data: characters } = await supabase.from('players').select('id, character_name').eq('discord_id', interaction.user.id).eq('guild_id', interaction.guildId!);

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(CHARACTER_SELECT_ID)
      .setPlaceholder('Select a character to manage...')
      .addOptions(
        (characters || []).map(c =>
          new StringSelectMenuOptionBuilder()
            .setLabel(c.character_name)
            .setValue(c.id)
        )
      );

    const armoryButton = new ButtonBuilder()
      .setLabel('View on Armory')
      .setStyle(ButtonStyle.Link)
      .setDisabled(true)
      .setURL('https://warmane.com'); // URL is a placeholder

    const actionButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(SET_MAIN_BUTTON_ID)
        .setLabel('Set as Main')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(DELETE_BUTTON_ID)
        .setLabel('Delete')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(true),
      armoryButton,
      new ButtonBuilder()
        .setCustomId(REFRESH_GS_BUTTON_ID)
        .setLabel('Refresh GS')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
    );

    const mainRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
    const message = await interaction.editReply({ embeds: [embed], components: [mainRow, actionButtons] });

    // --- Collector to handle interactions ---
    const collector = message.createMessageComponentCollector({
      filter: (i: Interaction) => i.user.id === interaction.user.id,
      time: 120_000, // 2 minutes
    });

    let selectedCharacterId: string | null = null;
    let selectedCharacterName: string | null = null;

    collector.on('collect', async i => {
      // --- Handle Select Menu ---
      if (i.isStringSelectMenu() && i.customId === CHARACTER_SELECT_ID) {
        await i.deferUpdate();
        selectedCharacterId = i.values[0];
        const selected = characters?.find(c => c.id === selectedCharacterId);
        selectedCharacterName = selected?.character_name || null;

        // Re-enable buttons and set Armory URL
        actionButtons.components.forEach(button => button.setDisabled(false));
        if (selectedCharacterName) {
            const armoryUrl = `https://armory.warmane.com/character/${encodeURIComponent(selectedCharacterName)}/${encodeURIComponent(config.warmane_realm)}`;
            armoryButton.setURL(armoryUrl);
        }
        await interaction.editReply({ components: [mainRow, actionButtons] });
      }

      // --- Handle "Set as Main" Button ---
      if (i.isButton() && i.customId === SET_MAIN_BUTTON_ID) {
        await i.deferUpdate();
        // Transaction to set main
        await supabase.rpc('set_main_character', {
            p_discord_id: interaction.user.id,
            p_guild_id: interaction.guildId,
            p_character_id: selectedCharacterId
        });
        const updatedEmbed = await generateCharacterEmbed(interaction.user.id, interaction.guildId!);
        await interaction.editReply({ embeds: updatedEmbed ? [updatedEmbed] : [] });
      }

      // --- Handle "Delete" Button ---
      if (i.isButton() && i.customId === DELETE_BUTTON_ID) {
        await i.deferUpdate();
        await supabase.from('players').delete().eq('id', selectedCharacterId!);
        
        // Reset and refresh the interface
        selectedCharacterId = null;
        selectedCharacterName = null;
        const updatedEmbed = await generateCharacterEmbed(interaction.user.id, interaction.guildId!);
        if (!updatedEmbed) {
            collector.stop(); // Stop collector if no characters are left
            await interaction.editReply({ content: 'All characters have been deleted.', embeds: [], components: [] });
            return;
        }
        const { data: updatedChars } = await supabase.from('players').select('id, character_name').eq('discord_id', interaction.user.id).eq('guild_id', interaction.guildId!);
        selectMenu.setOptions((updatedChars || []).map(c => new StringSelectMenuOptionBuilder().setLabel(c.character_name).setValue(c.id)));
        actionButtons.components.forEach(button => button.setDisabled(true));
        
        await interaction.editReply({ embeds: [updatedEmbed], components: [mainRow, actionButtons] });
      }

      // --- Handle "Refresh GS" Button ---
      if (i.isButton() && i.customId === REFRESH_GS_BUTTON_ID) {
        await i.deferReply({ flags: MessageFlags.Ephemeral });
        try {
            const summary = await fetchCharacterSummary(selectedCharacterName!, config.warmane_realm);
            const gs = calculateGearScore(summary.equipment, summary.class);
            await supabase.from('players').update({ gear_score: gs }).eq('id', selectedCharacterId!);
            await i.editReply({ content: `GearScore for **${selectedCharacterName}** has been updated to **${gs}**.` });
            
            // Refresh the main embed
            const updatedEmbed = await generateCharacterEmbed(interaction.user.id, interaction.guildId!);
            if (updatedEmbed) {
              await interaction.editReply({ embeds: [updatedEmbed] });
            }

        } catch (err) {
            await i.editReply({ content: `Could not refresh GearScore for **${selectedCharacterName}**. The Warmane Armory might be down.` });
        }
      }
    });

    collector.on('end', () => {
      // Disable all components when the collector expires
      mainRow.components.forEach(c => c.setDisabled(true));
      actionButtons.components.forEach(c => c.setDisabled(true));
      interaction.editReply({ components: [mainRow, actionButtons] }).catch(() => {}); // Ignore errors if message was deleted
    });
  },
};

export default command;
