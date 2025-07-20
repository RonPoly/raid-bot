import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
  DMChannel,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
} from 'discord.js';
import { SupabaseClient } from '@supabase/supabase-js';
import { Command } from '../types';
import { fetchGuildSummary } from '../utils/warmane-api';

const REALMS = ['Lordaeron', 'Icecrown', 'Frostmourne', 'Onyxia'];

async function ask(
  channel: DMChannel,
  userId: string,
  question: string,
  validate?: (input: string) => Promise<string | null> | string | null
): Promise<string> {
  while (true) {
    await channel.send(`${question} (type \`cancel\` to abort)`);
    const collected = await channel.awaitMessages({
      filter: (m) => m.author.id === userId,
      max: 1,
      time: 60_000,
    });

    const msg = collected.first();
    if (!msg) {
      await channel.send('Setup timed out.');
      throw new Error('cancel');
    }
    const content = msg.content.trim();
    if (content.toLowerCase() === 'cancel') {
      await channel.send('Setup cancelled.');
      throw new Error('cancel');
    }
    if (validate) {
      const result = await validate(content);
      if (result === null) {
        return content;
      }
      await channel.send(result);
      continue;
    }
    return content;
  }
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Server configuration')
    .addSubcommand((sub) =>
      sub.setName('run').setDescription('Run initial setup wizard')
    )
    .addSubcommand((sub) =>
      sub.setName('status').setDescription('Show current configuration')
    ),
  async execute(interaction: ChatInputCommandInteraction, supabase: SupabaseClient) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'status') {
      const guildId = interaction.guild.id;
      const { data: config } = await supabase
        .from('guild_configs')
        .select('*')
        .eq('discord_guild_id', guildId)
        .maybeSingle();

      if (!config || !config.setup_complete) {
        await interaction.reply({
          content: 'Not configured. Run /setup to configure.',
          ephemeral: true
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('Guild Configuration')
        .addFields(
          { name: 'Guild', value: config.warmane_guild_name, inline: true },
          { name: 'Realm', value: config.warmane_realm, inline: true },
          { name: 'Member Role ID', value: config.member_role_id ?? 'None', inline: true },
          { name: 'Officer Role ID', value: config.officer_role_id ?? 'None', inline: true },
          { name: 'Raid Channel ID', value: config.raid_channel_id ?? 'None', inline: true }
        );

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // run subcommand
    const guildId = interaction.guild.id;
    const { data: existing } = await supabase
      .from('guild_configs')
      .select('*')
      .eq('discord_guild_id', guildId)
      .maybeSingle();

    if (existing && existing.setup_complete) {
      await interaction.reply({ content: 'Setup already completed for this server.', ephemeral: true });
      return;
    }

    await interaction.reply({ content: 'Check your DMs to continue setup.', ephemeral: true });
    const dm = await interaction.user.createDM();

    try {
      let guildName = '';
      let realm = '';
      while (true) {
        guildName = await ask(dm, interaction.user.id, 'What is your Warmane guild name? (Must be spelled exactly as in-game)');
        realm = await ask(dm, interaction.user.id, 'What realm is your guild on? (Options: Lordaeron, Icecrown, Frostmourne, Onyxia)', (input) => {
          const match = REALMS.find(r => r.toLowerCase() === input.toLowerCase());
          return match ? null : 'Invalid realm. Please choose from the listed options.';
        });
        const realmFormatted = REALMS.find(r => r.toLowerCase() === realm.toLowerCase()) || realm;
        try {
          const summary = await fetchGuildSummary(guildName, realmFormatted);
          realm = realmFormatted;
          await dm.send(`Found guild **${summary.name}** on ${summary.realm} with ${summary.membercount} members.`);
          break;
        } catch {
          await dm.send(`Could not find guild '${guildName}' on ${realmFormatted}. Please check spelling and try again.`);
        }
      }

      const allRoles = await interaction.guild!.roles.fetch();
      const selectableRoles = allRoles
        .filter((r) => !r.managed && r.id !== interaction.guild!.id)
        .map((r) => ({ label: r.name, value: r.id }))
        .slice(0, 25);

      const memberMenu = new StringSelectMenuBuilder()
        .setCustomId('setup-member-role')
        .setPlaceholder('Select a role')
        .addOptions(selectableRoles);
      const memberRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(memberMenu);
      await dm.send({ content: 'Please select the role for guild members.', components: [memberRow] });
      const memberSelect = await dm.awaitMessageComponent({
        componentType: ComponentType.StringSelect,
        filter: (i) => i.customId === 'setup-member-role' && i.user.id === interaction.user.id,
        time: 60_000,
      });
      const memberRoleId = memberSelect.values[0];
      await memberSelect.update({ content: `Selected <@&${memberRoleId}>`, components: [] });

      const officerMenu = new StringSelectMenuBuilder()
        .setCustomId('setup-officer-role')
        .setPlaceholder('Select a role')
        .addOptions(selectableRoles);
      const officerRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(officerMenu);
      await dm.send({ content: 'Please select the role for officers.', components: [officerRow] });
      const officerSelect = await dm.awaitMessageComponent({
        componentType: ComponentType.StringSelect,
        filter: (i) => i.customId === 'setup-officer-role' && i.user.id === interaction.user.id,
        time: 60_000,
      });
      const officerRoleId = officerSelect.values[0];
      await officerSelect.update({ content: `Selected <@&${officerRoleId}>`, components: [] });

      const raidChannelId = await ask(dm, interaction.user.id, 'Please # mention the channel for raid signups', (input) => {
        const match = input.match(/<#(\d+)>/);
        if (!match) return 'Please mention a channel.';
        const chan = interaction.guild!.channels.cache.get(match[1]);
        return chan && chan.type === ChannelType.GuildText ? null : 'Channel not found or not text channel.';
      }).then(res => res.match(/<#(\d+)>/)![1]);

      await supabase.from('guild_configs').upsert({
        discord_guild_id: guildId,
        warmane_guild_name: guildName,
        warmane_realm: realm,
        member_role_id: memberRoleId,
        officer_role_id: officerRoleId,
        raid_channel_id: raidChannelId,
        setup_complete: true,
        setup_by_user_id: interaction.user.id
      });

      const embed = new EmbedBuilder()
        .setTitle('Setup Complete')
        .addFields(
          { name: 'Guild', value: guildName, inline: true },
          { name: 'Realm', value: realm, inline: true },
          { name: 'Member Role', value: `<@&${memberRoleId}>`, inline: true },
          { name: 'Officer Role', value: `<@&${officerRoleId}>`, inline: true },
          { name: 'Signup Channel', value: `<#${raidChannelId}>`, inline: true }
        );

      await dm.send({ embeds: [embed] });
      await interaction.followUp({ content: 'Setup complete!', ephemeral: true });
    } catch {
      await dm.send('Setup aborted.');
    }
  }
};

export default command;
