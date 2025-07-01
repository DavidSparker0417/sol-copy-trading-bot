import { Keypair } from "@solana/web3.js";
import { TradeSetting, config } from "../config";
import { tradePumpfun } from "./pumpfun";
import { sleep, solWalletGetTokenAccounts, solWalletImport } from "dv-sol-lib";
import { tradePumpSwap } from "./pumpswap";

export const gSigner = solWalletImport(process.env.PRIVATE_KEY!)!
export let curAccountList: any[] = []

async function accountsListingTask() {
  while (true) {
    const accounts = await solWalletGetTokenAccounts(gSigner.publicKey)
    curAccountList = accounts.map((accData:any) => accData.accountInfo.mint.toBase58())
    // console.log(curAccountList)
    await sleep(5000)
  }
}

export function determineToSell(token: string, passedTm: number, tp: number, tradeSetting: TradeSetting): boolean {
  if (passedTm > tradeSetting.timeout) {
    console.log(`[${token}] ********* Timeout! *********`)
    return true
  }
  const sl = 0 - tp
  if (sl > tradeSetting.sl) {
    console.log(`[${token}] ********* SL met! *********`)
    return true
  }
  if (tradeSetting.sell.mode === 'tp' && tp > tradeSetting.tp) {
    console.log(`[${token}] ********* TP met! *********`)
    return true
  }

  return false
}

export async function trade(trInfo: any) {
  // console.log(trInfo)
  switch (trInfo.where) {
    case 'PumpFun':
      tradePumpfun(gSigner, trInfo.who, {
        mint: trInfo.what,
        price: trInfo.price,
        creator: trInfo.creator,
        isPump: true,
        triggerSlot: trInfo.block,
        info: trInfo.bcInfo,
      }, config.trade)
      break;
    case 'PumpSwap':
      tradePumpSwap(gSigner, trInfo.who, {
        mint: trInfo.what,
        price: trInfo.price,
        creator: trInfo.creator,
        isPump: true,
        triggerSlot: trInfo.block,
        info: trInfo.swapInfo,
      }, config.trade)
      break;
    default:
      break;
  }
}

accountsListingTask()