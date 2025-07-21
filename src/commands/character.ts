import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ComponentType,
} from 'discord.js';
import { supabase } from '../supabaseClient';
import { fetchCharacterSummary } from '../utils/warmane-api';
import { calculateGearScore } from '../gearscore-calculator';
import { Command } from '../types';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('character')
    .setDescription('Manage your registered characters.')
    .addSubcommand((sub) =>
      sub.setName('view').setDescription('View all your registered characters.')
    )
    .addSubcommand((sub) =>
      sub
        .setName('delete')
        .setDescription('Delete one of your registered characters.')
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'view') {
      await handleView(interaction);
    } else if (sub === 'delete') {
      await handleDelete(interaction);
    }
  },
};

export default command;

async function handleView(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const { data: characters, error } = await supabase
    .from('players')
    .select('character_name, realm')
    .eq('discord_id', interaction.user.id)
    .eq('guild_id', interaction.guildId ?? '');

  if (error || !characters || characters.length === 0) {
    await interaction.editReply({
      content: 'You have no characters registered in this server.',
    });
    return;
  }

  const results = await Promise.all(
    characters.map(async (c) => {
      try {
        const summary = await fetchCharacterSummary(c.character_name, c.realm);
        if ((summary as any).error) {
          return `• **${c.character_name}** (${c.realm}) - **Not Found**`;
        }
        const gs = calculateGearScore(summary.equipment);
        return `• **${c.character_name}** (${c.realm}) - GS: **${gs}**`;
      } catch {
        return `• **${c.character_name}** (${c.realm}) - **Not Found**`;
      }
    })
  );

  await interaction.editReply({ content: results.join('\n') });
}

async function handleDelete(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const { data: characters, error } = await supabase
    .from('players')
    .select('id, character_name, realm')
    .eq('discord_id', interaction.user.id)
    .eq('guild_id', interaction.guildId ?? '');

  if (error || !characters || characters.length === 0) {
    await interaction.editReply({
      content: 'You have no characters registered in this server.',
    });
    return;
  }

  const options = characters.map((c) =>
    new StringSelectMenuOptionBuilder()
      .setLabel(`${c.character_name} (${c.realm})`)
      .setValue(c.id)
  );

  const menu = new StringSelectMenuBuilder()
    .setCustomId('character_delete')
    .setPlaceholder('Select a character to delete.')
    .addOptions(options);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);

  const message = await interaction.editReply({
    content: 'Select a character to delete.',
    components: [row],
  });

  try {
    const selection = await message.awaitMessageComponent({
      componentType: ComponentType.StringSelect,
      filter: (i) => i.user.id === interaction.user.id,
      time: 60_000,
    });

    const id = selection.values[0];
    await supabase.from('players').delete().eq('id', id);

    await selection.update({
      content: 'Character deleted.',
      components: [],
    });
  } catch {
    await interaction.editReply({
      content: 'No selection received. Deletion cancelled.',
      components: [],
    });
  }
}
