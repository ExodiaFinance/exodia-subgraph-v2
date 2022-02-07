import { ethereum, BigInt, Address, BigDecimal, ByteArray, log } from '@graphprotocol/graph-ts'
import { Liquidity, ProtocolMetric, Token, TokenBalance, Treasury, _Aux } from '../generated/schema'
import { CirculatingSupply } from '../generated/TreasuryTracker/CirculatingSupply'
import { BALANCERVAULT_CONTRACT, CIRCULATING_SUPPLY_CONTRACT, EXOD_ERC20_CONTRACT, EXOD_STAKING_CONTRACT, SEXOD_ERC20_CONTRACT, SLP_EXODDAI_PAIR, TREASURY_TRACKER_CONTRACT } from './utils/constants'
import { EXODERC20 } from '../generated/TreasuryTracker/EXODERC20'
import { UniswapV2Pair } from '../generated/TreasuryTracker/UniswapV2Pair'
import { SEXODERC20 } from '../generated/TreasuryTracker/SEXODERC20'
import { ExodStaking } from '../generated/TreasuryTracker/ExodStaking'
import { TreasuryTracker } from '../generated/TreasuryTracker/TreasuryTracker'
import { WeightedPool } from '../generated/TreasuryTracker/WeightedPool'
import { BalancerVault } from '../generated/TreasuryTracker/BalancerVault'
import { ERC20 } from '../generated/TreasuryTracker/ERC20'
import { priceMaps } from './utils/priceMap'
import { PriceOracle } from '../generated/TreasuryTracker/PriceOracle'
import { WeightedPool2 } from '../generated/TreasuryTracker/WeightedPool2'

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

function updateUniLiquidities(tokens: Address[], dayTimestamp: string): BigDecimal[] {
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

function updateBptLiquidities(tokens: Address[], dayTimestamp: string): BigDecimal[] {
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
  liquidity.timestamp = BigInt.fromString(dayTimestamp)

  const balancerVaultContract = BalancerVault.bind(Address.fromString(BALANCERVAULT_CONTRACT))
  const poolId = tokenContract.try_getPoolId()
  if (poolId.reverted) {
    const vestingToken = tokenContract.try_vestingToken()
    if (vestingToken.reverted) {
      return [updateTokenBalance(address, dayTimestamp, false, BigDecimal.zero(), id).value]
    } else {
      const vestingTokenBalance = getVestingTokenBalance(vestingToken.value, address, liquidity.balance)
      updateTokenBalance(address, dayTimestamp)
      return updateBptLiquidity(vestingToken.value, dayTimestamp, vestingTokenBalance)
    }
  }
  
  liquidity.save()
  
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

function getVestingTokenBalance(vestingToken: Address, address: Address, tokenBalance: BigDecimal): BigDecimal {
  const vestingTokenERC20 = ERC20.bind(vestingToken)
  const vestingTokenDecimals = vestingTokenERC20.decimals()
  const totalVestingTokens = toDecimal(vestingTokenERC20.totalSupply(), vestingTokenDecimals)
  
  const tokenERC20 = ERC20.bind(address)
  const tokenDecimals = tokenERC20.decimals()
  const totalTokens = toDecimal(tokenERC20.totalSupply(), tokenDecimals)

  const exchangeRate = totalVestingTokens.div(totalTokens)

  const vestingTokenBalance = tokenBalance.times(exchangeRate)
  return vestingTokenBalance
}

class TokenBalances {
  balances: BigDecimal[];
  values: BigDecimal[];
}

function updateTokenBalances(
  tokens: Address[],
  timestamp: string,
  riskFree: boolean = false,
  balances: BigDecimal[] = [],
  liquidityId: string = '',
): TokenBalances {
  const tokenBalances: TokenBalances = {
    balances: [],
    values: [],
  }

  for (let i = 0; i < tokens.length; i++) {
    if (balances.length) {
      const tokenBalance = updateTokenBalance(
        tokens[i],
        timestamp,
        riskFree,
        balances[i],
        liquidityId,
      )
      tokenBalances.balances.push(tokenBalance.balance)
      tokenBalances.values.push(tokenBalance.value)
    } else {
      const tokenBalance = updateTokenBalance(tokens[i], timestamp, riskFree, BigDecimal.zero(), liquidityId)
      tokenBalances.balances.push(tokenBalance.balance)
      tokenBalances.values.push(tokenBalance.value)
    }
  }
  return tokenBalances
}

function updateTokenBalance(
  address: Address,
  timestamp: string,
  riskFree: boolean = false,
  balance: BigDecimal = BigDecimal.zero(),
  liquidityId: string = '',
): TokenBalance {
  const addressString = address.toHexString()
    const token = loadOrCreateToken(addressString)
    const id = liquidityId ? `${addressString}-${timestamp}-${liquidityId}` : `${addressString}-${timestamp}`

    let tokenBalance = TokenBalance.load(id)
    if (!tokenBalance) {
      tokenBalance = new TokenBalance(id)
    }

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

    let treasury = Treasury.load(timestamp)
    if (!treasury) {
      treasury = new Treasury(timestamp)
      treasury.marketValue = BigDecimal.zero()
      treasury.riskFreeValue = BigDecimal.zero()
    }

    if (riskFree) {
      treasury.riskFreeValue = treasury.riskFreeValue.plus(tokenBalance.value)
      treasury.marketValue = treasury.marketValue.plus(tokenBalance.value)
      updateRunway(timestamp, treasury.riskFreeValue)
    } else {
      treasury.marketValue = treasury.marketValue.plus(tokenBalance.value)
    }
    treasury.save()

    return tokenBalance
}

function updateRunway(timestamp: string, rfv: BigDecimal): void {
  let protocolMetric = ProtocolMetric.load(timestamp)
  if (!protocolMetric) {
    protocolMetric = new ProtocolMetric(timestamp)
  }
  protocolMetric.runway = getRunway(timestamp, rfv)
  protocolMetric.save()
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

function getWeightedPool2Price(contractAddress: string, decimals: number): BigDecimal {
  const poolContract = WeightedPool2.bind(Address.fromString(contractAddress))
  const price = toDecimal(poolContract.getLatest(0), decimals)
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

function getOraclePrice(address: string, decimals: number): BigDecimal {
  const oracle = PriceOracle.bind(Address.fromString(address))
  const price = toDecimal(oracle.latestAnswer(), decimals)
  return price
}

function getIndex(): BigDecimal {
  const stakingContract = ExodStaking.bind(Address.fromString(EXOD_STAKING_CONTRACT))
  const index = toDecimal(stakingContract.index(), 9)
  return index
}

function updateProtocolMetric(dayTimestamp: string): void {
  let protocolMetric = ProtocolMetric.load(dayTimestamp)
  if (!protocolMetric) {
   protocolMetric = new ProtocolMetric(dayTimestamp)
  }

  const exodPrice = getExodPrice()

  protocolMetric.circulatingSupply = getCirculatingSupply()
  protocolMetric.totalSupply = getTotalSupply()
  protocolMetric.price = exodPrice
  protocolMetric.marketCap = protocolMetric.totalSupply.times(protocolMetric.price)
  protocolMetric.tvl = getTVL(exodPrice)
  protocolMetric.holders = BigInt.fromU32(0)
  protocolMetric.save()
}

function getCirculatingSupply(): BigDecimal {
  const circulatingSupplyContract = CirculatingSupply.bind(Address.fromString(CIRCULATING_SUPPLY_CONTRACT))
  const circulatingSupply = circulatingSupplyContract.OHMCirculatingSupply()
  return toDecimal(circulatingSupply, 9)
}

function getTotalSupply(): BigDecimal {
  const exodContract = EXODERC20.bind(Address.fromString(EXOD_ERC20_CONTRACT))
  const totalSupply = exodContract.totalSupply()
  return toDecimal(totalSupply, 9)
}

function getExodPrice(): BigDecimal {
  const pair = UniswapV2Pair.bind(Address.fromString(SLP_EXODDAI_PAIR))

  const reserves = pair.getReserves()
  const reserve0 = reserves.value0.toBigDecimal()
  const reserve1 = reserves.value1.toBigDecimal()

  const exodPrice = reserve1.div(reserve0).div(BigDecimal.fromString('1e9'))

  return exodPrice
}

function getTVL(exodPrice: BigDecimal): BigDecimal {
  const sExodContract = SEXODERC20.bind(Address.fromString(SEXOD_ERC20_CONTRACT))
  const sExodSupply = toDecimal(sExodContract.circulatingSupply(), 9)
  return sExodSupply.times(exodPrice)
}

function getRunway(dayTimestamp: string, rfv: BigDecimal): BigDecimal {
  const stakingContract = ExodStaking.bind(Address.fromString(EXOD_STAKING_CONTRACT))
  const sExodContract = SEXODERC20.bind(Address.fromString(SEXOD_ERC20_CONTRACT))
  const sExodSupply = toDecimal(sExodContract.circulatingSupply(), 9)
  const rebaseRate = toDecimal(stakingContract.epoch().value3, 9)
    .div(sExodSupply)
  const rebases = Math.log( parseFloat(rfv.div(sExodSupply).toString()) ) / Math.log( 1 + parseFloat(rebaseRate.toString()) )
  const runway = rebases * 28800 * 0.9 / 86400
  log.debug("rebases: {}, runway: {}", [rebases.toString(), runway.toString()])
  return BigDecimal.fromString(runway.toString())
}

function dayFromTimestamp(timestamp: BigInt): string {
  const dayTs = timestamp.toI32() - (timestamp.toI32() % 86400)
  return dayTs.toString()
}

function toDecimal(value: BigInt, decimals: number): BigDecimal {
  const precision = BigInt.fromI32(10)
    .pow(<u8>decimals)
    .toBigDecimal();
  return value.divDecimal(precision);
}

function loadOrCreateToken(address: string): Token {
  let token = Token.load(address)
  if (!token) {
    const tokenContract = ERC20.bind(Address.fromString(address))
    token = new Token(address)
    token.ticker = tokenContract.symbol()
    token.fullName = tokenContract.name()
    token.save()
  }
  return token
}

function getDecimals(token: Address): number {
  const erc20Contract = ERC20.bind(token)
  const decimals = erc20Contract.decimals()
  return decimals
}