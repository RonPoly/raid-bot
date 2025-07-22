import { SlashCommandBuilder, SlashCommandSubcommandsOnlyBuilder, SlashCommandOptionsOnlyBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SupabaseClient } from '@supabase/supabase-js';

export type SlashCommandData = SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder | SlashCommandOptionsOnlyBuilder;

export interface Command {
  data: SlashCommandData;
  execute: (interaction: ChatInputCommandInteraction, supabase: SupabaseClient) => Promise<void>;
}

export interface Player {
  id: string;
  guild_id: string;
  discord_id: string;
  character_name: string;
  realm: string;
  class?: string | null;
  gear_score?: number | null;
  is_main?: boolean;
  last_updated?: string | null;
  created_at?: string;
}

export interface Character {
  id: string;
  guild_id: string;
  discord_id: string;
  character_name: string;
  realm: string;
  class?: string | null;
  gear_score?: number | null;
  is_main?: boolean;
  last_updated?: string | null;
  created_at?: string;
}

export interface Raid {
  id: string;
  guild_id: string;
  title: string;
  instance: string;
  scheduled_date: string;
  tank_slots: number;
  healer_slots: number;
  dps_slots: number;
  min_gearscore: number;
  raid_leader_id: string | null;
  signup_message_id?: string | null;
  reminder_sent?: boolean;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface RaidSignup {
  id: string;
  raid_id: string;
  player_id: string;
  character_name: string;
  role: 'tank' | 'healer' | 'dps';
  class?: string | null;
  gear_score?: number | null;
  comment?: string | null;
  benched?: boolean;
  signed_up_at: string;
}

export interface RaidBench {
  id: string;
  raid_id: string;
  character_name: string;
  gear_score?: number | null;
  added_at: string;
}

export interface RaidTemplate {
  id: string;
  guild_id: string;
  name: string;
  instance: string;
  tank_slots: number;
  healer_slots: number;
  dps_slots: number;
  min_gearscore: number;
  created_at?: string;
}

export interface RaidLog {
  id: string;
  raid_id: string;
  character_name: string;
  role: string;
  logged_at: string;
}

export interface GuildConfig {
  discord_guild_id: string;
  warmane_guild_name: string;
  warmane_realm: string;
  member_role_id?: string | null;
  officer_role_id?: string | null;
  class_leader_role_id?: string | null;
  raider_role_id?: string | null;
  raid_channel_id?: string | null;
  setup_complete?: boolean;
  setup_by_user_id?: string | null;
}
