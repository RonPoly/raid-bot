import { Guild, GuildMember } from 'discord.js';
import { fetchGuildMembers } from './warmane-api';

export async function syncMemberRoles(
  member: GuildMember,
  guildName: string,
  realm: string,
  memberRoleId: string,
  roster?: any
) {
  try {
    const data = roster ?? (await fetchGuildMembers(guildName, realm));
    const inGuild = data.members.some(
      (m: any) => m.name.toLowerCase() === member.displayName.toLowerCase()
    );
    if (inGuild) {
      if (!member.roles.cache.has(memberRoleId)) {
        await member.roles.add(memberRoleId);
      }
    } else if (member.roles.cache.has(memberRoleId)) {
      await member.roles.remove(memberRoleId);
    }
  } catch (err: any) {
    if (err.status === 503) {
      console.warn('Warmane API unavailable; skipping role sync.');
    } else {
      console.error('Role sync error:', err);
    }
  }
}

export async function syncGuildRoles(
  guild: Guild,
  guildName: string,
  realm: string,
  memberRoleId: string
) {
  try {
    const roster = await fetchGuildMembers(guildName, realm);
    for (const [, member] of guild.members.cache) {
      await syncMemberRoles(member, guildName, realm, memberRoleId, roster);
    }
  } catch (err: any) {
    if (err.status === 503) {
      console.warn('Warmane API unavailable; skipping guild role sync.');
    } else {
      console.error('Guild role sync error:', err);
    }
  }
}
