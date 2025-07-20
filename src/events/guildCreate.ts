import { Client, Events, Guild } from 'discord.js';
import { getGuildConfig } from '../utils/guild-config';
import { startRoleSyncTimer } from '../utils/role-sync';

const SYNC_INTERVAL_MINUTES = 3;

export default function registerGuildCreate(client: Client) {
  client.on(Events.GuildCreate, async (guild: Guild) => {
    try {
      if (guild.systemChannel) {
        await guild.systemChannel.send(
          'Thanks for inviting me! Server admins should run `/setup` to configure the bot.'
        );
      }
    } catch (err) {
      console.error('Failed to send welcome message:', err);
    }

    const config = await getGuildConfig(guild.id);
    if (config && config.warmane_guild_name && config.member_role_id) {
      startRoleSyncTimer(client, guild.id, SYNC_INTERVAL_MINUTES);
    }
  });
}
