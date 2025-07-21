import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { SupabaseClient } from '@supabase/supabase-js';
import { Command } from '../types';
import { requireGuildConfig } from '../utils/guild-config';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('template')
    .setDescription('Manage raid templates')
    .addSubcommand(sub =>
      sub.setName('save').setDescription('Save a template')
        .addStringOption(o => o.setName('name').setDescription('Template name').setRequired(true))
        .addStringOption(o => o.setName('instance').setDescription('Instance').setRequired(true))
        .addIntegerOption(o => o.setName('tanks').setDescription('Tank slots').setRequired(true))
        .addIntegerOption(o => o.setName('healers').setDescription('Healer slots').setRequired(true))
        .addIntegerOption(o => o.setName('dps').setDescription('DPS slots').setRequired(true))
        .addIntegerOption(o => o.setName('mings').setDescription('Minimum GS').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('list').setDescription('List templates')
    ),
  async execute(interaction: ChatInputCommandInteraction, supabase: SupabaseClient) {
    const config = await requireGuildConfig(interaction);
    if (!config) return;

    const sub = interaction.options.getSubcommand();
    const member = interaction.member as GuildMember;
    const officerRoleId = config.officer_role_id || '';
    if (!officerRoleId || !member.roles.cache.has(officerRoleId)) {
      await interaction.reply({ content: 'Missing permission.', ephemeral: true });
      return;
    }

    if (sub === 'save') {
      const name = interaction.options.getString('name', true);
      const instance = interaction.options.getString('instance', true);
      const tanks = interaction.options.getInteger('tanks', true);
      const healers = interaction.options.getInteger('healers', true);
      const dps = interaction.options.getInteger('dps', true);
      const minGs = interaction.options.getInteger('mings', true);

      await supabase.from('raid_templates').upsert({
        guild_id: interaction.guildId!,
        name,
        instance,
        tank_slots: tanks,
        healer_slots: healers,
        dps_slots: dps,
        min_gearscore: minGs
      }, { onConflict: 'guild_id,name' });
      await interaction.reply({ content: 'Template saved.', ephemeral: true });
    } else {
      const { data } = await supabase
        .from('raid_templates')
        .select('*')
        .eq('guild_id', interaction.guildId!);
      if (!data || data.length === 0) {
        await interaction.reply({ content: 'No templates saved.', ephemeral: true });
        return;
      }
      const list = data.map(t => `**${t.name}** - ${t.instance}`).join('\n');
      await interaction.reply({ content: list, ephemeral: true });
    }
  }
};

export default command;
