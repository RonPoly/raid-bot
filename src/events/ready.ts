import { Client, Events, ActivityType } from 'discord.js';
import { syncGuildRoles } from '../utils/role-sync';
import { getGuildConfig } from '../utils/guild-config';

const SYNC_INTERVAL_MINUTES = 3;

export default function registerReady(client: Client) {
  client.once(Events.ClientReady, async () => {
    console.log('Warmane Raid Bot is online!');
    for (const [, guild] of client.guilds.cache) {
      const config = await getGuildConfig(guild.id);
      if (!config) continue;

      if (client.user) {
        const presence = config.warmane_guild_name
          ? `Managing ${config.warmane_guild_name} raids`
          : 'Managing raids';
        client.user.setPresence({
          activities: [{ name: presence, type: ActivityType.Playing }],
          status: 'online'
        });
      }

      if (config.warmane_guild_name && config.member_role_id) {
        try {
          await guild.members.fetch();
          setInterval(async () => {
            await guild.members.fetch();
            await syncGuildRoles(guild);
          }, SYNC_INTERVAL_MINUTES * 60 * 1000);
        } catch (err) {
          console.error('Failed to start role sync scheduler:', err);
        }
      }
    }
  });
}
