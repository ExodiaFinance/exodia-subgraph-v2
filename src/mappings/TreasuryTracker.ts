import { ethereum, Address } from '@graphprotocol/graph-ts'
import { Treasury } from '../../generated/schema'
import { TREASURY_TRACKER_CONTRACT } from '../utils/constants'
import { TreasuryTracker } from '../../generated/TreasuryTracker/TreasuryTracker'
import { updateBptLiquidities, updateUniLiquidities } from '../entitites/Liquidity'
import { updateTokenBalances } from '../entitites/TokenBalance'
import { dayFromTimestamp } from '../utils/helpers'
import { updateProtocolMetric } from '../entitites/ProtocolMetric'

export function handleBlock(block: ethereum.Block): void {
  if (block.timestamp.toU32() % 86400 < 5) {
    const dayTimestamp = dayFromTimestamp(block.timestamp)
    const treasury = Treasury.load(dayTimestamp)
    if (!treasury) {
      updateTreasury(dayTimestamp)
    }
  }
}

function updateTreasury(dayTimestamp: string): void {
  const treasuryTrackerContract = TreasuryTracker.bind(Address.fromString(TREASURY_TRACKER_CONTRACT))
  const bptTokens = treasuryTrackerContract.getBPTs()
  const uniLpTokens = treasuryTrackerContract.getUniLPs()
  const riskFreeAssetTokens = treasuryTrackerContract.getRiskFreeAssets()
  const assetWithRiskTokens = treasuryTrackerContract.getAssetsWithRisk()

  updateBptLiquidities(bptTokens, dayTimestamp)
  updateUniLiquidities(uniLpTokens, dayTimestamp)
  updateTokenBalances(riskFreeAssetTokens, dayTimestamp, true).values
  updateTokenBalances(assetWithRiskTokens, dayTimestamp).values

  updateProtocolMetric(dayTimestamp)
}