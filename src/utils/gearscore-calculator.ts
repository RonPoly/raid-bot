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

  // The 'equippedItems' array comes from the Warmane API response
  public calculate(equippedItems: { name: string; item: string; transmog?: string }[]): number {
    console.log('Calculating GearScore for equipment:', equippedItems);
    let totalScore = 0;
    if (!equippedItems) return 0;

    for (const equippedItem of equippedItems) {
      const itemId = parseInt(equippedItem.item, 10);
      const itemData = this.items.get(itemId);

      if (!itemData) {
        console.warn(`Item ID ${itemId} not found in items map`);
        continue;
      }

      const slot = itemData.slot;
      const weight = GEAR_SLOT_WEIGHTS[slot] || 0;
      if (weight > 0) {
        totalScore += itemData.itemLevel * weight;
        console.log(`Added ${itemData.itemLevel} * ${weight} for slot ${slot} (ID ${itemId})`);
      } else {
        console.log(`Slot ${slot} (ID ${itemId}) has no weight`);
      }
    }
    console.log('Final GearScore:', Math.round(totalScore));
    return Math.round(totalScore);
  }
}

// Export a singleton instance so the data is only loaded once
export const gearScoreCalculator = new GearScoreCalculator();
