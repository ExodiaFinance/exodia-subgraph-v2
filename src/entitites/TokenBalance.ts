import { BigDecimal, Address, ByteArray, BigInt } from "@graphprotocol/graph-ts"
import { TokenBalance, Treasury } from "../../generated/schema"
import { ERC20 } from "../../generated/TreasuryTracker/ERC20"
import { PriceOracle } from "../../generated/TreasuryTracker/PriceOracle"
import { TreasuryTracker } from "../../generated/TreasuryTracker/TreasuryTracker"
import { UniswapV2Pair } from "../../generated/TreasuryTracker/UniswapV2Pair"
import { WeightedPool2 } from "../../generated/TreasuryTracker/WeightedPool2"
import { TREASURY_TRACKER_CONTRACT } from "../utils/constants"
import { getExodPrice, toDecimal } from "../utils/helpers"
import { priceMaps } from "../utils/priceMap"
import { getIndex, updateRunway } from "./ProtocolMetric"
import { loadOrCreateToken } from "./Token"
import { loadOrCreateTreasury } from "./Treasury"

export function loadOrCreateTokenBalance(id: string): TokenBalance {
  let tokenBalance = TokenBalance.load(id)
  if (!tokenBalance) {
    tokenBalance = new TokenBalance(id)
    tokenBalance.token = ''
    tokenBalance.balance = BigDecimal.zero()
    tokenBalance.value = BigDecimal.zero()
    tokenBalance.treasury = ''
    tokenBalance.isRiskFree = false
    tokenBalance.isLiquidity = false
    tokenBalance.liquidity = ''
    tokenBalance.timestamp = BigInt.zero()
  }
  return tokenBalance
}

export function updateTokenBalances(
  tokens: Address[],
  timestamp: string,
  riskFree: boolean = false,
  balances: BigDecimal[] = [],
  liquidityId: string = '',
): void {
  for (let i = 0; i < tokens.length; i++) {
    if (balances.length) {
      updateTokenBalance(
        tokens[i],
        timestamp,
        riskFree,
        balances[i],
        liquidityId,
      )
    } else {
      updateTokenBalance(tokens[i], timestamp, riskFree, BigDecimal.zero(), liquidityId)
    }
  }
}

export function updateTokenBalance(
  address: Address,
  timestamp: string,
  riskFree: boolean = false,
  balance: BigDecimal = BigDecimal.zero(),
  liquidityId: string = '',
): void {
  const addressString = address.toHexString()
    const token = loadOrCreateToken(addressString)
    const id = !!liquidityId ? `${addressString}-${timestamp}-${liquidityId}` : `${addressString}-${timestamp}`

    const tokenBalance = loadOrCreateTokenBalance(id)

    if (balance.gt(BigDecimal.zero())) {
      tokenBalance.balance = balance
    } else {
      const tokenERC20 = ERC20.bind(address)
      const decimals = tokenERC20.decimals()
      const treasuryTrackerContract = TreasuryTracker.bind(Address.fromString(TREASURY_TRACKER_CONTRACT))
      const balance = toDecimal(treasuryTrackerContract.balance(address), decimals)
      tokenBalance.balance = balance
    }
    tokenBalance.value = getPrice(address).times(tokenBalance.balance)
    tokenBalance.treasury = timestamp
    tokenBalance.isRiskFree = riskFree
    tokenBalance.isLiquidity = !!liquidityId
    tokenBalance.liquidity = liquidityId ? liquidityId : null
    tokenBalance.timestamp = BigInt.fromString(timestamp)
    tokenBalance.token = token.id
    tokenBalance.save()

    const treasury = loadOrCreateTreasury(timestamp)

    if (riskFree) {
      treasury.riskFreeValue = treasury.riskFreeValue.plus(tokenBalance.value)
      treasury.marketValue = treasury.marketValue.plus(tokenBalance.value)
      updateRunway(timestamp, treasury.riskFreeValue)
    } else {
      treasury.marketValue = treasury.marketValue.plus(tokenBalance.value)
    }
    treasury.save()
}

function getPrice(token: Address): BigDecimal {
  let result = BigDecimal.zero()
  for (let i = 0; i < priceMaps.length; i++) {
    if (token.equals(ByteArray.fromHexString(priceMaps[i].tokenAddress))) {
      if (priceMaps[i].isStable) {
        result = BigDecimal.fromString("1")
        break
      } else if (priceMaps[i].isExod) {
        result = getExodPrice()
        break
      } else if (priceMaps[i].iswsExod) {
        result = getExodPrice().times(getIndex())
        break
      } else if (priceMaps[i].isOracle) {
        result = getOraclePrice(priceMaps[i].contractAddress, priceMaps[i].priceDecimals)
        break
      } else if (priceMaps[i].isWeightedPool2) {
        result = getWeightedPool2Price(priceMaps[i].contractAddress, priceMaps[i].priceDecimals)
        break
      }
      result = getUniLpPrice(priceMaps[i].contractAddress, priceMaps[i].tokenAddress)
      break
    }
  } 
  return result
}

function getOraclePrice(address: string, decimals: number): BigDecimal {
  const oracle = PriceOracle.bind(Address.fromString(address))
  const price = toDecimal(oracle.latestAnswer(), decimals)
  return price
}

function getUniLpPrice(contractAddress: string, tokenAddress: string): BigDecimal {
  const decimals = ERC20.bind(Address.fromString(contractAddress)).decimals()
  const pair = UniswapV2Pair.bind(Address.fromString(contractAddress))
  let stable: BigDecimal
  let asset: BigDecimal
  const reserves = pair.getReserves()
  if (pair.token0().equals(ByteArray.fromHexString(tokenAddress))){
    asset = toDecimal(reserves.value0, decimals)
    stable = toDecimal(reserves.value1, 18)
  } else {
    stable = toDecimal(reserves.value0, 18)
    asset = toDecimal(reserves.value1, decimals)
  }
  
  const price = stable.div(asset)
  return price
}

function getWeightedPool2Price(contractAddress: string, decimals: number): BigDecimal {
  const poolContract = WeightedPool2.bind(Address.fromString(contractAddress))
  const price = toDecimal(poolContract.getLatest(0), decimals)
  return price
}