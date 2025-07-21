import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember, MessageFlags } from 'discord.js';
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
      await interaction.reply({ content: 'Missing permission.', flags: MessageFlags.Ephemeral });
      return;
    }

    const last = cooldowns.get(interaction.guildId!);
    if (last && Date.now() - last < 5 * 60 * 1000) {
      await interaction.reply({ content: 'Sync recently performed. Try again later.', flags: MessageFlags.Ephemeral });
      return;
    }

    cooldowns.set(interaction.guildId!, Date.now());
    await interaction.reply({ content: 'Refreshing roster and syncing roles...', flags: MessageFlags.Ephemeral });

    await clearRosterCache(config.warmane_guild_name, config.warmane_realm);
    await syncGuildRoles(interaction.client, interaction.guildId!, true);

    await interaction.followUp({ content: 'Sync complete.', flags: MessageFlags.Ephemeral });
  }
};

export default command;
