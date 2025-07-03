import { PublicKey } from "@solana/web3.js"

export interface BondingCurveInfo {
  bonding_curve: PublicKey,
  associated_bonding_curve: PublicKey,
  virtual_token_reserves: number,
  virtual_sol_reserves: number,
  creator: PublicKey,
  complete: boolean
}

export interface PumpSwapInfo {
  pool: PublicKey,
  globalConfig: PublicKey,
  baseMint: PublicKey,
  quoteMint: PublicKey,
  poolBaseTokenAccount: PublicKey,
  poolQuoteTokenAccount: PublicKey,
  protocolFeeRecipient: PublicKey,
  protocolFeeRecipientTokenAccount: PublicKey,
  baseTokenProgram: PublicKey,
  quoteTokenProgram: PublicKey,
  systemProgram: PublicKey,
  associatedTokenAccountProgram: PublicKey,
  eventAuthority: PublicKey,
  program: PublicKey,
  coinCreatorVaultAta: PublicKey,
  coinCreatorVaultAtaAuthority: PublicKey
}

export interface PumpTokenInfo {
  mint: string,
  price: number,
  creator: string,
  isPump: boolean,
  triggerSlot: number,
  info: BondingCurveInfo | PumpSwapInfo
}