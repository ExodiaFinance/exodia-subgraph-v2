import { Address, BigDecimal } from "@graphprotocol/graph-ts";
import { Bond, BondCreated } from "../../generated/DAIBond/Bond";
import { BondDeposit } from "../../generated/schema";
import { dayFromTimestamp, getDecimals, toDecimal } from "../utils/helpers";
import { loadOrCreateToken } from "./Token";
import { getPrice } from "./TokenBalance";

export class BondInfo {
  tokenIn: Address
  tokenOut: Address
  amountIn: BigDecimal
  amountOut: BigDecimal
  valueIn: BigDecimal
  valueOut: BigDecimal
  bondId: string
}

export function createBondDeposit(bond: BondCreated): BondInfo {
  const bondContract = Bond.bind(bond.address)
  const tokenIn = bondContract.principle()
  const tokenOut = bondContract.OHM()
  const dayTimestamp = dayFromTimestamp(bond.block.timestamp)
  const bondId = `${tokenIn.toHexString()}-${tokenOut.toHexString()}-${dayTimestamp}`
  const amountIn = toDecimal(bond.params.deposit, getDecimals(tokenIn))
  let amountOut: BigDecimal = BigDecimal.zero()
  const terms = bondContract.try_terms()
  if (!terms.reverted) {
    if (!terms.value.value5) {
      amountOut = toDecimal(bond.params.payout, getDecimals(tokenOut))
    } else {
      const payoutBeforeFee = toDecimal(bond.params.payout, getDecimals(tokenOut))
      const fee = payoutBeforeFee
        .times(terms.value.value4.toBigDecimal())
        .div(BigDecimal.fromString("10000"))
      amountOut = payoutBeforeFee.plus(fee)
    }
  } else {
    amountOut = toDecimal(bond.params.payout, getDecimals(tokenOut))
  }
  const valueIn = amountIn.times(getPrice(tokenIn))
  const valueOut = amountOut.times(getPrice(tokenOut))

  const bondDeposit = loadOrCreateBondDeposit(bond.transaction.hash.toHexString())
  loadOrCreateToken(tokenIn.toHexString())
  loadOrCreateToken(tokenOut.toHexString())
  bondDeposit.tokenIn = tokenIn.toHexString()
  bondDeposit.tokenOut = tokenOut.toHexString()
  bondDeposit.amountIn = amountIn
  bondDeposit.amountOut = amountOut
  bondDeposit.valueIn = valueIn
  bondDeposit.valueOut = valueOut
  bondDeposit.bond = bondId
  bondDeposit.timestamp = bond.block.timestamp
  bondDeposit.save()

  return {
    tokenIn,
    tokenOut,
    amountIn,
    amountOut,
    valueIn,
    valueOut,
    bondId,
  }
}

export function loadOrCreateBondDeposit(txHash: string): BondDeposit {
  let bondDeposit = BondDeposit.load(txHash)
  if (!bondDeposit) {
    bondDeposit = new BondDeposit(txHash)
    bondDeposit.tokenIn = ""
    bondDeposit.tokenOut = ""
    bondDeposit.amountIn = BigDecimal.zero()
    bondDeposit.amountOut = BigDecimal.zero()
    bondDeposit.valueIn = BigDecimal.zero()
    bondDeposit.valueOut = BigDecimal.zero()
    bondDeposit.bond = ""
  }
  return bondDeposit
}