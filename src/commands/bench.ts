import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { SupabaseClient } from '@supabase/supabase-js';
import { Command } from '../types';
import { requireGuildConfig } from '../utils/guild-config';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('bench')
    .setDescription('Bench a character for a raid')
    .addStringOption(opt => opt.setName('raid').setDescription('Raid ID').setRequired(true))
    .addStringOption(opt => opt.setName('character').setDescription('Character name').setRequired(true))
    .addBooleanOption(opt => opt.setName('remove').setDescription('Remove from bench')), 
  async execute(interaction: ChatInputCommandInteraction, supabase: SupabaseClient) {
    const config = await requireGuildConfig(interaction);
    if (!config) return;

    const member = interaction.member as GuildMember;
    const officerRoleId = config.officer_role_id || '';
    if (!officerRoleId || !member.roles.cache.has(officerRoleId)) {
      await interaction.reply({ content: 'Missing permission.', ephemeral: true });
      return;
    }

    const raidId = interaction.options.getString('raid', true);
    const charName = interaction.options.getString('character', true);
    const remove = interaction.options.getBoolean('remove') ?? false;

    const { data: signup } = await supabase
      .from('raid_signups')
      .select('*')
      .eq('raid_id', raidId)
      .eq('character_name', charName)
      .maybeSingle();

    if (!signup) {
      await interaction.reply({ content: 'Signup not found.', ephemeral: true });
      return;
    }

    await supabase
      .from('raid_signups')
      .update({ benched: !remove })
      .eq('id', signup.id);

    await interaction.reply({ content: remove ? 'Removed from bench.' : 'Benched.', ephemeral: true });
  }
};

export default command;
