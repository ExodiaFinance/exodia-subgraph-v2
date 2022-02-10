/**
 * Assets to track before TreasuryTracker contract was deployed
 */

import { BigInt } from "@graphprotocol/graph-ts"

class Asset {
  name: string
  address: string
  startBlock: BigInt
}

class Bpt {
  name: string
  address: string
  startBlock: BigInt
  poolId: number  
}
export const riskFreeAssets: Asset[] = [
  {
    name: "DAI",
    address: "0x8d11ec38a3eb5e956b052f67da8bdc9bef8abf3e",
    startBlock: BigInt.fromU32(20061547)
  },
  {
    name: "MAI",
    address: "0xfb98b335551a418cd0737375a2ea0ded62ea213b",
    startBlock: BigInt.fromU32(27249605)
  }
]

export const assetsWithRisk: Asset[] = [
  {
    name: "wFTM",
    address: "0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83",
    startBlock: BigInt.fromU32(21161524)
  },
  {
    name: "gOHM",
    address: "0x91fa20244Fb509e8289CA630E5db3E9166233FDc",
    startBlock: BigInt.fromU32(28300476)
  }
]

export const uniLiquidities: Asset[] = [
  {
    name: "SLP_EXODDAI",
    address: "0xc0c1dff0fe24108586e11ec9e20a7cbb405cb769",
    startBlock: BigInt.fromU32(20099251)
  }
]

export const bptLiquidities: Bpt[] = [
  {
    name: "THE_MONOLITH",
    address: "0xa216AA5d67Ef95DdE66246829c5103C7843d1AAB",
    startBlock: BigInt.fromU32(27495398),
    poolId: 37
  },
  {
    name: "fBEETS",
    address: "0xfcef8a994209d6916EB2C86cDD2AFD60Aa6F54b1",
    startBlock: BigInt.fromU32(28965971),
    poolId: 22
  }
]