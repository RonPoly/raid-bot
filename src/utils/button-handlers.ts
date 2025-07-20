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
import { buildCharacterSelectMenu } from './character-select';

const ROLE_SELECT_ID = (raidId: string) => `raid-role-select:${raidId}`;
const CHAR_SELECT_ID = (raidId: string, role: string) => `raid-char-select:${raidId}:${role}`;

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
  try {
    const { menu, characters } = await buildCharacterSelectMenu(
      supabase,
      interaction.user.id,
      CHAR_SELECT_ID(raidId, role)
    );

    if (characters.length === 1) {
      await signupCharacter(interaction, supabase, raid as Raid, raidId, characters[0], role);
      return;
    }

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
    await interaction.update({ content: 'Select character:', components: [row] });
  } catch {
    await interaction.update({ content: 'Register a character first.', components: [] });
  }
}

async function signupCharacter(
  interaction: StringSelectMenuInteraction,
  supabase: SupabaseClient,
  raid: Raid,
  raidId: string,
  character: string,
  role: 'tank' | 'healer' | 'dps',
) {
  const { data: gs } = await supabase
    .from('GearScores')
    .select('gear_score')
    .eq('character_name', character)
    .maybeSingle();

  await supabase
    .from('RaidSignups')
    .delete()
    .eq('raid_id', raidId)
    .eq('character_name', character);

  await supabase.from('RaidSignups').insert({
    raid_id: raidId,
    character_name: character,
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

  await interaction.update({ content: `Signed up as ${character} (${role})!`, components: [] });
}

export async function handleRaidCharacterSelect(
  interaction: StringSelectMenuInteraction,
  supabase: SupabaseClient,
) {
  const [, raidId, role] = interaction.customId.split(':');
  const character = interaction.values[0];

  const { data: raid } = await supabase.from('Raids').select('*').eq('id', raidId).maybeSingle();
  if (!raid) {
    await interaction.update({ content: 'Raid not found.', components: [] });
    return;
  }

  await signupCharacter(interaction, supabase, raid as Raid, raidId, character, role as 'tank' | 'healer' | 'dps');
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
    .select('id, main_character')
    .eq('discord_id', interaction.user.id)
    .maybeSingle();
  if (!player) {
    await interaction.reply({ content: 'Register a main character first.', ephemeral: true });
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

  await supabase
    .from('RaidSignups')
    .delete()
    .eq('raid_id', raidId)
    .in('character_name', characters);

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
