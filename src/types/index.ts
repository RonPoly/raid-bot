import { SlashCommandBuilder, SlashCommandSubcommandsOnlyBuilder, SlashCommandOptionsOnlyBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SupabaseClient } from '@supabase/supabase-js';

export type SlashCommandData = SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder | SlashCommandOptionsOnlyBuilder;

export interface Command {
  data: SlashCommandData;
  execute: (interaction: ChatInputCommandInteraction, supabase: SupabaseClient) => Promise<void>;
}

export interface Player {
  id: string;
  discord_id: string;
  main_character: string;
  realm: string;
  created_at?: string;
  updated_at?: string;
}

export interface Character {
  character_name: string;
  player_id?: string;
  gear_score?: number;
  item_level?: number;
  last_updated?: string;
}

export interface Raid {
  id: string;
  title: string;
  instance: string;
  scheduled_date: string;
  tank_slots: number;
  healer_slots: number;
  dps_slots: number;
  min_gearscore: number;
  raid_leader_id: string | null;
  signup_message_id?: string | null;
  status: string;
  created_at?: string;
}

export interface RaidSignup {
  id: string;
  raid_id: string;
  character_name: string;
  role: 'tank' | 'healer' | 'dps';
  gear_score: number;
  signed_up_at: string;
  comment?: string | null;
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
