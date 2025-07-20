import {
  ButtonInteraction,
  TextChannel,
  StringSelectMenuBuilder,
  ActionRowBuilder,
  StringSelectMenuInteraction,
} from 'discord.js';
import { SupabaseClient } from '@supabase/supabase-js';
import { Raid, RaidSignup } from '../types';
import { buildRaidEmbed } from './embed-builder';

const ROLE_SELECT_ID = (raidId: string) => `raid-role-select:${raidId}`;

export async function handleRaidSignupButton(
  interaction: ButtonInteraction,
  supabase: SupabaseClient,
) {
  const [, raidId] = interaction.customId.split(':');

  const select = new StringSelectMenuBuilder()
    .setCustomId(ROLE_SELECT_ID(raidId))
    .setPlaceholder('Select role')
    .addOptions(
      { label: 'Tank', value: 'tank' },
      { label: 'Healer', value: 'healer' },
      { label: 'DPS', value: 'dps' },
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
  await interaction.reply({ content: 'Choose your role:', components: [row], ephemeral: true });
}

export async function handleRaidRoleSelect(
  interaction: StringSelectMenuInteraction,
  supabase: SupabaseClient,
) {
  const [, raidId] = interaction.customId.split(':');
  const role = interaction.values[0] as 'tank' | 'healer' | 'dps';

  const { data: raid } = await supabase.from('Raids').select('*').eq('id', raidId).maybeSingle();
  if (!raid) {
    await interaction.update({ content: 'Raid not found.', components: [] });
    return;
  }

  const { data: player } = await supabase
    .from('Players')
    .select('main_character')
    .eq('discord_id', interaction.user.id)
    .maybeSingle();
  if (!player) {
    await interaction.update({ content: 'Register a main character first.', components: [] });
    return;
  }

  const { data: gs } = await supabase
    .from('GearScores')
    .select('gear_score')
    .eq('character_name', player.main_character)
    .maybeSingle();

  await supabase
    .from('RaidSignups')
    .delete()
    .eq('raid_id', raidId)
    .eq('character_name', player.main_character);

  await supabase.from('RaidSignups').insert({
    raid_id: raidId,
    character_name: player.main_character,
    role,
    gear_score: gs?.gear_score ?? null,
  });

  const { data: signups } = await supabase
    .from('RaidSignups')
    .select('*')
    .eq('raid_id', raidId);

  const embed = buildRaidEmbed(raid as Raid, signups as RaidSignup[]);
  if (raid.signup_message_id) {
    try {
      const chan = interaction.channel as TextChannel;
      const msg = await chan.messages.fetch(raid.signup_message_id);
      await msg.edit({ embeds: [embed] });
    } catch {}
  }

  await interaction.update({ content: `Signed up as ${role}!`, components: [] });
}

export async function handleRaidLeaveButton(
  interaction: ButtonInteraction,
  supabase: SupabaseClient,
) {
  const [, raidId] = interaction.customId.split(':');

  const { data: raid } = await supabase.from('Raids').select('*').eq('id', raidId).maybeSingle();
  if (!raid) {
    await interaction.reply({ content: 'Raid not found.', ephemeral: true });
    return;
  }

  const { data: player } = await supabase
    .from('Players')
    .select('main_character')
    .eq('discord_id', interaction.user.id)
    .maybeSingle();
  if (!player) {
    await interaction.reply({ content: 'Register a main character first.', ephemeral: true });
    return;
  }

  await supabase
    .from('RaidSignups')
    .delete()
    .eq('raid_id', raidId)
    .eq('character_name', player.main_character);

  const { data: signups } = await supabase
    .from('RaidSignups')
    .select('*')
    .eq('raid_id', raidId);

  const embed = buildRaidEmbed(raid as Raid, signups as RaidSignup[]);
  if (raid.signup_message_id) {
    try {
      const chan = interaction.channel as TextChannel;
      const msg = await chan.messages.fetch(raid.signup_message_id);
      await msg.edit({ embeds: [embed] });
    } catch {}
  }

  await interaction.reply({ content: 'You have left the raid.', ephemeral: true });
}
