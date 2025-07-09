import { Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { PF_PROGRAM_ID, RAYDIUM_LAUNCHPAD, solTrGrpcWalletStart, SolTrSwapInfo } from "dv-sol-lib"
import { globalTrading, gSigner } from "./trade";

interface TradingStatus {
  buyers: number;
  cumulativeAmount: number;
  aheadOfMe: {
    buyers: number;
    cumulativeAmount: number;
  }
  swapInfo?: SolTrSwapInfo
}

export class GlobalTradings {
  private tradings: Map<string, TradingStatus> = new Map()
  private signer: Keypair

  constructor(signer: Keypair) {
    this.tradings = new Map()
    this.signer = signer
  }

  get myself(): string {
    return this.signer.publicKey.toBase58()
  }

  set(token: string, swapInfo: SolTrSwapInfo) {
    let trStat = this.tradings.get(token)
    const solAmount = swapInfo.solAmount / LAMPORTS_PER_SOL
    if (trStat) {
      if (swapInfo.who === this.myself) {
        trStat.aheadOfMe.buyers = trStat.buyers
        trStat.aheadOfMe.cumulativeAmount = trStat.cumulativeAmount
      }
      trStat.buyers += swapInfo.how === 'buy' ? 1 : -1
      trStat.cumulativeAmount += swapInfo.how === 'buy' ? solAmount : -solAmount
      trStat.swapInfo = swapInfo
    } else {
      trStat = {
        buyers: swapInfo.how === 'buy' ? 1 : -1,
        cumulativeAmount: swapInfo.how === 'buy' ? solAmount : -solAmount,
        aheadOfMe: {
          buyers: 0,
          cumulativeAmount: 0,
        }
      }
      setTimeout(() => {
        this.tradings.delete(token)
      }, 1000 * 60 * 10)
    }
    this.tradings.set(token, trStat)
  }

  get(token: string): TradingStatus | undefined {
    return this.tradings.get(token)
  }

  getBondInfo(token: string): any {
    const trStat = this.get(token)
    if (!trStat)
      return undefined
    return trStat.swapInfo?.bondInfo
  }

  getSwapInfo(token: string): any {
    const trStat = this.get(token)
    if (!trStat)
      return undefined
    return trStat.swapInfo?.swapInfo
  }

  getPrice(token: string): number {
    const trStat = this.get(token)
    if (!trStat)
      return 0
    return trStat.swapInfo?.price || 0
  }

  remove(token: string) {
    this.tradings.delete(token)
  }

  getBuyers(token: string): number {
    const trStat = this.get(token)
    if (!trStat)
      return 0
    return trStat.buyers
  }

  getCumulativeAmount(token: string): number {
    const trStat = this.get(token)
    if (!trStat)
      return 0
    return trStat.cumulativeAmount
  }

  getAheadOfMe(token: string): { buyers: number, cumulativeAmount: number } {
    const trStat = this.get(token)
    const dummyRet = {
      buyers: 0,
      cumulativeAmount: 0,
    }
    if (!trStat)
      return dummyRet
    return {
      buyers: trStat.aheadOfMe.buyers || trStat.buyers,
      cumulativeAmount: trStat.aheadOfMe.cumulativeAmount || trStat.cumulativeAmount,
    }
  }
}


solTrGrpcWalletStart([RAYDIUM_LAUNCHPAD], (data: any) => {
  if (data.type !== 'Trade') {
    return
  }
  globalTrading.set(data.what, data)
})

// solTrGrpcWalletStart([PF_PROGRAM_ID.toBase58()], (data: any) => {
//   if (data.type !== 'Trade') {
//     return
//   }
//   globalTrading.set(data.what, data.swapInfo)
// })