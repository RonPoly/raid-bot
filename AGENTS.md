# AGENTS.md - Warmane Raid Bot Project Context

**IMPORTANT: This file contains the complete context for AI agents (Codex, Claude, etc.) working on this project. Always reference this file when generating code.**

## Project Overview

We are building a Discord bot for a World of Warcraft: Wrath of the Lich King (WOTLK) 3.3.5 guild playing on Warmane private server. This bot manages raid signups, tracks gear scores, and syncs Discord roles with in-game guild membership.

### Core Purpose
- Replace spreadsheet raid signups with Discord-native system
- Track player GearScore (critical for WOTLK raiding)
- Ensure only active guild members can sign up for raids
- Provide raid leaders with roster management tools

## Technical Stack

```
Runtime: Node.js 20 LTS
Language: TypeScript 5.x
Discord: discord.js v14
Database: Supabase (PostgreSQL)
API: Warmane Armory API
Deployment: Docker on Ubuntu VM
```

## Key WOTLK Context

**Critical Game Knowledge:**
- GearScore (GS) ranges from 3000-7000
- Raids are either 10-man or 25-man
- Standard comp: 2 tanks, 5-6 healers, rest DPS (25-man)
- Main raids: ICC, RS, TOC, Ulduar, VoA
- Players have multiple characters (alts) for different roles

**Warmane Specific:**
- Private server with custom API
- API endpoint: `https://armory.warmane.com/api/`
- Realms: Lordaeron, Icecrown, Frostmourne, Onyxia
- API doesn't provide GearScore directly

## Database Schema

```sql
-- Core player identity
Players (
  id: uuid primary key
  discord_id: string unique not null
  main_character: string not null
  realm: string not null
  created_at: timestamp
  updated_at: timestamp
)

-- Alt characters linked to main
Alts (
  id: uuid primary key
  player_id: uuid references Players(id)
  character_name: string not null
  created_at: timestamp
  UNIQUE(player_id, character_name)
)

-- GearScore tracking
GearScores (
  character_name: string primary key
  gear_score: integer check (gear_score >= 3000 AND gear_score <= 7000)
  item_level: integer optional
  last_updated: timestamp
  updated_by: uuid references Players(id)
)

-- Raid events
Raids (
  id: uuid primary key
  title: string not null
  instance: string not null -- ICC25, RS10, etc
  scheduled_date: timestamp not null
  tank_slots: integer default 2
  healer_slots: integer default 6
  dps_slots: integer default 17
  min_gearscore: integer default 5500
  raid_leader_id: uuid references Players(id)
  signup_message_id: string -- Discord message ID
  created_at: timestamp
  status: string default 'open' -- open, closed, completed
)

-- Raid signups
RaidSignups (
  id: uuid primary key
  raid_id: uuid references Raids(id) on delete cascade
  character_name: string not null
  role: string not null check (role in ('tank', 'healer', 'dps'))
  gear_score: integer -- Cached from GearScores at signup time
  signed_up_at: timestamp
  comment: string optional
  UNIQUE(raid_id, character_name)
)
```

## Feature Specifications

### 1. Character Registration

**Command:** `/register character:<name> alt_of:<optional>`

**Logic:**
```typescript
if (alt_of is empty) {
  // Registering main character
  - Check user doesn't already have main
  - Validate character name (letters only, 2-12 chars)
  - Create Players entry
} else {
  // Registering alt
  - Verify user has a main character
  - Verify alt_of matches their main
  - Create Alts entry
}
```

**Response Example:**
```
✅ Character Registered

Main: Arthasdk (Lordaeron)
Alts: Paladinlol, Huntard
```

### 2. GearScore Management

**Commands:**
- `/gs set <value>` - Update your GearScore
- `/gs view [user]` - View GearScore

**GearScore Tiers (WOTLK specific):**
- 6000+ (Green) - ICC ready
- 5500-5999 (Yellow) - TOC/RS ready  
- 5000-5499 (Orange) - Early raids ready
- Below 5000 (Red) - Needs gear

### 3. Raid Creation & Signup

**Command:** `/raid create` opens modal with:
- Instance dropdown (ICC10, ICC25, RS10, RS25, etc)
- Date/time input
- Role slots configuration

**Raid Embed Format:**
```
**ICC 25 - Saturday 8pm ST**

🛡️ **Tanks** (2/2)
• Arthasdk - 6245 GS
• Paladinlol - 6102 GS

💚 **Healers** (4/6)  
• Holypriest - 5998 GS
• Restosham - 5876 GS
• [2 slots open]

⚔️ **DPS** (12/17)
• Shadowdk - 6458 GS
• Huntard - 6234 GS
• ... (10 more)
• [5 slots open]

📊 Average GS: 6123 | Min required: 5800
👥 Total: 18/25

[Sign Up] [Leave] [View Roster]
```

### 4. Warmane API Integration

**Endpoints:**
```
Guild Roster: GET /guild/{name}/{realm}/members
Character Check: GET /character/{name}/{realm}/summary
```

**Sync Logic (runs every 3 minutes):**
```typescript
1. Fetch guild roster from Warmane
2. For each Discord member:
   - Get their registered characters (main + alts)
   - Check if ANY character is in guild
   - Update role accordingly
3. Handle special characters (áéíóú allowed in Warmane)
4. Skip sync if API returns 503 (maintenance)
```

## File Structure

```
warmane-raid-bot/
├── src/
│   ├── index.ts              # Bot entry point
│   ├── config/
│   │   └── database.ts       # Supabase client setup
│   ├── commands/
│   │   ├── register.ts       # Character registration
│   │   ├── gs.ts            # GearScore commands
│   │   ├── raid.ts          # Raid management
│   │   └── admin.ts         # Admin commands
│   ├── events/
│   │   ├── ready.ts         # Bot startup
│   │   ├── interactionCreate.ts  # Command handler
│   │   └── guildMemberUpdate.ts  # Role sync
│   ├── utils/
│   │   ├── warmane-api.ts   # Warmane API client
│   │   ├── embed-builder.ts  # Raid embed creation
│   │   └── role-sync.ts     # Guild sync logic
│   └── types/
│       └── index.ts          # TypeScript interfaces
├── .env.example
├── AGENTS.md                 # THIS FILE
├── package.json
├── tsconfig.json
└── Dockerfile
```

## Implementation Priorities

1. **Phase 1:** Basic bot setup + database
2. **Phase 2:** Character registration system
3. **Phase 3:** GearScore commands
4. **Phase 4:** Raid creation and signups
5. **Phase 5:** Warmane API integration
6. **Phase 6:** Role syncing
7. **Phase 7:** Polish and deployment

## Common Pitfalls to Avoid

1. **DON'T** use deprecated discord.js patterns (old Client constructor)
2. **DON'T** forget WOTLK GS ranges (3000-7000, not retail values)
3. **DON'T** assume Warmane API provides GearScore (it doesn't)
4. **DON'T** make raid sizes flexible (only 10 or 25)
5. **DON'T** forget special characters in names (Warmane allows them)
6. **DON'T** remove roles during API downtime

## Example Prompts for Agents

When working with this project, start prompts with:
```
I'm working on the Warmane raid bot project (see AGENTS.md). 
I need to implement [specific feature].
```

## Environment Variables

```env
# Discord
DISCORD_TOKEN=
GUILD_ID=
MEMBER_ROLE_ID=
OFFICER_ROLE_ID=

# Database
SUPABASE_URL=
SUPABASE_ANON_KEY=

# Warmane
WARMANE_GUILD_NAME=
WARMANE_REALM=Lordaeron

# Config
SYNC_INTERVAL_MINUTES=3
MIN_GEARSCORE_ICC=5800
```

## Testing Checklist

- [ ] Bot connects to Discord
- [ ] Database tables created
- [ ] Can register main character
- [ ] Can register alt character
- [ ] Can set GearScore
- [ ] Can create raid event
- [ ] Signup button works
- [ ] Embed updates with signups
- [ ] Warmane API fetches guild
- [ ] Role sync runs automatically
- [ ] Handles API downtime gracefully

## Support Resources

- Warmane API Docs: https://armory.warmane.com/api/
- Discord.js Guide: https://discordjs.guide/
- WOTLK GearScore Info: https://wotlk.fandom.com/wiki/GearScore
- Supabase Docs: https://supabase.com/docs

---

**Remember: This is a WOTLK 3.3.5 private server bot. Stay focused on period-accurate features and Warmane-specific requirements.**