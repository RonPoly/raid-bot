import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { SupabaseClient } from '@supabase/supabase-js';
import { Command } from '../types';
import { requireGuildConfig } from '../utils/guild-config';
import { fetchGuildMembers } from '../utils/warmane-api';
import { handleApiError } from '../utils/api-error-handler';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('roster')
    .setDescription('Show guild roster online status'),
  async execute(interaction: ChatInputCommandInteraction, supabase: SupabaseClient) {
    const config = await requireGuildConfig(interaction);
    if (!config) return;

    try {
      const data = await fetchGuildMembers(config.warmane_guild_name, config.warmane_realm);
      const members = data.members ?? data.roster ?? [];
      const online = members.filter((m: any) => m.online).map((m: any) => m.name);
      const offline = members.filter((m: any) => !m.online).map((m: any) => m.name);

      const embed = new EmbedBuilder()
        .setTitle(`${config.warmane_guild_name} Roster`)
        .addFields(
          { name: `Online (${online.length})`, value: online.join(', ') || 'None' },
          { name: `Offline (${offline.length})`, value: offline.slice(0, 20).join(', ') || 'None' }
        );

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } catch (err) {
      const msg = handleApiError(err as any);
      await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
    }
  }
};

export default command;
