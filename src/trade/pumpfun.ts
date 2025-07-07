import { Keypair } from "@solana/web3.js";
import { getCurrentTimestamp, PumpfunBondInfo, sleep, solGrpcStart, solGrpcStop, solPFBuy, solPFCalcAmountOut, solPFSell, solTokenBalance, solTrGrpcWalletStart, solTrSwapInspect } from "dv-sol-lib";
import { TradeSetting } from "../config";
import { PumpSwapInfo, PumpTokenInfo } from "../types";
import { reportBought } from "./report";
import { curAccountList, curTradingTokens, determineToSell } from "./trade";
import { TakeProfitManager } from "./tpManager";

async function buy(
  signer: Keypair,
  token: string,
  amount: number,
  tokenInfo: PumpTokenInfo,
  tradeSetting: TradeSetting
): Promise<number[] | undefined> {
  const tx = await solPFBuy(
    signer,
    token,
    amount,
    tradeSetting.slippage,
    tradeSetting.prioFee,
    {
      type: "0slot",
      amount: tradeSetting.buyTip
    },
    tokenInfo.price,
    tokenInfo.creator,
    0,
    !curAccountList.includes(token)
  )

  if (!tx) {
    console.log(`[${token}] Failed to buy!`)
    return undefined
  }
  reportBought(token, tokenInfo.triggerSlot, tx)

  const tradeInfo = await solTrSwapInspect(tx, "PumpFun")
  if (!tradeInfo)
    return undefined

  return [tradeInfo.solAmount, tradeInfo.tokenAmount, tradeInfo.price]
}

export async function tradePumpfun(
  signer: Keypair,
  targetWallet: string,
  tokenInfo: PumpTokenInfo,
  tradeSetting: TradeSetting
) {
  const token = tokenInfo.mint

  let tokenBalance = 0
  let boughtPrice = 0
  let investAmount = 0
  if (tradeSetting.simulation) {
    tokenBalance = await solPFCalcAmountOut(
      token,
      tradeSetting.tradeAmount,
      true
    )
    boughtPrice = tradeSetting.tradeAmount / (tokenBalance / 10 ** 3)
    investAmount = tradeSetting.tradeAmount
  } else {
    const buyResult = await buy(signer, token, tradeSetting.tradeAmount, tokenInfo, tradeSetting)
    if (!buyResult)
      return
    investAmount = buyResult[0]
    tokenBalance = buyResult[1]
    boughtPrice = buyResult[2]
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

  console.log(`[${token}] boughtPrice: ${boughtPrice}`)

  const buyTime = getCurrentTimestamp()
  let oldPrice = boughtPrice
  let sellTx
  let logTm = 0
  let returnedAmount = 0
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
    if (sellPercent) {
      let sellAmount = ((sellPercent / 100) * initialTokenBalance)
      if (tokenBalance - sellAmount < 10000)
        sellAmount = tokenBalance

      if (tradeSetting.simulation) {
        tokenBalance -= sellAmount
        tpManager.markupLevel(token, tokenPrice)
        returnedAmount += await solPFCalcAmountOut(token, sellAmount, false)
      } else {
        sellTx = await solPFSell(
          signer,
          token,
          sellAmount,
          tradeSetting.slippage,
          0,
          tradeSetting.sellTip ? {
            type: "0slot",
            amount: tradeSetting.sellTip
          } : 0
        )
        if (sellTx) {
          tpManager.markupLevel(token, tokenPrice)
          await sleep(1000)
          const tradeInfo = await solTrSwapInspect(sellTx, "PumpFun")
          if (tradeInfo) {
            returnedAmount += tradeInfo.solAmount
            tokenBalance -= tradeInfo.tokenAmount
          }
        }
      }
    }
    await sleep(100)
  }

  const profit = returnedAmount - investAmount
  console.log(`[${token}] +++++++++++++ Trade finished, profit: ${profit}, ${((profit / investAmount) * 100).toFixed(2)}%`)
  solGrpcStop(token)
}