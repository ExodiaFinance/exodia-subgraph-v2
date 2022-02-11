import { Address, BigDecimal, BigInt, Bytes, log } from "@graphprotocol/graph-ts"
import { Treasury } from "../../generated/schema"
import { TreasuryTracker } from "../../generated/TreasuryTracker/TreasuryTracker"
import { BEETHOVEN_MASTERCHEF_CONTRACT, DAO_WALLET, TREASURY_CONTRACT, TREASURY_TRACKER_CONTRACT } from "../utils/constants"
import { updateBptLiquidities, updateUniLiquidities } from "./Liquidity"
import { TokenValue, updateTokenBalances } from "./TokenBalance"
import { bptLiquidities, uniLiquidities, assetsWithRisk, riskFreeAssets } from "../utils/assetMap"
import { ERC20 } from "../../generated/TreasuryTracker/ERC20"
import { toDecimal } from "../utils/helpers"
import { BeethovenxMasterChef } from "../../generated/TreasuryTracker/BeethovenxMasterChef"
import { updateRunway } from "./ProtocolMetric"
 
export function updateTreasury(dayTimestamp: string, blockNumber: BigInt): void {
  const treasury = loadOrCreateTreasury(dayTimestamp)
  const treasuryValues: TokenValue = {
    riskFreeValue: BigDecimal.zero(),
    riskyValue: BigDecimal.zero()
  }

  //if TreasuryTracker contract deployed
  if (blockNumber.gt(BigInt.fromU32(30018644))) {
    const treasuryTrackerContract = TreasuryTracker.bind(Address.fromString(TREASURY_TRACKER_CONTRACT))
    const bpts = treasuryTrackerContract.getBPTs()
    const uniLps = treasuryTrackerContract.getUniLPs()
    const riskFreeAssets = treasuryTrackerContract.getRiskFreeAssets()
    const assetsWithRisks = treasuryTrackerContract.getAssetsWithRisk()
    
    const bptValues = updateBptLiquidities(bpts, dayTimestamp)
    const uniLpValues = updateUniLiquidities(uniLps, dayTimestamp)
    const riskFreeValues = updateTokenBalances(riskFreeAssets, dayTimestamp, true)
    const riskyValues = updateTokenBalances(assetsWithRisks, dayTimestamp, false)

    treasuryValues.riskFreeValue = bptValues.riskFreeValue
      .plus(uniLpValues.riskFreeValue)
      .plus(riskFreeValues.riskFreeValue)
      .plus(riskyValues.riskFreeValue)
    treasuryValues.riskyValue = bptValues.riskyValue
      .plus(uniLpValues.riskyValue)
      .plus(riskFreeValues.riskyValue)
      .plus(riskyValues.riskyValue)
  } else {
    const bpt = getBpts(blockNumber)
    const uniLp = getUniLps(blockNumber)
    const riskFreeAsset = getRiskFreeAssets(blockNumber)
    const assetsWithRisks = getAssetsWithRisks(blockNumber)
    
    const bptValues = updateBptLiquidities(bpt.addresses, dayTimestamp, bpt.balances)
    const uniLpValues = updateUniLiquidities(uniLp.addresses, dayTimestamp, uniLp.balances)
    const riskFreeValues = updateTokenBalances(riskFreeAsset.addresses, dayTimestamp, true, riskFreeAsset.balances)
    const riskyValues = updateTokenBalances(assetsWithRisks.addresses, dayTimestamp, false, assetsWithRisks.balances)

    treasuryValues.riskFreeValue = bptValues.riskFreeValue
      .plus(uniLpValues.riskFreeValue)
      .plus(riskFreeValues.riskFreeValue)
      .plus(riskyValues.riskFreeValue)
    treasuryValues.riskyValue = bptValues.riskyValue
      .plus(uniLpValues.riskyValue)
      .plus(riskFreeValues.riskyValue)
      .plus(riskyValues.riskyValue)
  }

  treasury.riskFreeValue = treasuryValues.riskFreeValue
  treasury.marketValue = treasuryValues.riskFreeValue.plus(treasuryValues.riskyValue)
  treasury.save()
  updateRunway(dayTimestamp, treasury.riskFreeValue)
}

export function loadOrCreateTreasury(timestamp: string): Treasury {
  let treasury = Treasury.load(timestamp)
  if (!treasury) {
    treasury = new Treasury(timestamp)
    treasury.marketValue = BigDecimal.zero()
    treasury.riskFreeValue = BigDecimal.zero()
  }
  return treasury
}

class assetBalances {
  addresses: Address[]
  balances: BigDecimal[]
}

function getBpts(blockNumber: BigInt): assetBalances {
  const addresses: Address[] = []
  const balances: BigDecimal[] = []

  for (let i = 0; i < bptLiquidities.length; i++) {
    if (blockNumber.gt(bptLiquidities[i].startBlock)) {
      addresses.push(Address.fromString(bptLiquidities[i].address))

      const bptERC20 = ERC20.bind(Address.fromString(bptLiquidities[i].address))
      const decimals = bptERC20.decimals()
      //treasury balance
      const treasuryBalance = toDecimal(bptERC20.balanceOf(Address.fromString(TREASURY_CONTRACT)), decimals)
      //dao wallet balance
      const daoBalance = toDecimal(bptERC20.balanceOf(Address.fromString(DAO_WALLET)), decimals)
      //farming balance
      const masterChefContract = BeethovenxMasterChef.bind(Address.fromString(BEETHOVEN_MASTERCHEF_CONTRACT))
      const farmingBalance = toDecimal(
        masterChefContract.userInfo(
          BigInt.fromString(bptLiquidities[i].poolId.toString()),
          Address.fromString(DAO_WALLET)
        ).value0,
        decimals
      )
      //total balance
      const totalBalance = treasuryBalance.plus(daoBalance).plus(farmingBalance)
      balances.push(totalBalance)
    }
  }

  return {
    addresses,
    balances,
  }
}
function getUniLps(blockNumber: BigInt): assetBalances {
  const addresses: Address[] = []
  const balances: BigDecimal[] = []
  
  for (let i = 0; i < uniLiquidities.length; i++) {
    if (blockNumber.gt(uniLiquidities[i].startBlock)) {
      addresses.push(Address.fromString(uniLiquidities[i].address))

      const uniLpERC20 = ERC20.bind(Address.fromString(uniLiquidities[i].address))
      const decimals = uniLpERC20.decimals()
      //treasury balance
      const treasuryBalance = toDecimal(uniLpERC20.balanceOf(Address.fromString(TREASURY_CONTRACT)), decimals)
      //dao wallet balance
      const daoBalance = toDecimal(uniLpERC20.balanceOf(Address.fromString(DAO_WALLET)), decimals)
      //total balance
      const totalBalance = treasuryBalance.plus(daoBalance)
      balances.push(totalBalance)
    }
  }

  return {
    addresses,
    balances
  }
}
function getRiskFreeAssets(blockNumber: BigInt): assetBalances {
  const addresses: Address[] = []
  const balances: BigDecimal[] = []
  
  for (let i = 0; i < riskFreeAssets.length; i++) {
    if (blockNumber.gt(riskFreeAssets[i].startBlock)) {
      addresses.push(Address.fromString(riskFreeAssets[i].address))

      const assetERC20 = ERC20.bind(Address.fromString(riskFreeAssets[i].address))
      const decimals = assetERC20.decimals()
      //treasury balance
      const treasuryBalance = toDecimal(assetERC20.balanceOf(Address.fromString(TREASURY_CONTRACT)), decimals)
      //dao wallet balance
      const daoBalance = toDecimal(assetERC20.balanceOf(Address.fromString(DAO_WALLET)), decimals)
      //total balance
      const totalBalance = treasuryBalance.plus(daoBalance)
      balances.push(totalBalance)
    }
  }

  return {
    addresses,
    balances
  }
}
function getAssetsWithRisks(blockNumber: BigInt): assetBalances {
  const addresses: Address[] = []
  const balances: BigDecimal[] = []
  
  for (let i = 0; i < assetsWithRisk.length; i++) {
    if (blockNumber.gt(assetsWithRisk[i].startBlock)) {
      addresses.push(Address.fromString(assetsWithRisk[i].address))

      const assetERC20 = ERC20.bind(Address.fromString(assetsWithRisk[i].address))
      const decimals = assetERC20.decimals()
      //treasury balance
      const treasuryBalance = toDecimal(assetERC20.balanceOf(Address.fromString(TREASURY_CONTRACT)), decimals)
      //dao wallet balance
      const daoBalance = toDecimal(assetERC20.balanceOf(Address.fromString(DAO_WALLET)), decimals)
      //total balance
      const totalBalance = treasuryBalance.plus(daoBalance)
      balances.push(totalBalance)
    }
  }

  return {
    addresses,
    balances
  }
}