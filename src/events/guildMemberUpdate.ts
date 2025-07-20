import { Client, Events } from 'discord.js';
import { syncMemberRoles } from '../utils/role-sync';
import { getGuildConfig } from '../utils/guild-config';

export default function registerGuildMemberUpdate(client: Client) {
  client.on(Events.GuildMemberUpdate, async (_, newMember) => {
    const config = await getGuildConfig(newMember.guild.id);
    if (!config || !config.warmane_guild_name || !config.member_role_id) return;
    await syncMemberRoles(newMember);
  });
}
