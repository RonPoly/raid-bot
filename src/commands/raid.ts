import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalSubmitInteraction,
  TextChannel,
  GuildMember,
  ChannelType,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
} from 'discord.js';
import { SupabaseClient } from '@supabase/supabase-js';
import { Command, Raid } from '../types';
import { buildRaidEmbed } from '../utils/embed-builder';
import { requireGuildConfig, getGuildConfig } from '../utils/guild-config';

interface RaidOption {
  label: string;
  description: string;
  value: string;
  tanks: number;
  healers: number;
  dps: number;
  minGs: number;
}

const RAID_OPTIONS: RaidOption[] = [
  {
    label: 'ICC 10',
    description: '10 players: 2 tanks, 2-3 healers, 5-6 dps',
    value: 'ICC10',
    tanks: 2,
    healers: 3,
    dps: 5,
    minGs: 5800,
  },
  {
    label: 'ICC 25',
    description: '25 players: 2 tanks, 5-6 healers, 17-18 dps',
    value: 'ICC25',
    tanks: 2,
    healers: 6,
    dps: 17,
    minGs: 5800,
  },
  {
    label: 'RS 10',
    description: '10 players: 1 tank, 2-3 healers, 6-7 dps',
    value: 'RS10',
    tanks: 1,
    healers: 3,
    dps: 6,
    minGs: 5500,
  },
  {
    label: 'RS 25',
    description: '25 players: 1 tank, 5-6 healers, 18-19 dps',
    value: 'RS25',
    tanks: 1,
    healers: 6,
    dps: 18,
    minGs: 5500,
  },
  {
    label: 'TOC 10',
    description: '10 players: 2 tanks, 2-3 healers, 5-6 dps',
    value: 'TOC10',
    tanks: 2,
    healers: 3,
    dps: 5,
    minGs: 5200,
  },
  {
    label: 'TOC 25',
    description: '25 players: 2 tanks, 5-6 healers, 17-18 dps',
    value: 'TOC25',
    tanks: 2,
    healers: 6,
    dps: 17,
    minGs: 5200,
  },
  {
    label: 'Ulduar 10',
    description: '10 players: 2 tanks, 2-3 healers, 5-6 dps',
    value: 'Ulduar10',
    tanks: 2,
    healers: 3,
    dps: 5,
    minGs: 4800,
  },
  {
    label: 'Ulduar 25',
    description: '25 players: 2 tanks, 5-6 healers, 17-18 dps',
    value: 'Ulduar25',
    tanks: 2,
    healers: 6,
    dps: 17,
    minGs: 4800,
  },
  {
    label: 'VoA 10',
    description: '10 players: 1 tank, 2 healers, 7 dps',
    value: 'VoA10',
    tanks: 1,
    healers: 2,
    dps: 7,
    minGs: 4500,
  },
  {
    label: 'VoA 25',
    description: '25 players: 1 tank, 5 healers, 19 dps',
    value: 'VoA25',
    tanks: 1,
    healers: 5,
    dps: 19,
    minGs: 4500,
  },
];

const CREATE_MODAL_ID = 'raid-create-modal';
const INSTANCE_SELECT_ID = 'raid-instance-select';
const SIGNUP_ID = (raidId: string) => `raid-signup:${raidId}`;
const LEAVE_ID = (raidId: string) => `raid-leave:${raidId}`;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('raid')
    .setDescription('Raid management')
    .addSubcommand((sub) =>
      sub.setName('create').setDescription('Create a raid event')
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('List upcoming raids')
    )
    .addSubcommand((sub) =>
      sub
        .setName('cancel')
        .setDescription('Cancel a raid')
        .addStringOption((opt) =>
          opt.setName('id').setDescription('Raid ID').setRequired(true)
        )
    ),
  async execute(interaction: ChatInputCommandInteraction, supabase: SupabaseClient) {
    const sub = interaction.options.getSubcommand();
    const config = await requireGuildConfig(interaction);
    if (!config) return;

    await interaction.deferReply({ ephemeral: true });

    if (sub === 'create') {
      const member = interaction.member as GuildMember;
      const officerRoleId = config.officer_role_id || '';
      if (!officerRoleId || !member?.roles?.cache?.has(officerRoleId)) {
        await interaction.editReply({ content: 'Missing permission.' });
        return;
      }

      const { data: templates } = await supabase
        .from('raid_templates')
        .select('*')
        .eq('guild_id', interaction.guildId || '');

      const menu = new StringSelectMenuBuilder()
        .setCustomId(INSTANCE_SELECT_ID)
        .setPlaceholder('Select raid instance')
        .addOptions(
          RAID_OPTIONS.map((o) => ({
            label: o.label,
            value: o.value,
            description: o.description,
          }))
        );

      if (templates && templates.length > 0) {
        for (const t of templates) {
          menu.addOptions({ label: t.name, value: `template:${t.id}`, description: t.instance });
        }
      }
      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
      await interaction.editReply({ content: 'Choose raid instance:', components: [row] });
    } else if (sub === 'list') {
      const now = new Date().toISOString();
      const { data: raids } = await supabase
        .from('raids')
        .select('*')
        .gt('scheduled_date', now)
        .order('scheduled_date', { ascending: true });

      if (!raids || raids.length === 0) {
        await interaction.editReply({ content: 'No raids scheduled.' });
        return;
      }

      const embed = new EmbedBuilder().setTitle('Upcoming Raids');
      for (const raid of raids as Raid[]) {
        const { data: signups } = await supabase
          .from('raid_signups')
          .select('id')
          .eq('raid_id', raid.id);
        const count = signups?.length ?? 0;
        const total = raid.tank_slots + raid.healer_slots + raid.dps_slots;
        embed.addFields({
          name: `${raid.title} - ${raid.instance}`,
          value: `Date: ${raid.scheduled_date}\nSignups: ${count}/${total}\nID: ${raid.id}`,
        });
      }
      await interaction.editReply({ embeds: [embed] });
    } else if (sub === 'cancel') {
      const member = interaction.member as GuildMember;
      const officerRoleId = config?.officer_role_id || '';
      if (!officerRoleId || !member?.roles?.cache?.has(officerRoleId)) {
        await interaction.editReply({ content: 'Missing permission.' });
        return;
      }

      const id = interaction.options.getString('id', true);
      const { data: raid } = await supabase
        .from('raids')
        .delete()
        .eq('id', id)
        .select('signup_message_id')
        .maybeSingle();

      if (!raid) {
        await interaction.editReply({ content: 'Raid not found.' });
        return;
      }

      if (raid.signup_message_id) {
        try {
          const chan = interaction.guild?.channels.cache.get(config.raid_channel_id || '') as TextChannel | undefined;
          if (chan) {
            const msg = await chan.messages.fetch(raid.signup_message_id);
            await msg.delete();
          }
        } catch {}
      }

      await interaction.editReply({ content: 'Raid cancelled.' });
    }
  }
};

export async function handleRaidInstanceSelect(
  interaction: StringSelectMenuInteraction,
  supabase: SupabaseClient
) {
  let option = RAID_OPTIONS.find((o) => o.value === interaction.values[0]);

  if (!option && interaction.values[0].startsWith('template:')) {
    const id = interaction.values[0].split(':')[1];
    const { data } = await supabase.from('raid_templates').select('*').eq('id', id).maybeSingle();
    if (data) {
      option = {
        label: data.instance,
        description: data.name,
        value: `template:${id}`,
        tanks: data.tank_slots,
        healers: data.healer_slots,
        dps: data.dps_slots,
        minGs: data.min_gearscore
      };
    }
  }

  if (!option) {
    await interaction.reply({ content: 'Invalid raid selection.', ephemeral: true });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`${CREATE_MODAL_ID}:${option.value}`)
    .setTitle('Create Raid')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('title')
          .setLabel('Raid Title')
          .setStyle(TextInputStyle.Short)
          .setRequired(true),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('datetime')
          .setLabel('Enter date and time (e.g., Saturday 8pm ST or 2024-01-20 20:00)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('min_gs')
          .setLabel('Minimum GearScore')
          .setStyle(TextInputStyle.Short)
          .setValue(String(option.minGs))
          .setRequired(true),
      ),
    );

  await interaction.showModal(modal);
}

export async function handleRaidCreateModal(
  interaction: ModalSubmitInteraction,
  supabase: SupabaseClient
) {
  const config = await getGuildConfig(interaction.guildId ?? '');
  if (!config || !config.raid_channel_id) {
    await interaction.reply({ content: 'Guild is not fully configured.', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const [, raidValue] = interaction.customId.split(':');
  const option = RAID_OPTIONS.find((o) => o.value === raidValue);
  if (!option) {
    await interaction.editReply({ content: 'Invalid raid type.' });
    return;
  }

  const title = interaction.fields.getTextInputValue('title');
  const date = interaction.fields.getTextInputValue('datetime');
  const minGsInput = parseInt(interaction.fields.getTextInputValue('min_gs'), 10);
  const minGs = isNaN(minGsInput) ? option.minGs : minGsInput;
  const tankSlots = option.tanks;
  const healerSlots = option.healers;
  const dpsSlots = option.dps;

  let raidLeaderId: string | null = null;
  const { data: player } = await supabase
    .from('players')
    .select('id')
    .eq('discord_id', interaction.user.id)
    .maybeSingle();
  if (player) raidLeaderId = player.id;

  const { data: raid } = await supabase
    .from('raids')
    .insert({
      title,
      instance: option.label,
      scheduled_date: date,
      tank_slots: tankSlots,
      healer_slots: healerSlots,
      dps_slots: dpsSlots,
      min_gearscore: minGs,
      raid_leader_id: raidLeaderId
    })
    .select('*')
    .single();

  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(SIGNUP_ID(raid.id))
      .setLabel('Sign Up')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(LEAVE_ID(raid.id))
      .setLabel('Leave')
      .setStyle(ButtonStyle.Secondary)
  );

  const embed = buildRaidEmbed(raid as Raid, [], config.warmane_realm, []);
  const channel = interaction.guild?.channels.cache.get(config.raid_channel_id) as TextChannel | undefined;
  if (!channel || channel.type !== ChannelType.GuildText) {
    await interaction.editReply({ content: 'Raid channel not found.' });
    return;
  }
  const msg = await channel.send({ embeds: [embed], components: [buttons] });

  await supabase.from('raids').update({ signup_message_id: msg.id }).eq('id', raid.id);

  await interaction.editReply({ content: 'Raid created.' });
}


export default command;
