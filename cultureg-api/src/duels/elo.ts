/**
 * Compute Elo deltas for a 1v1 duel.
 * Uses a simplified Elo formula:
 *   K = 32
 *   expected = 1 / (1 + 10^((opponentElo - playerElo) / 400))
 *   delta = round(K * (result - expected))
 *
 * result: 1 = win, 0.5 = draw, 0 = loss
 */
export function eloDeltaDuel(
    playerElo: number,
    opponentElo: number,
    result: "win" | "draw" | "loss"
): number {
    const K = 32;
    const expected = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
    const score = result === "win" ? 1 : result === "draw" ? 0.5 : 0;
    return Math.round(K * (score - expected));
}
