import { Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TradeSetting, config } from "../config";
import { getCurrentTimestamp, Platform, sleep, solGrpcStop, solPFBuy, solPFCalcAmountOut, solPFSell, solPfSwapBuyFast, solPfSwapCalcAmount, solPfSwapFetchPoolId, solPfSwapSell, solRaydiumLaunchpadBuyFast, solRaydiumLaunchpadSellFast, solTradeCalcAmountOut, solTrGrpcWalletStart, solTrSwapInspect, solWalletGetTokenAccounts, solWalletImport } from "dv-sol-lib";
import { TakeProfitManager } from "./tpManager";
import { reportBought } from "./report";
import { GlobalTradings } from "./monitor";

export const gSigner = solWalletImport(process.env.PRIVATE_KEY!)!
export const globalTrading = new GlobalTradings(gSigner)

export let curAccountList: any[] = []
let totalProfit = 0
let curTradingTokens: Set<string> = new Set()

async function accountsListingTask() {
  while (true) {
    const accounts = await solWalletGetTokenAccounts(gSigner.publicKey)
    curAccountList = accounts.map((accData: any) => accData.accountInfo.mint.toBase58())
    // console.log(curAccountList)
    await sleep(5000)
  }
}

async function buy(
  signer: Keypair,
  token: string,
  amount: number,
  platform: Platform,
  trInfo: any,
  tradeSetting: TradeSetting
): Promise<number[] | undefined> {
  let tx: string | undefined = undefined
  switch (platform) {
    case 'PumpFun':
      tx = await solPFBuy(
        signer,
        token,
        amount,
        tradeSetting.slippage,
        tradeSetting.prioFee,
        tradeSetting.buyTip,
        trInfo.price,
        trInfo.creator,
        0,
        !curAccountList.includes(token)
      )
      break;
    case 'PumpSwap':
      tx = await solPfSwapBuyFast(
        signer,
        token,
        amount,
        trInfo.swapInfo,
        trInfo.price,
        tradeSetting.slippage,
        tradeSetting.buyTip,
        !curAccountList.includes(token)
      )
      break;
    case 'LaunchLab':
      tx = await solRaydiumLaunchpadBuyFast(
        signer,
        token,
        amount,
        trInfo.swapInfo,
        trInfo.price,
        tradeSetting.slippage,
        tradeSetting.prioFee,
        tradeSetting.buyTip,
        !curAccountList.includes(token)
      )
      break;
    default:
      return undefined
  }

  if (!tx) {
    console.log(`[${token}] Failed to buy!`)
    return undefined
  }

  const swapInfo = await solTrSwapInspect(tx, platform)
  if (!swapInfo)
    return undefined

  reportBought(token, trInfo.block, tx)
  return [swapInfo.solAmount / LAMPORTS_PER_SOL, swapInfo.tokenAmount, swapInfo.price]
}

async function sell(
  signer: Keypair,
  token: string,
  amount: BigInt,
  platform: Platform,
  tradeSetting: TradeSetting
): Promise<string | undefined> {
  let tx: string | undefined = undefined
  switch (platform) {
    case 'PumpFun':
      tx = await solPFSell(
        signer,
        token,
        Number(amount),
        tradeSetting.slippage,
        tradeSetting.prioFee,
        tradeSetting.sellTip
      )
      break;
    case 'PumpSwap':
      tx = await solPfSwapSell(
        signer,
        token,
        amount,
        tradeSetting.slippage,
        tradeSetting.sellTip
      )
    case 'LaunchLab':
      tx = await solRaydiumLaunchpadSellFast(
        signer,
        token,
        amount,
        globalTrading.getSwapInfo(token),
        globalTrading.getPrice(token),
        tradeSetting.slippage,
        tradeSetting.sellTip)
      break;
    default:
      return undefined
  }

  return tx
}

function decideToBuy(trInfo: any): boolean {
  const token = trInfo.what
  const platform = trInfo.where

  if (curTradingTokens.size > 0) {
    console.log(`[${token}] Already trading ${curTradingTokens.size} tokens!`)
    return false
  }

  if (platform !== 'PumpFun' && platform !== 'PumpSwap' && platform !== 'LaunchLab') {
    console.log(`[${token}] Invalid platform: ${platform}`)
    return false
  }

  const solAmount = trInfo.solAmount / LAMPORTS_PER_SOL
  if (solAmount < config.amountRange[0] || solAmount > config.amountRange[1]) {
    console.log(`[${token}] Sol amount out of range: ${solAmount}`)
    return false
  }

  if (curTradingTokens.has(trInfo.what)) {
    console.log(`[${token}] Already in trading!`)
    return false
  }
  return true
}

export async function trade(trInfo: any, tradeSetting: TradeSetting) {

  const token = trInfo.what
  const platform = trInfo.where
  const targetWallet = trInfo.who

  if (!decideToBuy(trInfo))
    return
  console.log(`[${token}] 🚀 Trade started on ${platform} 🚀`)
  let tokenBalance = 0
  let boughtPrice = 0
  let investAmount = 0
  if (tradeSetting.simulation) {
    tokenBalance = await solTradeCalcAmountOut(
      token,
      platform,
      tradeSetting.tradeAmount,
      true
    )
    boughtPrice = tradeSetting.tradeAmount / (tokenBalance / 10 ** 6)
    investAmount = tradeSetting.tradeAmount
  } else {
    const buyResult = await buy(
      gSigner,
      token,
      tradeSetting.tradeAmount,
      platform,
      trInfo,
      tradeSetting
    )
    if (!buyResult)
      return
    investAmount = buyResult[0]
    tokenBalance = buyResult[1]
    boughtPrice = buyResult[2]
  }

  curTradingTokens.add(token)
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

  console.log(`[${token}] bought! (price ${boughtPrice}, amount ${tokenBalance})`)

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
      let sellAmount = Math.floor((sellPercent / 100) * initialTokenBalance)
      if (tokenBalance - sellAmount < 10000)
        sellAmount = tokenBalance

      console.log(`[${token}] selling ${sellAmount} tokens ...`)
      if (tradeSetting.simulation) {
        tokenBalance -= sellAmount
        tpManager.markupLevel(token, tokenPrice)
        const soldAmount = (await solTradeCalcAmountOut(token, platform, sellAmount, false))
        console.log(`[${token}] sold! (price: ${tokenPrice}, amount: ${soldAmount})`)
        returnedAmount += soldAmount
      } else {
        sellTx = await sell(
          gSigner,
          token,
          BigInt(sellAmount),
          trInfo.where,
          tradeSetting
        )
        if (sellTx) {
          tpManager.markupLevel(token, tokenPrice)
          await sleep(1000)
          const tradeInfo = await solTrSwapInspect(sellTx, platform)
          if (tradeInfo) {
            const soldAmount = tradeInfo.solAmount / LAMPORTS_PER_SOL
            console.log(`[${token}] sold! (price: ${tokenPrice}, amount: ${soldAmount})`)
            returnedAmount += soldAmount
            tokenBalance -= tradeInfo.tokenAmount
          }
        }
      }
    }
    await sleep(100)
  }

  const profit = returnedAmount - investAmount
  console.log(`[${token}] +++++++++++++ Trade finished, profit: ${profit}, ${((profit / investAmount) * 100).toFixed(2)}% `)
  totalProfit += profit
  console.log(`💰 Total profit: ${totalProfit}`)
  solGrpcStop(token)
  curTradingTokens.delete(token)
}

accountsListingTask()