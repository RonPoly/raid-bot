import { Client, Events, ActivityType } from 'discord.js';

export default function registerReady(client: Client) {
  client.once(Events.ClientReady, async () => {
    console.log('Warmane Raid Bot is online!');
    if (client.user) {
      client.user.setPresence({ activities: [{ name: 'Managing raids', type: ActivityType.Playing }], status: 'online' });
    }
  });
}
