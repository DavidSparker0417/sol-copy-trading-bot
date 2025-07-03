import { getCurrentTimestamp, solBlockTimeGet, solTrGetTimestamp } from "dv-sol-lib";

export async function reportBought(token: string, triggerSlot: number, tx: string) {
  const curTime = getCurrentTimestamp()
  const evBlockInf = await solTrGetTimestamp(tx)
  if (!evBlockInf) return
  console.log(`[${token}] +++++++++++ Bought after ${evBlockInf.blockNumber - triggerSlot} blocks! +++++++++++`)
}