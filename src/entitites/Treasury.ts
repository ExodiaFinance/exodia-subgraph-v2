import { Address, BigDecimal } from "@graphprotocol/graph-ts"
import { Treasury } from "../../generated/schema"
import { TreasuryTracker } from "../../generated/TreasuryTracker/TreasuryTracker"
import { TREASURY_TRACKER_CONTRACT } from "../utils/constants"
import { updateBptLiquidities, updateUniLiquidities } from "./Liquidity"
import { updateProtocolMetric } from "./ProtocolMetric"
import { updateTokenBalances } from "./TokenBalance"

export function updateTreasury(dayTimestamp: string): void {
  const treasuryTrackerContract = TreasuryTracker.bind(Address.fromString(TREASURY_TRACKER_CONTRACT))
  const bptTokens = treasuryTrackerContract.getBPTs()
  const uniLpTokens = treasuryTrackerContract.getUniLPs()
  const riskFreeAssetTokens = treasuryTrackerContract.getRiskFreeAssets()
  const assetWithRiskTokens = treasuryTrackerContract.getAssetsWithRisk()

  updateBptLiquidities(bptTokens, dayTimestamp)
  updateUniLiquidities(uniLpTokens, dayTimestamp)
  updateTokenBalances(riskFreeAssetTokens, dayTimestamp, true)
  updateTokenBalances(assetWithRiskTokens, dayTimestamp)

  updateProtocolMetric(dayTimestamp)
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