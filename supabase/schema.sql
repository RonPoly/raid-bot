-- SQL schema for Warmane raid bot
-- Extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Players table
CREATE TABLE IF NOT EXISTS "Players" (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  discord_id text NOT NULL UNIQUE,
  main_character text NOT NULL,
  realm text NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Alt characters linked to main players
CREATE TABLE IF NOT EXISTS "Alts" (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id uuid NOT NULL REFERENCES "Players"(id) ON DELETE CASCADE,
  character_name text NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(player_id, character_name)
);

-- GearScore tracking for characters
CREATE TABLE IF NOT EXISTS "GearScores" (
  character_name text PRIMARY KEY,
  gear_score integer NOT NULL CHECK (gear_score >= 3000 AND gear_score <= 7000),
  item_level integer,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES "Players"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Raid events
CREATE TABLE IF NOT EXISTS "Raids" (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  instance text NOT NULL,
  scheduled_date TIMESTAMPTZ NOT NULL,
  tank_slots integer NOT NULL DEFAULT 2,
  healer_slots integer NOT NULL DEFAULT 6,
  dps_slots integer NOT NULL DEFAULT 17,
  min_gearscore integer NOT NULL DEFAULT 5500,
  raid_leader_id uuid REFERENCES "Players"(id),
  signup_message_id text,
  status text NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Raid signups by character
CREATE TABLE IF NOT EXISTS "RaidSignups" (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  raid_id uuid NOT NULL REFERENCES "Raids"(id) ON DELETE CASCADE,
  character_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('tank', 'healer', 'dps')),
  gear_score integer,
  signed_up_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  comment text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(raid_id, character_name)
);
