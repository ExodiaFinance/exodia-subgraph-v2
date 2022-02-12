import { BigDecimal, Address, ByteArray, BigInt } from "@graphprotocol/graph-ts"
import { TokenBalance, Treasury } from "../../generated/schema"
import { BalancerVault } from "../../generated/TreasuryTracker/BalancerVault"
import { ERC20 } from "../../generated/TreasuryTracker/ERC20"
import { PriceOracle } from "../../generated/TreasuryTracker/PriceOracle"
import { TreasuryTracker } from "../../generated/TreasuryTracker/TreasuryTracker"
import { UniswapV2Pair } from "../../generated/TreasuryTracker/UniswapV2Pair"
import { WeightedPool } from "../../generated/TreasuryTracker/WeightedPool"
import { WeightedPool2 } from "../../generated/TreasuryTracker/WeightedPool2"
import { BALANCERVAULT_CONTRACT, TREASURY_TRACKER_CONTRACT } from "../utils/constants"
import { getDecimals, getExodPrice, toDecimal } from "../utils/helpers"
import { priceMaps } from "../utils/priceMap"
import { getIndex, updateRunway } from "./ProtocolMetric"
import { loadOrCreateToken } from "./Token"
import { loadOrCreateTreasury } from "./Treasury"

export class TokenValue {
  riskFreeValue: BigDecimal
  riskyValue: BigDecimal
}

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
): TokenValue {
  const tokenValues: TokenValue = {
    riskFreeValue: BigDecimal.zero(),
    riskyValue: BigDecimal.zero()
  }

  if (balances.length) {
    for (let i = 0; i < tokens.length; i++) {
      const _tokenValues = updateTokenBalance(tokens[i], timestamp, riskFree, balances[i], liquidityId, false)
      tokenValues.riskFreeValue = tokenValues.riskFreeValue.plus(_tokenValues.riskFreeValue)
      tokenValues.riskyValue = tokenValues.riskyValue.plus(_tokenValues.riskyValue)
    }
  } else {
    for (let i = 0; i < tokens.length; i++) {
      const _tokenValues = updateTokenBalance(tokens[i], timestamp, riskFree, BigDecimal.zero(), liquidityId)
      tokenValues.riskFreeValue = tokenValues.riskFreeValue.plus(_tokenValues.riskFreeValue)
      tokenValues.riskyValue = tokenValues.riskyValue.plus(_tokenValues.riskyValue)
    }
  }
  
  return tokenValues
}

export function updateTokenBalance(
  address: Address,
  timestamp: string,
  riskFree: boolean = false,
  balance: BigDecimal = BigDecimal.zero(),
  liquidityId: string = '',
  fetchBalance: boolean = true
): TokenValue {
  const addressString = address.toHexString()
  const token = loadOrCreateToken(addressString)
  const id = !!liquidityId ? `${addressString}-${timestamp}-${liquidityId}` : `${addressString}-${timestamp}`

  const tokenBalance = loadOrCreateTokenBalance(id)

  if (!fetchBalance) {
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

  if (riskFree) {
    return {
      riskFreeValue: tokenBalance.value,
      riskyValue: BigDecimal.zero()
    }
  } else {
    return {
      riskFreeValue: BigDecimal.zero(),
      riskyValue: tokenBalance.value
    }
  }
}

export function getPrice(token: Address): BigDecimal {
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
      } else if (priceMaps[i].isUniLp) {
        result = getUniLpPrice(priceMaps[i].contractAddress, priceMaps[i].tokenAddress)
        break
      } else if (priceMaps[i].isUniLpToken) {
        result = getUniLpTokenPrice(priceMaps[i].tokenAddress)
      } else if (priceMaps[i].isBptToken) {
        result = getBptTokenPrice(priceMaps[i].tokenAddress)
      }
    }
  } 
  return result
}

function getUniLpTokenPrice(address: string): BigDecimal {
  const uniLpContract = UniswapV2Pair.bind(Address.fromString(address))
  const token0 = uniLpContract.token0()
  const token1 = uniLpContract.token1()
  const reserves = uniLpContract.getReserves()
  const reserves0 = toDecimal(reserves.value0, getDecimals(token0))
  const reserves1 = toDecimal(reserves.value1, getDecimals(token1))
  const totalValue = reserves0.times(getPrice(token0)).plus(reserves1.times(getPrice(token1)))
  const totalSupply = toDecimal(uniLpContract.totalSupply(), uniLpContract.decimals())
  const price = totalValue.div(totalSupply)
  return price
}

function getBptTokenPrice(address: string): BigDecimal {
  const bptContract = WeightedPool.bind(Address.fromString(address))
  const poolId = bptContract.getPoolId()
  const vaultContract = BalancerVault.bind(Address.fromString(BALANCERVAULT_CONTRACT))
  const poolTokens = vaultContract.getPoolTokens(poolId)
  let totalValue: BigDecimal = BigDecimal.zero()
  for (let i = 0; i < poolTokens.value1.length; i++) {
    const balance = toDecimal(
      poolTokens.value1[i],
      getDecimals(poolTokens.value0[i])
    )
    const value = balance.times(getPrice(poolTokens.value0[i]))
    totalValue = totalValue.plus(value)
  }
  const totalSupply = toDecimal(bptContract.totalSupply(), bptContract.decimals())
  const price = totalValue.div(totalSupply)
  return price
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