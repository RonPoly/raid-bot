import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { SupabaseClient } from '@supabase/supabase-js';
import { Command } from '../types';
import { requireGuildConfig } from '../utils/guild-config';
import { clearRosterCache } from '../utils/warmane-api';
import { syncGuildRoles } from '../utils/role-sync';

const cooldowns = new Map<string, number>();

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('sync')
    .setDescription('Force roster refresh and role sync'),
  async execute(interaction: ChatInputCommandInteraction, _supabase: SupabaseClient) {
    const config = await requireGuildConfig(interaction);
    if (!config) return;

    const member = interaction.member as GuildMember;
    const officerRole = config.officer_role_id;
    if (!officerRole || !member.roles.cache.has(officerRole)) {
      await interaction.reply({ content: 'Missing permission.', ephemeral: true });
      return;
    }

    const last = cooldowns.get(interaction.guildId!);
    if (last && Date.now() - last < 5 * 60 * 1000) {
      await interaction.reply({ content: 'Sync recently performed. Try again later.', ephemeral: true });
      return;
    }

    cooldowns.set(interaction.guildId!, Date.now());
    await interaction.reply({ content: 'Refreshing roster and syncing roles...', ephemeral: true });

    await clearRosterCache(config.warmane_guild_name, config.warmane_realm);
    await syncGuildRoles(interaction.client, interaction.guildId!, true);

    await interaction.followUp({ content: 'Sync complete.', ephemeral: true });
  }
};

export default command;
