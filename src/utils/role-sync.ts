import {
  Guild,
  GuildMember,
  ActivityType,
  PermissionsBitField
} from 'discord.js';
import { fetchGuildMembers } from './warmane-api';
import supabase from '../config/database';
import { getGuildConfig } from './guild-config';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

function normalize(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function isRateLimitError(err: any): boolean {
  if (!err) return false;
  return (
    err.status === 429 ||
    err.code === 429 ||
    /rate.*limit/i.test(err.message || '')
  );
}

async function addRoleWithRetry(
  member: GuildMember,
  roleId: string,
  attempts = 3
) {
  for (let i = 0; i < attempts; i++) {
    try {
      await member.roles.add(roleId);
      return;
    } catch (err: any) {
      if (isRateLimitError(err)) {
        const wait = Math.ceil(err.retry_after ? err.retry_after * 1000 : 5000);
        console.warn(`Rate limited when adding role. Retrying in ${wait}ms.`);
        await delay(wait);
        continue;
      }
      throw err;
    }
  }
  console.error(`Failed to add role to ${member.displayName} after retries.`);
}

async function removeRoleWithRetry(
  member: GuildMember,
  roleId: string,
  attempts = 3
) {
  for (let i = 0; i < attempts; i++) {
    try {
      await member.roles.remove(roleId);
      return;
    } catch (err: any) {
      if (isRateLimitError(err)) {
        const wait = Math.ceil(err.retry_after ? err.retry_after * 1000 : 5000);
        console.warn(`Rate limited when removing role. Retrying in ${wait}ms.`);
        await delay(wait);
        continue;
      }
      throw err;
    }
  }
  console.error(`Failed to remove role from ${member.displayName} after retries.`);
}

export async function syncMemberRoles(
  member: GuildMember,
  roster?: any
) {
  try {
    if (
      member.user.bot ||
      member.permissions.has(PermissionsBitField.Flags.Administrator)
    ) {
      return;
    }

    const config = await getGuildConfig(member.guild.id);
    if (!config || !config.warmane_guild_name || !config.member_role_id) {
      return;
    }

    const guildName = config.warmane_guild_name;
    const realm = config.warmane_realm;
    const memberRoleId = config.member_role_id;

    const data = roster ?? (await fetchGuildMembers(guildName, realm));
    const members = data.members ?? data.roster ?? [];

    const { data: player } = await supabase
      .from('Players')
      .select('id, main_character')
      .eq('discord_id', member.id)
      .maybeSingle();

    if (!player) {
      if (member.roles.cache.has(memberRoleId)) {
        console.log(`Removing member role from ${member.displayName}`);
        await removeRoleWithRetry(member, memberRoleId);
      }
      return;
    }

    const { data: alts } = await supabase
      .from('Alts')
      .select('character_name')
      .eq('player_id', player.id);

    const characters = [
      player.main_character,
      ...((alts?.map(a => a.character_name)) ?? [])
    ];

    const inGuild = members.some((m: any) =>
      characters.some(c => normalize(m.name) === normalize(c))
    );

    if (inGuild) {
      if (!member.roles.cache.has(memberRoleId)) {
        console.log(`Adding member role to ${member.displayName}`);
        await addRoleWithRetry(member, memberRoleId);
      }
    } else if (member.roles.cache.has(memberRoleId)) {
      console.log(`Removing member role from ${member.displayName}`);
      await removeRoleWithRetry(member, memberRoleId);
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
  guild: Guild
) {
  try {
    const config = await getGuildConfig(guild.id);
    if (!config || !config.warmane_guild_name || !config.member_role_id) {
      return;
    }

    const guildName = config.warmane_guild_name;
    const realm = config.warmane_realm;

    const roster = await fetchGuildMembers(guildName, realm);
    for (const [, member] of guild.members.cache) {
      await syncMemberRoles(member, roster);
    }

    const members = roster.members ?? roster.roster ?? [];
    const online = members.filter((m: any) => m.online).length;
    if (guild.client.user) {
      guild.client.user.setPresence({
        activities: [
          { name: `${online} guild members online`, type: ActivityType.Watching }
        ],
        status: 'online'
      });
    }
  } catch (err: any) {
    if (err.status === 503) {
      console.warn('Warmane API unavailable; skipping guild role sync.');
    } else {
      console.error('Guild role sync error:', err);
    }
  }
}
