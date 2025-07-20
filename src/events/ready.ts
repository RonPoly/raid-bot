import { Client, Events, ActivityType } from 'discord.js';

export default function registerReady(client: Client) {
  const guildName = process.env.WARMANE_GUILD_NAME || '';

  client.once(Events.ClientReady, async () => {
    console.log('Warmane Raid Bot is online!');
    if (client.user) {
      const presence = guildName ? `Managing ${guildName} raids` : 'Managing raids';
      client.user.setPresence({
        activities: [{ name: presence, type: ActivityType.Playing }],
        status: 'online'
      });
    }
  });
}
