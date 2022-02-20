import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { DailyBondRevenue } from "../../generated/schema";
import { BondInfo } from "./BondDeposit";

export function loadOrCreateDailyBondRevenue(dayTimestamp: string): DailyBondRevenue {
  let dailyBondRevenue = DailyBondRevenue.load(dayTimestamp)
  if (!dailyBondRevenue) {
    dailyBondRevenue = new DailyBondRevenue(dayTimestamp)
    dailyBondRevenue.valueIn = BigDecimal.zero()
    dailyBondRevenue.valueOut = BigDecimal.zero()
    dailyBondRevenue.valueIn = BigDecimal.zero()
    dailyBondRevenue.valueOut = BigDecimal.zero()
    dailyBondRevenue.timestamp = dayTimestamp
  }
  return dailyBondRevenue
}

export function updateDailyBondRevenue(bondInfo: BondInfo): void {
  const dailyBondRevenue = loadOrCreateDailyBondRevenue(bondInfo.dayTimestamp)
  dailyBondRevenue.valueIn = dailyBondRevenue.valueIn.plus(bondInfo.valueIn)
  dailyBondRevenue.valueOut = dailyBondRevenue.valueOut.plus(bondInfo.valueOut)
  dailyBondRevenue.save()
}