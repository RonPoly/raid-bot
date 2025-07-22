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
  TextChannel,
  GuildMember,
  StringSelectMenuBuilder,
  MessageComponentInteraction,
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
} from 'discord.js';
import { SupabaseClient } from '@supabase/supabase-js';
import { Command, Raid } from '../types';
import { buildRaidEmbed } from '../utils/embed-builder';
import { requireGuildConfig } from '../utils/guild-config';

// --- Static WOTLK Raid Options ---
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
  { label: 'Icecrown Citadel 10‑Man', description: 'ICC 10', value: 'ICC10', tanks: 2, healers: 3, dps: 5,  minGs: 5800 },
  { label: 'Icecrown Citadel 25‑Man', description: 'ICC 25', value: 'ICC25', tanks: 2, healers: 6, dps: 17, minGs: 5800 },
  { label: 'Ruby Sanctum 10‑Man',       description: 'RS 10',  value: 'RS10', tanks: 1, healers: 3, dps: 6,  minGs: 5500 },
  { label: 'Ruby Sanctum 25‑Man',       description: 'RS 25',  value: 'RS25', tanks: 1, healers: 6, dps: 18, minGs: 5500 },
  { label: 'Trial of the Crusader 10‑Man', description: 'TOC 10', value: 'TOC10', tanks: 2, healers: 3, dps: 5,  minGs: 5200 },
  { label: 'Trial of the Crusader 25‑Man', description: 'TOC 25', value: 'TOC25', tanks: 2, healers: 6, dps: 17, minGs: 5200 },
];

// --- Main Command Definition ---
const command: Command = {
  data: new SlashCommandBuilder()
    .setName('raid')
    .setDescription('Raid management')
    .addSubcommand(sub => sub.setName('create').setDescription('Create a new raid event with the interactive builder.'))
    .addSubcommand(sub => sub.setName('list')  .setDescription('List all upcoming raids.'))
    .addSubcommand(sub => sub.setName('cancel').setDescription('Cancel an upcoming raid.')
      .addStringOption(opt => opt.setName('id').setDescription('The ID of the raid to cancel.').setRequired(true))
    ),

  async execute(interaction: ChatInputCommandInteraction, supabase: SupabaseClient) {
    const sub = interaction.options.getSubcommand();
    const config = await requireGuildConfig(interaction);
    if (!config) return;

    if (sub !== 'create') {
      await interaction.deferReply({ ephemeral: true });
    }

    // --- Create Subcommand ---
    if (sub === 'create') {
      const member = interaction.member as GuildMember;
      if (!config.officer_role_id || !member.roles.cache.has(config.officer_role_id)) {
        await interaction.reply({ content: 'You do not have permission to create raids.', ephemeral: true });
        return;
      }

      const builderId = `raid-builder-${interaction.id}`;
      const raidState: Partial<{
        guild_id: string;
        title: string;
        instance: string;
        day: string;      // ISO date string
        time: string;     // e.g. "8:00 PM"
        tank_slots: number;
        healer_slots: number;
        dps_slots: number;
        min_gearscore: number;
        raid_leader_id: string | null;
        raid_leader_name: string;
      }> = {
        guild_id: interaction.guildId!,
        title: 'New Raid',
        raid_leader_id: null,
        raid_leader_name: 'Not Assigned',
        min_gearscore: 0,
      };

      const generateBuilderEmbed = () => new EmbedBuilder()
        .setTitle('📋 Interactive Raid Builder')
        .setColor('#5865F2')
        .setDescription('Use the components below to configure the raid. This embed will update with your selections.')
        .addFields(
          { name: '📝 Title',       value: raidState.title || 'Not Set',                   inline: true },
          { name: '👑 Raid Leader', value: raidState.raid_leader_name || 'Not Assigned', inline: true },
          { name: '📅 Date',        value: raidState.day && raidState.time
                                      ? `${raidState.day} at ${raidState.time}`
                                      : 'Not Set',
                                inline: true },
          { name: '🏰 Instance',    value: raidState.instance || 'Not Set',               inline: true },
          { name: '🛡️ Tanks',      value: String(raidState.tank_slots ?? '...'),       inline: true },
          { name: '🌿 Healers',    value: String(raidState.healer_slots ?? '...'),     inline: true },
          { name: '⚔️ DPS',        value: String(raidState.dps_slots ?? '...'),        inline: true },
          { name: '⚙️ Min. GS',    value: String(raidState.min_gearscore ?? 'Not Set'), inline: true },
        )
        .setFooter({ text: 'All fields must be set before you can create the raid.' });

      const checkCanCreate = () =>
        Boolean(
          raidState.title &&
          raidState.instance &&
          raidState.day &&
          raidState.time &&
          (raidState.min_gearscore ?? 0) > 0
        );

      const { data: templates, error: tplError } = await supabase
        .from('raid_templates')
        .select('*')
        .eq('guild_id', interaction.guildId!);
      if (tplError) console.error('Failed loading templates', tplError);

      const instanceOptions = RAID_OPTIONS.map(o => ({
        label: o.label, value: o.value, description: o.description,
      }));
      if (templates?.length) {
        instanceOptions.push(...templates.map(t => ({
          label: `Template: ${t.name}`,
          value: `template:${t.id}`,
          description: t.instance,
        })));
      }

      const getDayOptions = () => {
        const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        return Array.from({ length: 7 }, (_, i) => {
          const date = new Date();
          date.setDate(date.getDate() + i);
          const iso = date.toISOString().split('T')[0];      // YYYY-MM-DD
          const dayName = days[date.getDay()];
          const label = i === 0 ? 'Today'
                      : i === 1 ? 'Tomorrow'
                      : dayName;
          return { label, value: iso };
        });
      };

      const getTimeOptions = () => Array.from({ length: 13 }, (_, i) => {
        const hour = (i + 16) % 24;
        const displayHour = hour % 12 === 0 ? 12 : hour % 12;
        const ampm = hour < 12 ? 'AM' : 'PM';
        const time = `${displayHour}:00 ${ampm}`;
        return { label: `${time} ST`, value: time };
      });

      const components = () => [
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`${builderId}_instance`)
            .setPlaceholder('1. Select Instance or Template')
            .setOptions(instanceOptions)
        ),
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`${builderId}_day`)
            .setPlaceholder('2. Select Day')
            .setOptions(getDayOptions())
        ),
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`${builderId}_time`)
            .setPlaceholder('3. Select Time (Server Time)')
            .setOptions(getTimeOptions())
        ),
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(`${builderId}_edit_title`).setLabel('Set Title').setStyle(ButtonStyle.Secondary).setEmoji('📝'),
          new ButtonBuilder().setCustomId(`${builderId}_assign_leader`).setLabel('Assign Leader').setStyle(ButtonStyle.Secondary).setEmoji('👑'),
          new ButtonBuilder().setCustomId(`${builderId}_set_gs`).setLabel('Set GS').setStyle(ButtonStyle.Secondary).setEmoji('⚙️'),
          new ButtonBuilder().setCustomId(`${builderId}_create`).setLabel('Create').setStyle(ButtonStyle.Success).setDisabled(!checkCanCreate()).setEmoji('✅'),
          new ButtonBuilder().setCustomId(`${builderId}_cancel`).setLabel('Cancel').setStyle(ButtonStyle.Danger).setEmoji('❌')
        ),
      ];

      await interaction.deferReply({ ephemeral: true });
      const message = await interaction.editReply({ embeds: [generateBuilderEmbed()], components: components() });
      const collector = message.createMessageComponentCollector({
        filter: (i: MessageComponentInteraction) => i.user.id === interaction.user.id,
        time: 300_000,
      });

      collector.on('collect', async i => {
        try {
          await i.deferUpdate();
          const action = i.customId.split('_').pop()!;

          if (i.isStringSelectMenu()) {
            const val = (i as StringSelectMenuInteraction).values[0];
            if (action === 'instance') {
              const opt = RAID_OPTIONS.find(o => o.value === val);
              if (opt) {
                Object.assign(raidState, {
                  instance:      opt.label,
                  tank_slots:    opt.tanks,
                  healer_slots:  opt.healers,
                  dps_slots:     opt.dps,
                  min_gearscore: opt.minGs,
                });
              } else {
                const tpl = templates?.find(t => `template:${t.id}` === val);
                if (tpl) {
                  Object.assign(raidState, {
                    instance:      tpl.instance,
                    tank_slots:    tpl.tank_slots,
                    healer_slots:  tpl.healer_slots,
                    dps_slots:     tpl.dps_slots,
                    min_gearscore: tpl.min_gearscore,
                  });
                }
              }
            }
            if (action === 'day')  raidState.day  = val;
            if (action === 'time') raidState.time = val;
          }

          if (i.isButton()) {
            if (action === 'cancel') {
              collector.stop('cancelled');
              return;
            }

            if (['edit_title','assign_leader','set_gs'].includes(action)) {
              const titles: Record<string,string> = {
                edit_title:   'Set Raid Title',
                assign_leader:'Assign Raid Leader',
                set_gs:       'Set Minimum GS',
              };
              const modalId = `${builderId}_modal_${action}`;
              const modal = new ModalBuilder()
                .setCustomId(modalId)
                .setTitle(titles[action]);

              const input = new TextInputBuilder()
                .setCustomId(
                  action === 'set_gs'        ? 'gearscore'
                  : action === 'edit_title' ? 'title'
                  : 'leader_query'
                )
                .setLabel(
                  action === 'set_gs'        ? 'Minimum GS'
                  : action === 'edit_title' ? 'Raid Title'
                  : 'Leader (Discord or Character name)'
                )
                .setPlaceholder(action === 'assign_leader' ? 'e.g. Raidleadah' : '')
                .setRequired(true)
                .setStyle(TextInputStyle.Short)
                .setValue(
                  action === 'edit_title'   && raidState.title       ? raidState.title
                  : action === 'set_gs'     && raidState.min_gearscore ? String(raidState.min_gearscore)
                  : ''
                );

              modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
              await (i as ButtonInteraction).showModal(modal);

              const submitted = await (i as ButtonInteraction).awaitModalSubmit({
                filter: (m: ModalSubmitInteraction) =>
                  m.customId === modalId && m.user.id === interaction.user.id,
                time: 60_000,
              }).catch(() => null);

              if (submitted) {
                await submitted.deferUpdate();
                if (action === 'edit_title') {
                  raidState.title = submitted.fields.getTextInputValue('title');
                } else if (action === 'assign_leader') {
                  const query = submitted.fields.getTextInputValue('leader_query');
                  const { data: leader, error: le } = await supabase
                    .rpc('get_player_by_name_or_discord_id', {
                      p_guild_id: interaction.guildId!,
                      p_query:    query,
                    });
                  if (le || !leader) {
                    raidState.raid_leader_id   = null;
                    raidState.raid_leader_name = 'Not Found';
                  } else {
                    // @ts-ignore
                    raidState.raid_leader_id   = leader.player_id;
                    // @ts-ignore
                    raidState.raid_leader_name = leader.found_name;
                  }
                } else {
                  const gs = parseInt(submitted.fields.getTextInputValue('gearscore'), 10);
                  raidState.min_gearscore = isNaN(gs) ? 0 : Math.max(0, gs);
                }
                await interaction.editReply({ embeds: [generateBuilderEmbed()], components: components() });
              }
            }

            if (action === 'create' && checkCanCreate()) {
              // build a real Date from ISO date + AM/PM time
              const [hourMin, period] = raidState.time!.split(' ');
              let [hour, minute] = hourMin.split(':').map(n => parseInt(n, 10));
              if (period === 'PM' && hour < 12) hour += 12;
              if (period === 'AM' && hour === 12) hour = 0;
              const [y, m, d] = raidState.day!.split('-').map(Number);
              const dt = new Date(y, m - 1, d, hour, minute);
              const scheduledIso = dt.toISOString();

              // only insert actual raid columns :contentReference[oaicite:0]{index=0}
              const newRaid = {
                guild_id:       raidState.guild_id,
                title:          raidState.title,
                instance:       raidState.instance,
                scheduled_date: scheduledIso,
                tank_slots:     raidState.tank_slots,
                healer_slots:   raidState.healer_slots,
                dps_slots:      raidState.dps_slots,
                min_gearscore:  raidState.min_gearscore,
                raid_leader_id: raidState.raid_leader_id,
              };

              const { data: raid, error: e } = await supabase
                .from<Raid>('raids')
                .insert(newRaid)
                .select()
                .single();

              if (e) {
                await interaction.editReply({
                  content: `Error creating raid: ${e.message}`,
                  embeds:  [],
                  components: [],
                });
                return;
              }

              const signupButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId(`raid-signup:${raid.id}`).setLabel('Sign Up').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`raid-leave:${raid.id}`).setLabel('Leave').setStyle(ButtonStyle.Secondary),
              );

              const finalEmbed = buildRaidEmbed(raid, [], config.warmane_realm!, []);
              const channel = interaction.guild?.channels.cache.get(config.raid_channel_id!) as TextChannel | undefined;
              if (channel) {
                const msg = await channel.send({
                  content: `A new raid has been scheduled by ${interaction.user}`,
                  embeds:  [finalEmbed],
                  components: [signupButtons],
                });
                await supabase
                  .from('raids')
                  .update({ signup_message_id: msg.id })
                  .eq('id', raid.id);
              }
              collector.stop('created');
            }
          }

          await interaction.editReply({ embeds: [generateBuilderEmbed()], components: components() });
        } catch (err) {
          console.error('Raid builder error:', err);
          await interaction.editReply({
            content: 'An error occurred while processing your request.',
            embeds:  [],
            components: [],
          });
        }
      });

      collector.on('end', async (_, reason) => {
        const finalMsg = reason === 'created'
          ? 'Raid created successfully!'
          : reason === 'cancelled'
            ? 'Raid creation cancelled.'
            : 'Raid creation timed out.';
        await interaction.editReply({ content: finalMsg, embeds: [], components: [] }).catch(() => {});
      });

      return;
    }

    // --- List & Cancel (placeholders) ---
    if (sub === 'list' || sub === 'cancel') {
      await interaction.editReply({ content: 'This subcommand is not yet implemented.' });
    }
  },
};

export default command;
