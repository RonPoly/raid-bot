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
import { getGuildConfig } from './guild-config';

const CHAR_SELECT_ID = (raidId: string) => `raid-char-select:${raidId}`;

export async function handleRaidSignupButton(
  interaction: ButtonInteraction,
  supabase: SupabaseClient,
) {
  const [, raidId] = interaction.customId.split(':');

  try {
    const { menu } = await buildCharacterSelectMenu(
      supabase,
      interaction.user.id,
      interaction.guildId ?? '',
      CHAR_SELECT_ID(raidId)
    );
    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
    await interaction.reply({ content: 'Choose your character:', components: [row], ephemeral: true });
  } catch {
    await interaction.reply({ content: 'Register a character first.', ephemeral: true });
  }
}

export async function handleRaidRoleSelect(
  interaction: StringSelectMenuInteraction,
  supabase: SupabaseClient,
) {
  const [, raidId] = interaction.customId.split(':');
  const role = interaction.values[0] as 'tank' | 'healer' | 'dps';

  const { data: raid } = await supabase.from('raids').select('*').eq('id', raidId).maybeSingle();
  if (!raid) {
    await interaction.update({ content: 'Raid not found.', components: [] });
    return;
  }
  try {
    const { menu, characters } = await buildCharacterSelectMenu(
      supabase,
      interaction.user.id,
      interaction.guildId ?? '',
      CHAR_SELECT_ID(raidId)
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
    .from('players')
    .select('gear_score, class')
    .eq('guild_id', interaction.guildId ?? '')
    .eq('discord_id', interaction.user.id)
    .eq('character_name', character)
    .maybeSingle();

  const charClass = gs?.class as string | undefined;

  const roleAllowed: Record<'tank' | 'healer' | 'dps', string[]> = {
    tank: ['Warrior', 'Paladin', 'Death Knight', 'Druid'],
    healer: ['Paladin', 'Priest', 'Shaman', 'Druid'],
    dps: [
      'Warrior',
      'Paladin',
      'Death Knight',
      'Druid',
      'Rogue',
      'Hunter',
      'Shaman',
      'Mage',
      'Warlock',
      'Priest'
    ]
  };

  if (charClass && !roleAllowed[role].includes(charClass)) {
    await interaction.update({
      content: `${character} cannot sign as ${role}.`,
      components: []
    });
    return;
  }

  await supabase
    .from('raid_signups')
    .delete()
    .eq('raid_id', raidId)
    .eq('character_name', character);

  await supabase.from('raid_signups').insert({
    raid_id: raidId,
    character_name: character,
    role,
    gear_score: gs?.gear_score ?? null,
    benched: false,
  });

  const { data: signups } = await supabase
    .from('raid_signups')
    .select('*')
    .eq('raid_id', raidId);

  const { data: playerRows } = await supabase
    .from('players')
    .select('character_name, class')
    .eq('guild_id', interaction.guildId ?? '');

  const signupWithClass = (signups as RaidSignup[]).map((s) => ({
    ...s,
    class: playerRows?.find((p) => p.character_name === s.character_name)?.class ?? null
  }));

  const config = await getGuildConfig(interaction.guildId ?? '');
  const realm = config?.warmane_realm ?? 'Lordaeron';

  const bench = signupWithClass.filter((s) => (s as any).benched);
  const embed = buildRaidEmbed(
    raid as Raid,
    signupWithClass.filter((s) => !(s as any).benched) as RaidSignup[],
    realm,
    bench as any
  );
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
  const [, raidId] = interaction.customId.split(':');
  const character = interaction.values[0];

  const { data: raid } = await supabase.from('raids').select('*').eq('id', raidId).maybeSingle();
  if (!raid) {
    await interaction.update({ content: 'Raid not found.', components: [] });
    return;
  }

  await signupCharacter(interaction, supabase, raid as Raid, raidId, character, 'dps');
}

export async function handleRaidLeaveButton(
  interaction: ButtonInteraction,
  supabase: SupabaseClient,
) {
  const [, raidId] = interaction.customId.split(':');

  const { data: raid } = await supabase.from('raids').select('*').eq('id', raidId).maybeSingle();
  if (!raid) {
    await interaction.reply({ content: 'Raid not found.', ephemeral: true });
    return;
  }

  const { data: rows } = await supabase
    .from('players')
    .select('character_name')
    .eq('discord_id', interaction.user.id)
    .eq('guild_id', interaction.guildId ?? '');

  const characters = rows?.map(r => r.character_name) ?? [];
  if (characters.length === 0) {
    await interaction.reply({ content: 'Register a character first.', ephemeral: true });
    return;
  }

  await supabase
    .from('raid_signups')
    .delete()
    .eq('raid_id', raidId)
    .in('character_name', characters);

  const { data: signups } = await supabase
    .from('raid_signups')
    .select('*')
    .eq('raid_id', raidId);

  const { data: playerRows } = await supabase
    .from('players')
    .select('character_name, class')
    .eq('guild_id', interaction.guildId ?? '');

  const signupWithClass = (signups as RaidSignup[]).map((s) => ({
    ...s,
    class: playerRows?.find((p) => p.character_name === s.character_name)?.class ?? null
  }));

  const config = await getGuildConfig(interaction.guildId ?? '');
  const realm = config?.warmane_realm ?? 'Lordaeron';

  const bench = signupWithClass.filter((s) => (s as any).benched);
  const embed = buildRaidEmbed(
    raid as Raid,
    signupWithClass.filter((s) => !(s as any).benched) as RaidSignup[],
    realm,
    bench as any
  );
  if (raid.signup_message_id) {
    try {
      const chan = interaction.channel as TextChannel;
      const msg = await chan.messages.fetch(raid.signup_message_id);
      await msg.edit({ embeds: [embed] });
    } catch {}
  }

  await interaction.reply({ content: 'You have left the raid.', ephemeral: true });
}
