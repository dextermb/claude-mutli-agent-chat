export function formatCost(costUsd: number): string {
  return `$${costUsd.toFixed(costUsd >= 0.01 ? 2 : 3)}`
}
