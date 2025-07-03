import { sleep } from "dv-sol-lib"
import * as fs from 'fs';

type SellMode = 'tp'|'follow'|'climb'
export interface TradeSetting {
  tradeAmount: number,
  tp: number,
  sl: number,
  slippage: number,
  buyTip: number,
  sellTip: number,
  prioFee: number,
  timeout: number,
  simulation: boolean,
  sell: {
    mode: SellMode,
    takeProfits: {
      percentage: number,
      sellPercent: number
    }[]
  }
}

interface Config {
  wallets: string[],
  amountRange: [number, number],
  trade: TradeSetting,
}

export let config: Config

async function loadConfig() {
  while (true) {
    try {
      const fdata = fs.readFileSync('config.json', 'utf8')
      config = JSON.parse(fdata)
      // console.log(config.priceMonitor)
      await sleep(5000)
    } catch (error) { }
  }
}

loadConfig()