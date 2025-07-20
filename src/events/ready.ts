import { Client, Events, ActivityType } from 'discord.js';
import { syncGuildRoles } from '../utils/role-sync';

export default function registerReady(client: Client) {
  client.once(Events.ClientReady, async () => {
    console.log('Warmane Raid Bot is online!');
    if (client.user) {
      client.user.setPresence({ activities: [{ name: 'Managing raids', type: ActivityType.Playing }], status: 'online' });
    }

    const guildId = process.env.GUILD_ID || '';
    const guildName = process.env.WARMANE_GUILD_NAME || '';
    const realm = process.env.WARMANE_REALM || 'Lordaeron';
    const memberRoleId = process.env.MEMBER_ROLE_ID || '';
    const interval = parseInt(process.env.SYNC_INTERVAL_MINUTES || '3', 10);

    if (guildId && guildName && memberRoleId) {
      try {
        const guild = await client.guilds.fetch(guildId);
        await guild.members.fetch();
        setInterval(async () => {
          await guild.members.fetch();
          await syncGuildRoles(guild, guildName, realm, memberRoleId);
        }, interval * 60 * 1000);
      } catch (err) {
        console.error('Failed to start role sync scheduler:', err);
      }
    }
  });
}
