import { ButtonInteraction, TextChannel } from 'discord.js';
import { SupabaseClient } from '@supabase/supabase-js';
import { Raid, RaidSignup } from '../types';
import { buildRaidEmbed } from './embed-builder';

export async function handleRaidSignupButton(
  interaction: ButtonInteraction,
  supabase: SupabaseClient
) {
  const [, raidId, role] = interaction.customId.split(':');

  const { data: raid } = await supabase
    .from('Raids')
    .select('*')
    .eq('id', raidId)
    .maybeSingle();
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
    role: role as 'tank' | 'healer' | 'dps',
    gear_score: gs?.gear_score ?? null
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

  await interaction.reply({ content: 'Signed up!', ephemeral: true });
}
