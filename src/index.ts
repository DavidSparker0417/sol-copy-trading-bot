import { reportDetectionTime, sleep, solPfSwapBuyFast, solTrGrpcPumpswapStart, solTrGrpcWalletStart, solWalletGetTokenAccounts, solWalletImport } from "dv-sol-lib"
import { exit } from "process"
import { config } from "./config"
import { trade } from "./trade/trade"

async function main() {
  solTrGrpcWalletStart(config.wallets, (data:any) => {
    if (!data || data.type !== "Trade" || data.how !== "buy") 
      return
    trade(data)
  })
  // solTrGrpcPumpswapStart(async (data:any) => {
  //   if (!data || data.type !== "Trade" || data.how !== "buy") return
  //   const token = data.what
  //   console.log(`[Trigger](${data.who}) buying token (${token}) ...`)
  //   const createAta = !curAccountList.includes(token)
  //   const tx = await solPfSwapBuyFast(
  //     gSigner, 
  //     data.what, 
  //     0.01, 
  //     data.swapInfo, 
  //     data.price, 
  //     0, 
  //     0.0001, 
  //     createAta
  //   )
  //   console.log(tx)
  //   if (tx) {
  //     await reportBought(token, tx, data.slot)
  //   }
  //   exit(0)
  // }, [
  //   "72hnrBfdb9ojfTRb45Zx5NryyXj8MEWFhAMjRgJdiib7",
  //   "5SqS33RoZkJ5WrVm3ZtGEx35e7HLuQW2wWHHVvc1oHAz",
  //   "AkDaQewQfjjFaDLZPz2oAmyY8soPiXXQL4m1zw56hiSy",
  //   "4Y2DokAhLddBbwSaN9jFS8r3bbJY2cxZDY4QTSTp7mk4",
  //   "93deG1tvZvc9pD5kXEux5xs7sf3d1SPDzH6VJwfe2c1x"
  // ])
}

main()