import { getCurrentTimestamp } from "dv-sol-lib";
import { config } from "../config";

interface TakeProfitLevel {
    percentage: number;
    sellPercent: number;
    executed: boolean;
}

interface TrailingStopLevel {
    trailingPercent: number;
    sellPercent: number;
    executed: boolean;
}

interface TokenTakeProfit {
    mintAddress: string;
    entryPrice: number;
    takeProfitLevels: TakeProfitLevel[];
    trailingStopLevels?: TrailingStopLevel[];
    highestPrice: number;
}

export class TakeProfitManager {
    private tokenTakeProfits: Map<string, TokenTakeProfit>;
    private startTm: number
    private candidateLevel: TakeProfitLevel | undefined

    constructor(mintAddress: string, entryPrice: number, takeProfitLevels: { percentage: number; sellPercent: number }[]) {
        this.tokenTakeProfits = new Map();
        this.initializeToken(mintAddress, entryPrice, takeProfitLevels)
        this.startTm = getCurrentTimestamp() / 1000
    }

    /**
     * Initialize take-profit tracking for a new token
     * @param mintAddress Token mint address
     * @param entryPrice Entry price of the token
     * @param takeProfitLevels Take-profit configuration levels
     */
    initializeToken(
        mintAddress: string,
        entryPrice: number,
        takeProfitLevels: { percentage: number; sellPercent: number }[]
    ): void {
        const levels = takeProfitLevels.map(level => ({
            ...level,
            executed: false
        }));

        this.tokenTakeProfits.set(mintAddress, {
            mintAddress,
            entryPrice,
            takeProfitLevels: levels,
            highestPrice: entryPrice
        });
    }

    /**
     * Check if any take-profit levels have been reached and execute sells
     * @param mintAddress Token mint address
     * @param currentPrice Current token price
     */
    checkTakeProfits(mintAddress: string, currentPrice: number): number {
        const elapsed = (getCurrentTimestamp() / 1000) - this.startTm
        if (elapsed > config.trade.timeout) {
            console.log(`⏰ [${mintAddress}] Timeout reached!`)
            return 100
        }

        if (!currentPrice)
            return 0

        const tokenData = this.tokenTakeProfits.get(mintAddress);
        if (!tokenData) return 0;

        const profitPercentage = ((currentPrice - tokenData.entryPrice) / tokenData.entryPrice) * 100;

        const sl = -profitPercentage
        if (sl > config.trade.sl) {
          console.log(`💔 [${mintAddress}] SL reached! (${sl} %)`)
          return 100;
        }

        if (config.trade.sell.mode !== 'tp')
          return 0;
        
        if (profitPercentage > config.trade.tp) {
            console.log(`🎯 [${mintAddress}] TP reached! (${profitPercentage}%)`)
            return 100
        }

        for (const level of tokenData.takeProfitLevels) {
            if (level.executed)
                continue
            if (profitPercentage >= level.percentage) {
                console.log(`[${mintAddress}] TP level match :`, level)
                this.candidateLevel = level
                return level.sellPercent
            }
        }
        return 0
    }

    markupLevel(mintAddress: string, currentPrice: number) {
        const tokenData = this.tokenTakeProfits.get(mintAddress);
        if (!tokenData) return;
        for (const level of tokenData.takeProfitLevels) {
            if (this.candidateLevel &&
                level.percentage === this.candidateLevel.percentage &&
                level.sellPercent === this.candidateLevel.sellPercent) {
                level.executed = true
                this.candidateLevel = undefined
            }
        }
        // Remove token if all take-profit levels have been executed
        if (tokenData.takeProfitLevels.every(level => level.executed)) {
            this.tokenTakeProfits.delete(mintAddress);
        }
    }

    /**
     * Remove a token from take-profit tracking
     * @param mintAddress Token mint address to remove
     */
    removeToken(mintAddress: string): void {
        this.tokenTakeProfits.delete(mintAddress);
    }

    /**
     * Get current take-profit status for a token
     * @param mintAddress Token mint address
     * @returns Current take-profit status or undefined if not tracking
     */
    getTokenStatus(mintAddress: string): TokenTakeProfit | undefined {
        return this.tokenTakeProfits.get(mintAddress);
    }

    /**
     * Clear all tracked take-profits
     */
    clear(): void {
        this.tokenTakeProfits.clear();
    }
} 