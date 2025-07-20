import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalSubmitInteraction,
  TextChannel
} from 'discord.js';
import { SupabaseClient } from '@supabase/supabase-js';
import { Command, Raid } from '../types';
import { buildRaidEmbed } from '../utils/embed-builder';

const CREATE_MODAL_ID = 'raid-create-modal';
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

    if (sub === 'create') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({ content: 'Missing permission.', ephemeral: true });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId(CREATE_MODAL_ID)
        .setTitle('Create Raid')
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('title')
              .setLabel('Raid Title')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          ),
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('instance')
              .setLabel('Instance')
              .setPlaceholder('ICC25, RS10, etc')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          ),
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('datetime')
              .setLabel('Date/Time')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          ),
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('tank_slots')
              .setLabel('Tank slots needed')
              .setStyle(TextInputStyle.Short)
              .setValue('2')
              .setRequired(true)
          ),
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('healer_slots')
              .setLabel('Healer slots needed')
              .setStyle(TextInputStyle.Short)
              .setValue('6')
              .setRequired(true)
          ),
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('dps_slots')
              .setLabel('DPS slots needed')
              .setStyle(TextInputStyle.Short)
              .setValue('17')
              .setRequired(true)
          )
        );
      await interaction.showModal(modal);
    } else if (sub === 'list') {
      const { data: raids } = await supabase
        .from('Raids')
        .select('id, title, instance, scheduled_date, status')
        .order('scheduled_date', { ascending: true });

      if (!raids || raids.length === 0) {
        await interaction.reply({ content: 'No raids scheduled.', ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder().setTitle('Upcoming Raids');
      for (const r of raids as Raid[]) {
        embed.addFields({ name: r.id, value: `${r.instance} - ${r.scheduled_date}` });
      }
      await interaction.reply({ embeds: [embed], ephemeral: true });
    } else if (sub === 'cancel') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({ content: 'Missing permission.', ephemeral: true });
        return;
      }

      const id = interaction.options.getString('id', true);
      const { data: raid } = await supabase
        .from('Raids')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .select('signup_message_id')
        .maybeSingle();

      if (!raid) {
        await interaction.reply({ content: 'Raid not found.', ephemeral: true });
        return;
      }

      if (raid.signup_message_id && interaction.channel) {
        try {
          const chan = interaction.channel as TextChannel;
          const msg = await chan.messages.fetch(raid.signup_message_id);
          await msg.edit({ content: 'Raid cancelled.', components: [] });
        } catch {}
      }

      await supabase.from('RaidSignups').delete().eq('raid_id', id);
      await interaction.reply({ content: 'Raid cancelled.', ephemeral: true });
    }
  }
};

export async function handleRaidCreateModal(
  interaction: ModalSubmitInteraction,
  supabase: SupabaseClient
) {
  const title = interaction.fields.getTextInputValue('title');
  const instance = interaction.fields.getTextInputValue('instance');
  const date = interaction.fields.getTextInputValue('datetime');
  const tankSlots = parseInt(interaction.fields.getTextInputValue('tank_slots'), 10) || 2;
  const healerSlots = parseInt(interaction.fields.getTextInputValue('healer_slots'), 10) || 6;
  const dpsSlots = parseInt(interaction.fields.getTextInputValue('dps_slots'), 10) || 17;

  let raidLeaderId: string | null = null;
  const { data: player } = await supabase
    .from('Players')
    .select('id')
    .eq('discord_id', interaction.user.id)
    .maybeSingle();
  if (player) raidLeaderId = player.id;

  const { data: raid } = await supabase
    .from('Raids')
    .insert({
      title,
      instance,
      scheduled_date: date,
      tank_slots: tankSlots,
      healer_slots: healerSlots,
      dps_slots: dpsSlots,
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

  const embed = buildRaidEmbed(raid as Raid);
  const channel = interaction.channel as TextChannel;
  const msg = await channel.send({ embeds: [embed], components: [buttons] });

  await supabase.from('Raids').update({ signup_message_id: msg.id }).eq('id', raid.id);

  await interaction.reply({ content: 'Raid created.', ephemeral: true });
}


export default command;
