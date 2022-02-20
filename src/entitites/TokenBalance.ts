import { BigDecimal, Address, ByteArray, BigInt, Bytes } from "@graphprotocol/graph-ts"
import { TokenBalance } from "../../generated/schema"
import { BalancerVault } from "../../generated/TreasuryTracker/BalancerVault"
import { ERC20 } from "../../generated/TreasuryTracker/ERC20"
import { PriceOracle } from "../../generated/ExodiaERC20Token/PriceOracle"
import { TreasuryTracker } from "../../generated/TreasuryTracker/TreasuryTracker"
import { UniswapV2Pair } from "../../generated/TreasuryTracker/UniswapV2Pair"
import { WeightedPool } from "../../generated/TreasuryTracker/WeightedPool"
import { WeightedPool2 } from "../../generated/ExodiaERC20Token/WeightedPool2"
import { BALANCERVAULT_CONTRACT, EXOD_ERC20_CONTRACT, TREASURY_TRACKER_CONTRACT, WSEXOD_ERC20_CONTRACT } from "../utils/constants"
import { getDecimals, getExodPrice, toDecimal } from "../utils/helpers"
import { priceMaps } from "../utils/priceMap"
import { getIndex } from "./ProtocolMetric"
import { loadOrCreateToken } from "./Token"

export class TokenValue {
  riskFreeValue: BigDecimal
  riskyValue: BigDecimal
  backingValue: BigDecimal
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
    riskyValue: BigDecimal.zero(),
    backingValue: BigDecimal.zero()
  }

  if (balances.length) {
    for (let i = 0; i < tokens.length; i++) {
      const _tokenValues = updateTokenBalance(tokens[i], timestamp, riskFree, balances[i], liquidityId, false)
      tokenValues.riskFreeValue = tokenValues.riskFreeValue.plus(_tokenValues.riskFreeValue)
      tokenValues.riskyValue = tokenValues.riskyValue.plus(_tokenValues.riskyValue)
      tokenValues.backingValue = tokenValues.backingValue.plus(_tokenValues.backingValue)
    }
  } else {
    for (let i = 0; i < tokens.length; i++) {
      const _tokenValues = updateTokenBalance(tokens[i], timestamp, riskFree, BigDecimal.zero(), liquidityId, true)
      tokenValues.riskFreeValue = tokenValues.riskFreeValue.plus(_tokenValues.riskFreeValue)
      tokenValues.riskyValue = tokenValues.riskyValue.plus(_tokenValues.riskyValue)
      tokenValues.backingValue = tokenValues.backingValue.plus(_tokenValues.backingValue)
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
  fetchBalance: boolean = true,
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

  let backingValue = BigDecimal.zero()
  if (!isExodOrwsExod(address)) {
    backingValue = tokenBalance.value
  }

  if (riskFree) {
    return {
      riskFreeValue: tokenBalance.value,
      riskyValue: BigDecimal.zero(),
      backingValue
    }
  } else {
    return {
      riskFreeValue: BigDecimal.zero(),
      riskyValue: tokenBalance.value,
      backingValue
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
        result = getOraclePrice(priceMaps[i].contractAddress)
        break
      } else if (priceMaps[i].isWeightedPool2) {
        result = getWeightedPool2Price(priceMaps[i].contractAddress)
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

function getOraclePrice(address: string): BigDecimal {
  const oracle = PriceOracle.bind(Address.fromString(address))
  const decimals = oracle.try_decimals()
  if (decimals.reverted) {
    //get gOHM price before oracle deployed from monolith pool
    if (address === "0x5E1DEE184a4809EBfcEDa72E4287f4d2d62dC6C1") {
      return getPriceBeforegOhmOracle()
    } else {
      return BigDecimal.zero()
    }
  }
  const price = toDecimal(oracle.latestAnswer(), decimals.value)
  return price
}

function getPriceBeforegOhmOracle(): BigDecimal {
  const balancerVault = BalancerVault.bind(Address.fromString(BALANCERVAULT_CONTRACT))
  const gOHMBalance = toDecimal(
    balancerVault.getPoolTokenInfo(
      Bytes.fromByteArray(Bytes.fromHexString("0xa216aa5d67ef95dde66246829c5103c7843d1aab000100000000000000000112")),
      Address.fromString("0x91fa20244fb509e8289ca630e5db3e9166233fdc")
    ).value0,
    18
  )
  const maiBalance = toDecimal(
    balancerVault.getPoolTokenInfo(
      Bytes.fromByteArray(Bytes.fromHexString("0xa216aa5d67ef95dde66246829c5103c7843d1aab000100000000000000000112")),
      Address.fromString("0xfB98B335551a418cD0737375a2ea0ded62Ea213b")
    ).value0,
    18
  )
  return maiBalance.div(gOHMBalance)
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

function getWeightedPool2Price(contractAddress: string): BigDecimal {
  const poolContract = WeightedPool2.bind(Address.fromString(contractAddress))
  const decimals = poolContract.decimals()
  const price = toDecimal(poolContract.getLatest(0), decimals)
  return price
}

function isExodOrwsExod(address: Address): boolean {
  return (
    address.equals(ByteArray.fromHexString(EXOD_ERC20_CONTRACT)) ||
    address.equals(ByteArray.fromHexString(WSEXOD_ERC20_CONTRACT))
  )
}