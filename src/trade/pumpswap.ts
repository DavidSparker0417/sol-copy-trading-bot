import { Keypair } from "@solana/web3.js";
import { getCurrentTimestamp, PumpfunBondInfo, sleep, solGrpcStart, solGrpcStop, solPFBuy, solPFSell, solPfSwapBuyFast, solPfSwapSell, solTokenBalance, solTrGrpcWalletStart, solTrSwapInspect } from "dv-sol-lib";
import { TradeSetting } from "../config";
import { PumpSwapInfo, PumpTokenInfo } from "../types";
import { reportBought } from "./report";
import { curAccountList, curTradingTokens, determineToSell } from "./trade";
import { TakeProfitManager } from "./tpManager";

export async function tradePumpSwap(
  signer: Keypair,
  targetWallet: string,
  tokenInfo: PumpTokenInfo,
  tradeSetting: TradeSetting
) {
  const token = tokenInfo.mint
  const pumpSwapInfo = tokenInfo.info as PumpSwapInfo
  const tx = await solPfSwapBuyFast(
    signer,
    token,
    tradeSetting.tradeAmount,
    pumpSwapInfo,
    tokenInfo.price,
    tradeSetting.slippage,
    {
      type: "0slot",
      amount: tradeSetting.buyTip
    },
    !curAccountList.includes(token)
  )

  if (!tx) {
    console.log(`[${token}] Failed to buy!`)
    return
  }
  curTradingTokens.add(token)
  reportBought(token, tokenInfo.triggerSlot, tx)

  let tokenBalance = 0
  let boughtPrice = 0
  const tradeInfo = await solTrSwapInspect(tx, "PumpSwap")
  if (tradeInfo) {
    tokenBalance = tradeInfo.tokenAmount
    boughtPrice = tradeInfo.price
  }

  let tokenPrice = boughtPrice
  let instantSell: boolean = false
  solTrGrpcWalletStart([token], (data: any) => {
    if (data.type !== 'Trade')
      return
    if (tradeSetting.sell.mode === 'follow' && data.who === targetWallet && data.how === 'sell') {
      console.log(`[${token}] Sell event of target wallet.`)
      instantSell = true
    }
    tokenPrice = data.price
  })

  console.log(`[${token}] Buy tx : ${tx}, boughtPrice: ${boughtPrice}, boughtToken: ${tokenBalance}`)

  const buyTime = getCurrentTimestamp()
  let oldPrice = boughtPrice
  let sellTx
  let logTm = 0
  const initialTokenBalance = tokenBalance
  const tpManager = new TakeProfitManager(token, boughtPrice, tradeSetting.sell.takeProfits)
  while (tokenBalance) {
    const tp = ((tokenPrice / boughtPrice) - 1) * 100
    const passedTm = (getCurrentTimestamp() - buyTime) / 1000
    if (oldPrice !== tokenPrice || passedTm - logTm > 1) {
      console.log(`[${token}] ++++++++ (${tokenPrice}/${boughtPrice})(${tp.toFixed(4)}%), ${passedTm.toFixed(2)}s`)
      oldPrice = tokenPrice
      logTm = passedTm
    }
    const sellPercent = instantSell ? 100 : tpManager.checkTakeProfits(token, tokenPrice)
    // if (instantSell || determineToSell(token, passedTm, tp, tradeSetting)) {
    if (sellPercent) {
      let sellAmount = ((sellPercent / 100) * initialTokenBalance)
      if (tokenBalance - sellAmount < 10000)
        sellAmount = tokenBalance
      sellTx = await solPfSwapSell(
        signer,
        token,
        sellAmount,
        tradeSetting.slippage,
        tradeSetting.sellTip ? {
          type: "0slot",
          amount: tradeSetting.sellTip
        } : 0
      )
      await sleep(1000)
      if (sellTx) {
        tokenBalance = Number((await solTokenBalance(token, signer.publicKey))[0])
        tpManager.markupLevel(token, tokenPrice)
      }
    }
    await sleep(100)
  }

  curTradingTokens.delete(token)
  solGrpcStop(token)
}