import { sleep } from "dv-sol-lib"
import { priceAmountOut, priceMonitor } from "../src/trade/pricing"

async function test() {
  const token = "9ahJKQEjiS9n9fcKhr98P42Z3f6wboPbT2K4hWK6pump"
  priceMonitor(token)
  await sleep(1000)
  const tokenAmount = priceAmountOut(token, BigInt(2163866419029), false)
  console.log(tokenAmount)
}
test()
