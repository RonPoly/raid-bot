import { GuildMember } from 'discord.js';
import { fetchGuildMembers } from './warmane-api';

export async function syncMemberRoles(member: GuildMember, guildName: string, realm: string, memberRoleId: string) {
  try {
    const roster = await fetchGuildMembers(guildName, realm);
    const inGuild = roster.members.some((m: any) => m.name.toLowerCase() === member.displayName.toLowerCase());
    if (inGuild) {
      if (!member.roles.cache.has(memberRoleId)) {
        await member.roles.add(memberRoleId);
      }
    } else if (member.roles.cache.has(memberRoleId)) {
      await member.roles.remove(memberRoleId);
    }
  } catch (err) {
    console.error('Role sync error:', err);
  }
}
