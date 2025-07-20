import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { SupabaseClient } from '@supabase/supabase-js';
import { Command } from '../types';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('raid')
    .setDescription('Raid management')
    .addSubcommand((sub) =>
      sub.setName('create')
        .setDescription('Create a raid event')
        .addStringOption((opt) => opt.setName('title').setDescription('Raid title').setRequired(true))
        .addStringOption((opt) => opt.setName('instance').setDescription('Instance, e.g., ICC25').setRequired(true))
        .addStringOption((opt) => opt.setName('date').setDescription('YYYY-MM-DD HH:mm').setRequired(true))
        .addIntegerOption((opt) => opt.setName('min_gs').setDescription('Minimum GS').setRequired(false))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction: ChatInputCommandInteraction, supabase: SupabaseClient) {
    if (!interaction.isChatInputCommand() || interaction.options.getSubcommand() !== 'create') {
      await interaction.reply({ content: 'Unsupported subcommand', ephemeral: true });
      return;
    }

    const title = interaction.options.getString('title', true);
    const instance = interaction.options.getString('instance', true);
    const date = interaction.options.getString('date', true);
    const minGs = interaction.options.getInteger('min_gs') ?? 5500;

    await supabase.from('Raids').insert({
      title,
      instance,
      scheduled_date: date,
      min_gearscore: minGs,
      raid_leader_id: null
    });

    await interaction.reply({ content: `Raid ${title} created for ${date}.`, ephemeral: true });
  }
};

export default command;
