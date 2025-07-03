import { sleep, solPfSwapSell, solWalletImport } from "dv-sol-lib"

const signer = solWalletImport(process.env.PRIVATE_KEY!)!
async function test() {
  const token = "65P7CAT38ePXVPtoTaefmMkpwKS7Lq454HV7g4B4pump"
  const tx = await solPfSwapSell(signer, token, 16889000000, 100, 0)
  console.log(tx)
}
test()
