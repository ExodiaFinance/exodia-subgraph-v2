import { Address, BigInt, BigDecimal } from "@graphprotocol/graph-ts"
import { ERC20 } from "../../generated/TreasuryTracker/ERC20"
import { UniswapV2Pair } from "../../generated/TreasuryTracker/UniswapV2Pair"
import { SLP_EXODDAI_PAIR } from "./constants"

export function getDecimals(token: Address): number {
  const erc20Contract = ERC20.bind(token)
  const decimals = erc20Contract.decimals()
  return decimals
}

export function toDecimal(value: BigInt, decimals: number): BigDecimal {
  const precision = BigInt.fromI32(10)
    .pow(<u8>decimals)
    .toBigDecimal();
  return value.divDecimal(precision);
}

export function dayFromTimestamp(timestamp: BigInt): string {
  const dayTs = timestamp.toI32() - (timestamp.toI32() % 86400)
  return dayTs.toString()
}

export function hourFromTimestamp(timestamp: BigInt): BigInt {
  const hourTs = timestamp.minus(timestamp.mod(BigInt.fromU32(3600)))
  return hourTs
}

export function minuteFromTimestamp(timestamp: BigInt): BigInt {
  const minuteTs = timestamp.minus(timestamp.mod(BigInt.fromU32(60)))
  return minuteTs
}

export function getExodPrice(): BigDecimal {
  const pair = UniswapV2Pair.bind(Address.fromString(SLP_EXODDAI_PAIR))

  const reserves = pair.getReserves()
  const reserve0 = toDecimal(reserves.value0, 9)
  const reserve1 = toDecimal(reserves.value1, 18)

  if (reserve0.gt(BigDecimal.zero())) {
    const exodPrice = reserve1.div(reserve0)
    return exodPrice
  } else {
    return BigDecimal.zero()
  }
}

export function getVestingTokenBalance(vestingToken: Address, address: Address, tokenBalance: BigDecimal): BigDecimal {
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