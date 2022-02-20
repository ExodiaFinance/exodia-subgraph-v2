import { Address, BigDecimal } from "@graphprotocol/graph-ts";
import { Bond, BondCreated } from "../../generated/DAIBond/Bond";
import { BondDeposit } from "../../generated/schema";
import { dayFromTimestamp, getDecimals, toDecimal } from "../utils/helpers";
import { loadOrCreateExodian } from "./Exodian";
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
  allTimeBondId: string
  dayTimestamp: string
}

export function createBondDeposit(bond: BondCreated): BondInfo {
  const bondContract = Bond.bind(bond.address)
  const tokenIn = bondContract.principle()
  const tokenOut = bondContract.OHM()
  const dayTimestamp = dayFromTimestamp(bond.block.timestamp)
  const bondId = `${tokenIn.toHexString()}-${tokenOut.toHexString()}-${dayTimestamp}`
  const allTimeBondId = `${tokenIn.toHexString()}-${tokenOut.toHexString()}`
  const amountIn = toDecimal(bond.params.deposit, getDecimals(tokenIn))
  const amountOut = toDecimal(bond.params.payout, getDecimals(tokenOut))
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
  bondDeposit.bondRevenue = bondId
  bondDeposit.allTimeBondRevenue = allTimeBondId
  const bonder = loadOrCreateExodian(bond.transaction.from.toHexString())
  bonder.save()
  bondDeposit.bonder = bonder.id
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
    allTimeBondId,
    dayTimestamp
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
    bondDeposit.bondRevenue = ""
    bondDeposit.allTimeBondRevenue = ""
    bondDeposit.bonder = ""
  }
  return bondDeposit
}