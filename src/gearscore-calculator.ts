import { gearScoreCalculator } from './utils/gearscore-calculator';

export interface EquippedItem {
  name: string;
  item: string;
  transmog?: string;
  enchant?: boolean;
}

export function calculateGearScore(equipment: EquippedItem[], playerClass?: string): number {
  return gearScoreCalculator.calculate(equipment, playerClass);
}
