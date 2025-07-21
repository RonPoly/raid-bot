import { Client, Events, GuildMember } from 'discord.js';

export default function registerGuildMemberUpdate(client: Client) {
  client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    // CRITICAL: Only sync if roles ACTUALLY changed
    const oldRoles = oldMember.roles.cache.map(r => r.id).sort();
    const newRoles = newMember.roles.cache.map(r => r.id).sort();

    // If roles didn't change, DO NOTHING
    if (JSON.stringify(oldRoles) === JSON.stringify(newRoles)) {
      return;
    }

    // DO NOT sync roles here - it causes infinite loops
    // Role sync should ONLY happen on the scheduled timer
    console.log(`Roles changed for ${newMember.displayName} - but NOT triggering sync to avoid loops`);
  });
}
