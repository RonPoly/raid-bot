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
  ComponentType,
  MessageFlags,
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
    { label: 'Icecrown Citadel 10-Man', description: 'ICC 10', value: 'ICC10', tanks: 2, healers: 3, dps: 5, minGs: 5800 },
    { label: 'Icecrown Citadel 25-Man', description: 'ICC 25', value: 'ICC25', tanks: 2, healers: 6, dps: 17, minGs: 5800 },
    { label: 'Ruby Sanctum 10-Man', description: 'RS 10', value: 'RS10', tanks: 1, healers: 3, dps: 6, minGs: 5500 },
    { label: 'Ruby Sanctum 25-Man', description: 'RS 25', value: 'RS25', tanks: 1, healers: 6, dps: 18, minGs: 5500 },
    { label: "Trial of the Crusader 10-Man", description: 'TOC 10', value: 'TOC10', tanks: 2, healers: 3, dps: 5, minGs: 5200 },
    { label: "Trial of the Crusader 25-Man", description: 'TOC 25', value: 'TOC25', tanks: 2, healers: 6, dps: 17, minGs: 5200 },
];

// --- Main Command Definition ---
const command: Command = {
  data: new SlashCommandBuilder()
    .setName('raid')
    .setDescription('Raid management')
    .addSubcommand((sub) => sub.setName('create').setDescription('Create a new raid event with the interactive builder.'))
    .addSubcommand((sub) => sub.setName('list').setDescription('List all upcoming raids.'))
    .addSubcommand((sub) => sub.setName('cancel').setDescription('Cancel an upcoming raid.').addStringOption((opt) => opt.setName('id').setDescription('The ID of the raid to cancel.').setRequired(true))),

  async execute(interaction: ChatInputCommandInteraction, supabase: SupabaseClient) {
    const sub = interaction.options.getSubcommand();
    const config = await requireGuildConfig(interaction);
    if (!config) return;

    if (sub !== 'create') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    // --- Interactive Raid Builder ---
    if (sub === 'create') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const member = interaction.member as GuildMember;
      if (!config.officer_role_id || !member?.roles?.cache?.has(config.officer_role_id)) {
        await interaction.editReply({ content: 'You do not have permission to create raids.' });
        return;
      }

      const builderId = `raid-builder-${interaction.id}`;
      const raidState: Partial<Raid & { guild_id?: string; day?: string; time?: string; raid_leader_name?: string }> = {
          guild_id: interaction.guildId!,
          title: 'New Raid',
          raid_leader_id: null,
          raid_leader_name: 'Not Assigned',
      };

      const generateBuilderEmbed = () => new EmbedBuilder()
        .setTitle('📋 Interactive Raid Builder')
        .setColor('#5865F2')
        .setDescription('Use the components below to configure the raid. This embed will update with your selections.')
        .addFields(
            { name: '📝 Title', value: raidState.title || 'Not Set', inline: true },
            { name: '👑 Raid Leader', value: raidState.raid_leader_name || 'Not Assigned', inline: true },
            { name: '📅 Date', value: (raidState.day && raidState.time) ? `${raidState.day} at ${raidState.time}` : 'Not Set', inline: true },
            { name: '🏰 Instance', value: raidState.instance || 'Not Set', inline: true },
            { name: '🛡️ Tanks', value: String(raidState.tank_slots || '...'), inline: true },
            { name: '🌿 Healers', value: String(raidState.healer_slots || '...'), inline: true },
            { name: '⚔️ DPS', value: String(raidState.dps_slots || '...'), inline: true },
            { name: '⚙️ Min. GS', value: String(raidState.min_gearscore || '...'), inline: true },
        )
        .setFooter({ text: 'All fields must be set before you can create the raid.' });

      const checkCanCreate = () => raidState.title && raidState.instance && raidState.day && raidState.time;

      const { data: templates } = await supabase.from('raid_templates').select('*').eq('guild_id', interaction.guildId!);
      const instanceOptions = RAID_OPTIONS.map(o => ({ label: o.label, value: o.value, description: o.description }));
      if (templates && templates.length > 0) {
        instanceOptions.push(...templates.map(t => ({ label: `Template: ${t.name}`, value: `template:${t.id}`, description: t.instance })));
      }

      const getDayOptions = () => {
          const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          const today = new Date().getDay();
          return Array.from({ length: 7 }, (_, i) => {
              const date = new Date();
              date.setDate(date.getDate() + i);
              const dayName = days[date.getDay()];
              let label = dayName;
              if (i === 0) label = 'Today';
              if (i === 1) label = 'Tomorrow';
              return { label, value: dayName };
          });
      };
      
      const getTimeOptions = () => Array.from({ length: 13 }, (_, i) => {
          const hour = (i + 16) % 24;
          const displayHour = hour % 12 === 0 ? 12 : hour % 12;
          const ampm = hour < 12 ? 'AM' : 'PM';
          const time = `${displayHour}:00 ${ampm} ST`;
          return { label: time, value: time };
      });

      const components = () => [
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder().setCustomId(`${builderId}_instance`).setPlaceholder('1. Select Instance or Template').setOptions(instanceOptions)),
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder().setCustomId(`${builderId}_day`).setPlaceholder('2. Select Day').setOptions(getDayOptions())),
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder().setCustomId(`${builderId}_time`).setPlaceholder('3. Select Time (Server Time)').setOptions(getTimeOptions())),
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(`${builderId}_edit_title`).setLabel('Set Title').setStyle(ButtonStyle.Secondary).setEmoji('📝'),
          new ButtonBuilder().setCustomId(`${builderId}_assign_leader`).setLabel('Assign Leader').setStyle(ButtonStyle.Secondary).setEmoji('👑'),
          new ButtonBuilder().setCustomId(`${builderId}_create`).setLabel('Create').setStyle(ButtonStyle.Success).setDisabled(!checkCanCreate()).setEmoji('✅'),
          new ButtonBuilder().setCustomId(`${builderId}_cancel`).setLabel('Cancel').setStyle(ButtonStyle.Danger).setEmoji('❌')
        )
      ];

      const message = await interaction.editReply({ embeds: [generateBuilderEmbed()], components: components() });
      const collector = message.createMessageComponentCollector({ filter: (i) => i.user.id === interaction.user.id, time: 300_000 });

      collector.on('collect', async i => {
        try {
          await i.deferUpdate();
          
          // Fix: Properly parse the custom ID
          const customIdParts = i.customId.split('_');
          const action = customIdParts[customIdParts.length - 1]; // Get the last part as action
          
          console.log('Custom ID:', i.customId, 'Action:', action); // Debug logging
          
          if (i.isStringSelectMenu()) {
            const value = i.values[0];
            if (action === 'instance') {
              let option = RAID_OPTIONS.find(o => o.value === value);
              if (!option && value.startsWith('template:')) {
                const t = templates?.find(t => `template:${t.id}` === value);
                if (t) Object.assign(raidState, { instance: t.instance, tank_slots: t.tank_slots, healer_slots: t.healer_slots, dps_slots: t.dps_slots, min_gearscore: t.min_gearscore });
              } else if (option) Object.assign(raidState, { instance: option.label, tank_slots: option.tanks, healer_slots: option.healers, dps_slots: option.dps, min_gearscore: option.minGs });
            }
            if (action === 'day') raidState.day = value;
            if (action === 'time') raidState.time = value;
          }

          if (i.isButton()) {
              if (action === 'cancel') return collector.stop('cancelled');

              if (action === 'title' || action === 'leader') { // Handle edit_title and assign_leader
                  const modalId = `${builderId}_modal_${action}`;
                  const modal = new ModalBuilder().setCustomId(modalId).setTitle(action === 'title' ? 'Set Raid Title' : 'Assign Raid Leader');
                  const input = new TextInputBuilder().setRequired(true);
                  if (action === 'title') input.setCustomId('title').setLabel('Raid Title').setStyle(TextInputStyle.Short).setValue(raidState.title || '');
                  if (action === 'leader') input.setCustomId('leader_query').setLabel('Discord User Name or Character Name').setStyle(TextInputStyle.Short).setPlaceholder('e.g., Raidleadah or Arthas');
                  
                  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
                  await i.showModal(modal);
                  const submitted = await i.awaitModalSubmit({ time: 60000 }).catch(() => null);

                  if (submitted) {
                      await submitted.deferUpdate();
                      if (action === 'title') raidState.title = submitted.fields.getTextInputValue('title');
                      if (action === 'leader') {
                          const query = submitted.fields.getTextInputValue('leader_query');
                          try {
                              const { data: leader } = await supabase
                                  .rpc('get_player_by_name_or_discord_id', { p_guild_id: interaction.guildId!, p_query: query })
                                  .maybeSingle<{ player_id: string; found_name: string }>();
                              if (leader) {
                                  raidState.raid_leader_id = leader.player_id;
                                  raidState.raid_leader_name = leader.found_name;
                              } else {
                                  raidState.raid_leader_id = null;
                                  raidState.raid_leader_name = 'Not Found';
                              }
                          } catch (error) {
                              raidState.raid_leader_id = null;
                              raidState.raid_leader_name = 'Not Found';
                          }
                      }
                  }
              }
              
              if (action === 'create') {
                  raidState.scheduled_date = `${raidState.day} at ${raidState.time}`;
                  const { data: raid } = await supabase.from('raids').insert(raidState).select().single();
                  const signupButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
                      new ButtonBuilder().setCustomId(`raid-signup:${raid.id}`).setLabel('Sign Up').setStyle(ButtonStyle.Success),
                      new ButtonBuilder().setCustomId(`raid-leave:${raid.id}`).setLabel('Leave').setStyle(ButtonStyle.Secondary)
                  );
                    const finalEmbed = buildRaidEmbed(raid, [], config.warmane_realm!, []);
                    const channel = interaction.guild?.channels.cache.get(config.raid_channel_id!) as TextChannel | undefined;
                  if (channel) {
                      await channel.send({ content: `A new raid has been scheduled by ${interaction.user.toString()}!`, embeds: [finalEmbed], components: [signupButtons] }).then(msg =>
                          supabase.from('raids').update({ signup_message_id: msg.id }).eq('id', raid.id)
                      );
                  }
                  return collector.stop('created');
              }
          }
          await interaction.editReply({ embeds: [generateBuilderEmbed()], components: components() });
        } catch (error) {
          console.error('Error in raid builder collector:', error);
        }
      });

      collector.on('end', async (_, reason) => {
        const finalContent = reason === 'created' ? 'Raid created successfully!' : reason === 'cancelled' ? 'Raid creation cancelled.' : 'Raid creation timed out.';
        await interaction.editReply({ content: finalContent, embeds: [], components: [] }).catch(() => {});
      });
      return;
    }

    // --- Other Subcommands ---
    if (sub === 'list' || sub === 'cancel') {
        await interaction.editReply({ content: 'This subcommand is not yet implemented.' });
    }
  }
};

export default command;
