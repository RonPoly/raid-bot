import * as fs from 'fs';
import * as path from 'path';
import { GEAR_SLOT_WEIGHTS } from './gearscore-weights';

interface Item {
  itemId: number;
  itemLevel: number;
  slot: string;
}

class GearScoreCalculator {
  private items: Map<number, Item> = new Map();

  constructor() {
    this.loadItemData();
  }

  private loadItemData() {
    try {
      // Assumes equippable_items.json is in the project's root directory
      const jsonPath = path.join(__dirname, '../../items.min.json');
      const fileContent = fs.readFileSync(jsonPath, 'utf-8');
      const itemList: Item[] = JSON.parse(fileContent);

      for (const item of itemList) {
        this.items.set(item.itemId, item);
      }
      console.log(`Loaded ${this.items.size} items into the GearScore calculator.`);
    } catch (error) {
      console.error('Failed to load or parse equippable_items.json:', error);
    }
  }

  // The 'equippedItems' array comes from the Warmane API response
  public calculate(equippedItems: { name: string; itemID: string }[]): number {
    let totalScore = 0;
    if (!equippedItems) return 0;

    for (const equippedItem of equippedItems) {
      const itemId = parseInt(equippedItem.itemID, 10);
      const itemData = this.items.get(itemId);

      if (itemData) {
        const slot = itemData.slot;
        const weight = GEAR_SLOT_WEIGHTS[slot] || 0;
        if (weight > 0) {
          totalScore += itemData.itemLevel * weight;
        }
      }
    }
    return Math.round(totalScore);
  }
}

// Export a singleton instance so the data is only loaded once
export const gearScoreCalculator = new GearScoreCalculator();
