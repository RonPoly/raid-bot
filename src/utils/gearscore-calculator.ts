import * as fs from 'fs';
import * as path from 'path';
// This module implements the WOTLK GearScore formula used by the original addon.

const SCALE = 1.8618;

interface QualityTable {
  A: number;
  B: number;
}

// Tables from the original addon
const TABLE_A: Record<number, QualityTable> = {
  4: { A: 91.45, B: 0.65 },
  3: { A: 81.375, B: 0.8125 },
  2: { A: 73.0, B: 1.0 }
};

const TABLE_B: Record<number, QualityTable> = {
  4: { A: 26.0, B: 1.2 },
  3: { A: 0.75, B: 1.8 },
  2: { A: 8.0, B: 2.0 },
  1: { A: 0.0, B: 2.25 }
};

// Map item quality strings to rarity numbers
const QUALITY_TO_RARITY: Record<string, number> = {
  Poor: 0,
  Common: 1,
  Uncommon: 2,
  Rare: 3,
  Epic: 4,
  Legendary: 5,
  Heirloom: 4
};

function getQualityScale(rarity: number): number {
  if (rarity === 5) return 1.3; // Legendary
  if (rarity <= 1) return 0.005; // Poor/Common
  return 1.0;
}

// Convert Warmane slot names to the INVTYPE slots used by the addon
const SLOT_TO_INVTYPE: Record<string, string> = {
  Head: 'INVTYPE_HEAD',
  Neck: 'INVTYPE_NECK',
  Shoulder: 'INVTYPE_SHOULDER',
  Back: 'INVTYPE_CLOAK',
  Chest: 'INVTYPE_CHEST',
  Robe: 'INVTYPE_ROBE',
  Wrist: 'INVTYPE_WRIST',
  Hands: 'INVTYPE_HAND',
  Waist: 'INVTYPE_WAIST',
  Legs: 'INVTYPE_LEGS',
  Feet: 'INVTYPE_FEET',
  Finger: 'INVTYPE_FINGER',
  Trinket: 'INVTYPE_TRINKET',
  'Main Hand': 'INVTYPE_WEAPONMAINHAND',
  'Off Hand': 'INVTYPE_WEAPONOFFHAND',
  'One-Hand': 'INVTYPE_WEAPON',
  'Two-Hand': 'INVTYPE_2HWEAPON',
  Ranged: 'INVTYPE_RANGED',
  Shield: 'INVTYPE_SHIELD',
  Holdable: 'INVTYPE_HOLDABLE',
  Relic: 'INVTYPE_RELIC'
};

const SLOT_MODIFIERS: Record<string, number> = {
  INVTYPE_2HWEAPON: 2.0,
  INVTYPE_WEAPONMAINHAND: 1.0,
  INVTYPE_WEAPONOFFHAND: 1.0,
  INVTYPE_RANGED: 0.3164,
  INVTYPE_THROWN: 0.3164,
  INVTYPE_RANGEDRIGHT: 0.3164,
  INVTYPE_SHIELD: 1.0,
  INVTYPE_WEAPON: 1.0,
  INVTYPE_HOLDABLE: 1.0,
  INVTYPE_HEAD: 1.0,
  INVTYPE_NECK: 0.5625,
  INVTYPE_SHOULDER: 0.75,
  INVTYPE_CHEST: 1.0,
  INVTYPE_ROBE: 1.0,
  INVTYPE_WAIST: 0.75,
  INVTYPE_LEGS: 1.0,
  INVTYPE_FEET: 0.75,
  INVTYPE_WRIST: 0.5625,
  INVTYPE_HAND: 0.75,
  INVTYPE_FINGER: 0.5625,
  INVTYPE_TRINKET: 0.5625,
  INVTYPE_CLOAK: 0.5625,
  INVTYPE_RELIC: 0.3164
};

const ENCHANTABLE_SLOTS = new Set([
  'INVTYPE_HEAD',
  'INVTYPE_SHOULDER',
  'INVTYPE_CHEST',
  'INVTYPE_ROBE',
  'INVTYPE_LEGS',
  'INVTYPE_FEET',
  'INVTYPE_WRIST',
  'INVTYPE_HAND',
  'INVTYPE_CLOAK',
  'INVTYPE_WEAPONMAINHAND',
  'INVTYPE_WEAPONOFFHAND',
  'INVTYPE_WEAPON',
  'INVTYPE_2HWEAPON',
  'INVTYPE_SHIELD'
]);

interface Item {
  itemId: number;
  itemLevel: number;
  slot: string;
  quality?: string;
}

class GearScoreCalculator {
  private items: Map<number, Item> = new Map();

  constructor() {
    this.loadItemData();
  }

  private loadItemData() {
    const jsonPath = path.join(process.cwd(), 'items.min.json');
    console.log(`Loading items from ${jsonPath}`);
    try {
      if (!fs.existsSync(jsonPath)) {
        console.error(`Items file not found at ${jsonPath}`);
        return;
      }
      const fileContent = fs.readFileSync(jsonPath, 'utf-8');
      const itemList: Item[] = JSON.parse(fileContent);

      for (const item of itemList) {
        this.items.set(item.itemId, item);
      }
      console.log(`Loaded ${this.items.size} items into the GearScore calculator.`);
    } catch (error) {
      console.error('Failed to load or parse items.min.json:', error);
    }
  }

  // Calculate total GearScore for the provided equipment list
  public calculate(
    equippedItems: { name: string; item: string; transmog?: string; enchant?: boolean }[],
    playerClass?: string
  ): number {
    let totalScore = 0;
    let twoHandCount = 0;
    if (!equippedItems) return 0;

    for (const equippedItem of equippedItems) {
      const itemId = parseInt(equippedItem.item, 10);
      const itemData = this.items.get(itemId);

      if (!itemData) {
        continue;
      }

      let itemLevel = itemData.itemLevel;
      let rarity = QUALITY_TO_RARITY[itemData.quality ?? 'Epic'] ?? 4;

      // Heirloom handling
      if (itemData.quality === 'Heirloom') {
        itemLevel = 0;
      }

      let tableRarity = rarity;
      if (rarity <= 1) tableRarity = 2; // Poor/Common treated as Uncommon
      if (rarity === 5) tableRarity = 4; // Legendary treated as Epic

      const table = itemLevel > 120 ? TABLE_A : TABLE_B;
      const qualityTable = table[tableRarity] ?? table[4];

      const invType = SLOT_TO_INVTYPE[itemData.slot] ?? itemData.slot;
      let slotMod = SLOT_MODIFIERS[invType] ?? 1.0;

      // Titan Grip 2H in offhand detection
      if (invType === 'INVTYPE_2HWEAPON') {
        twoHandCount++;
        if (twoHandCount === 2) {
          slotMod *= 0.5;
        }
      }

      // Hunter special modifiers
      if (playerClass && playerClass.toLowerCase() === 'hunter') {
        if (invType === 'INVTYPE_WEAPONMAINHAND') {
          slotMod *= 0.3164;
        }
        if (invType === 'INVTYPE_RANGED' || invType === 'INVTYPE_RANGEDRIGHT') {
          slotMod *= 5.3224;
        }
      }

      let enchantMod = 1.0;
      if (ENCHANTABLE_SLOTS.has(invType) && equippedItem.enchant === false) {
        enchantMod = 0.98;
      }

      const qualityScale = getQualityScale(rarity);

      let itemScore = Math.floor(
        ((itemLevel - qualityTable.A) / qualityTable.B) * slotMod * SCALE * qualityScale * enchantMod
      );

      if (itemScore < 0) itemScore = 0;

      totalScore += itemScore;
    }

    return Math.round(totalScore);
  }
}

// Export a singleton instance so the data is only loaded once
export const gearScoreCalculator = new GearScoreCalculator();
