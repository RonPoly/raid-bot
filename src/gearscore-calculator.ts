import { gearScoreCalculator } from './utils/gearscore-calculator';

export function calculateGearScore(equipment: { name: string; item: string; transmog?: string }[]): number {
  return gearScoreCalculator.calculate(equipment);
}
