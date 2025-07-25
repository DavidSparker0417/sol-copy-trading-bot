import { reportDetectionTime, sleep, solPfSwapBuyFast, solTrGrpcPumpswapStart, solTrGrpcWalletStart, solWalletGetTokenAccounts, solWalletImport } from "dv-sol-lib"
import { exit } from "process"
import { config } from "./config"
import { trade } from "./trade/trade"
import { signatureCache } from "./cache/cache"

async function main() {
  solTrGrpcWalletStart(config.wallets, (data:any) => {
    if (!data || data.type !== "Trade" || data.how !== "buy") 
      return
    
    if (signatureCache.has(data.signature)) {
      return
    }
    signatureCache.add(data.signature)
    
    if (!config.wallets.includes(data.who)) {
      console.error(`[${data.what}] Not in config wallets: ${data.who}`)
      return
    }

    reportDetectionTime(`${data.what}`, data.block, undefined)
    
    trade(data, config.trade)
  })
}

main()