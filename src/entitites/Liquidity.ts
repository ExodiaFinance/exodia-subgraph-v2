import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts"
import { Liquidity } from "../../generated/schema"
import { BalancerVault } from "../../generated/TreasuryTracker/BalancerVault"
import { ERC20 } from "../../generated/TreasuryTracker/ERC20"
import { TreasuryTracker } from "../../generated/TreasuryTracker/TreasuryTracker"
import { UniswapV2Pair } from "../../generated/TreasuryTracker/UniswapV2Pair"
import { WeightedPool } from "../../generated/TreasuryTracker/WeightedPool"
import { TREASURY_TRACKER_CONTRACT, BALANCERVAULT_CONTRACT } from "../utils/constants"
import { getDecimals, getVestingTokenBalance, toDecimal } from "../utils/helpers"
import { loadOrCreateToken } from "./Token"
import { updateTokenBalance, updateTokenBalances } from "./TokenBalance"


export function updateBptLiquidities(tokens: Address[], dayTimestamp: string): BigDecimal[] {
  let liquidityValues: BigDecimal[] = []

  for (let i = 0; i < tokens.length; i ++) {
    const liquidityValue = updateBptLiquidity(tokens[i], dayTimestamp)
    liquidityValues = liquidityValues.concat(liquidityValue)
  }
  
  return liquidityValues
}


function updateBptLiquidity(address: Address, dayTimestamp: string, balance: BigDecimal = BigDecimal.zero()): BigDecimal[] {
  const addressString = address.toHexString()
  const token = loadOrCreateToken(addressString)

  const treasuryTrackerContract = TreasuryTracker.bind(Address.fromString(TREASURY_TRACKER_CONTRACT))
  const tokenContract = WeightedPool.bind(address)

  const id = `${addressString}-${dayTimestamp}`
  let liquidity = Liquidity.load(id)
  if (!liquidity) {
    liquidity = new Liquidity(id)
  }
  
  const decimals = tokenContract.decimals()
  const totalSupply = toDecimal(tokenContract.totalSupply(), decimals)
  liquidity.token = token.id
  if (balance.gt(BigDecimal.zero())) {
    liquidity.balance = balance
  } else {
    liquidity.balance = toDecimal(treasuryTrackerContract.balance(address), decimals)
  }
  liquidity.pol = liquidity.balance.div(totalSupply).times(BigDecimal.fromString("100"))
  liquidity.treasury = dayTimestamp
  liquidity.timestamp = BigInt.fromString(dayTimestamp)
  
  liquidity.save()

  const balancerVaultContract = BalancerVault.bind(Address.fromString(BALANCERVAULT_CONTRACT))
  const poolId = tokenContract.try_getPoolId()
  if (poolId.reverted) {
    const vestingToken = tokenContract.try_vestingToken()
    if (vestingToken.reverted) {
      return [updateTokenBalance(address, dayTimestamp, false, BigDecimal.zero(), id).value]
    } else {
      const vestingTokenBalance = getVestingTokenBalance(vestingToken.value, address, liquidity.balance)
      return updateBptLiquidity(vestingToken.value, dayTimestamp, vestingTokenBalance)
    }
  }

  const poolTokens = balancerVaultContract.getPoolTokens(poolId.value)
  const poolTokensAddresses = poolTokens.value0
  const poolTokensBalances = poolTokens.value1
  let ownedPoolTokensBalances: BigDecimal[] = []

  for (let i = 0; i < poolTokensBalances.length; i ++) {
    const decimals = ERC20.bind(poolTokensAddresses[i]).decimals()
    ownedPoolTokensBalances.push(toDecimal(poolTokensBalances[i], decimals).times(liquidity.pol).div(BigDecimal.fromString("100")))
  }

  return updateTokenBalances(poolTokensAddresses, dayTimestamp, false, ownedPoolTokensBalances, id).values
}

export function updateUniLiquidities(tokens: Address[], dayTimestamp: string): BigDecimal[] {
  let liquidityValues: BigDecimal[] = []

  for (let i = 0; i < tokens.length; i ++) {
    const liquidityValue = updateUniLiquidity(tokens[i], dayTimestamp)
    liquidityValues = liquidityValues.concat(liquidityValue)
  }
  
  return liquidityValues
}

function updateUniLiquidity(address: Address, dayTimestamp: string): BigDecimal[] {
  const addressString = address.toHexString()
  const token = loadOrCreateToken(addressString)

  const treasuryTrackerContract = TreasuryTracker.bind(Address.fromString(TREASURY_TRACKER_CONTRACT))
  const tokenContract = UniswapV2Pair.bind(address)

  const id = `${addressString}-${dayTimestamp}`
  let liquidity = Liquidity.load(id)
  if (!liquidity) {
    liquidity = new Liquidity(id)
  }

  const decimals = tokenContract.decimals()
  const totalSupply = toDecimal(tokenContract.totalSupply(), decimals)
  liquidity.token = token.id
  liquidity.balance = toDecimal(treasuryTrackerContract.balance(address), decimals)
  liquidity.pol = liquidity.balance.div(totalSupply).times(BigDecimal.fromString("100"))
  liquidity.timestamp = BigInt.fromString(dayTimestamp)
  liquidity.treasury = dayTimestamp
  liquidity.save()

  const reserves = tokenContract.getReserves()
  const token0 = tokenContract.token0()
  const token1 = tokenContract.token1()
  const token0Decimals = getDecimals(token0)
  const token1Decimals = getDecimals(token1)

  const tokenBalance0 = updateTokenBalance(token0, dayTimestamp, false, toDecimal(reserves.value0, token0Decimals).times(liquidity.pol).div(BigDecimal.fromString("100")), id)
  const tokenBalance1 = updateTokenBalance(token1, dayTimestamp, false, toDecimal(reserves.value1, token1Decimals).times(liquidity.pol).div(BigDecimal.fromString("100")), id)

  return [tokenBalance0.value, tokenBalance1.value]
}