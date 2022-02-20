import { BigDecimal } from "@graphprotocol/graph-ts";
import { AllTimeBondRevenue } from "../../generated/schema";
import { BondInfo } from "./BondDeposit";
import { loadOrCreateToken } from "./Token";

export function loadOrCreateAllTimeBondRevenue(id: string): AllTimeBondRevenue {
  let allTimeBondRevenue = AllTimeBondRevenue.load(id)
  if (!allTimeBondRevenue) {
    allTimeBondRevenue = new AllTimeBondRevenue(id)
    allTimeBondRevenue.tokenIn = ""
    allTimeBondRevenue.tokenOut = ""
    allTimeBondRevenue.amountIn = BigDecimal.zero()
    allTimeBondRevenue.amountOut = BigDecimal.zero()
    allTimeBondRevenue.valueIn = BigDecimal.zero()
    allTimeBondRevenue.valueOut = BigDecimal.zero()
  }
  return allTimeBondRevenue
}

export function updateAllTimeBondRevenue(bondInfo: BondInfo): void {
  const allTimeBondRevenue = loadOrCreateAllTimeBondRevenue(bondInfo.allTimeBondId)
  allTimeBondRevenue.tokenIn = loadOrCreateToken(bondInfo.tokenIn.toHexString()).id
  allTimeBondRevenue.tokenOut = loadOrCreateToken(bondInfo.tokenOut.toHexString()).id
  allTimeBondRevenue.amountIn = allTimeBondRevenue.amountIn.plus(bondInfo.amountIn)
  allTimeBondRevenue.amountOut = allTimeBondRevenue.amountOut.plus(bondInfo.amountOut)
  allTimeBondRevenue.valueIn = allTimeBondRevenue.valueIn.plus(bondInfo.valueIn)
  allTimeBondRevenue.valueOut = allTimeBondRevenue.valueOut.plus(bondInfo.valueOut)
  allTimeBondRevenue.save()
}