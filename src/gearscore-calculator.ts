import { gearScoreCalculator } from './utils/gearscore-calculator';

export function calculateGearScore(equipment: { name: string; itemID: string }[]): number {
  return gearScoreCalculator.calculate(equipment);
}
