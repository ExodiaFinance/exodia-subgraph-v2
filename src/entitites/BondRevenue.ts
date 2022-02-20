import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { BondCreated } from "../../generated/DAIBond/Bond";
import { BondRevenue } from "../../generated/schema";
import { BondInfo } from "./BondDeposit";
import { Bond } from "../../generated/DAIBond/Bond";

export function updateBondRevenue(bondCreated: BondCreated, bondInfo: BondInfo): void {
  const bond = loadOrCreateBondRevenue(
    bondInfo.bondId,
    bondInfo.tokenIn,
    bondInfo.tokenOut
  );
  bond.amountIn = bond.amountIn.plus(bondInfo.amountIn);
  bond.amountOut = bond.amountOut.plus(bondInfo.amountOut);
  bond.valueIn = bond.valueIn.plus(bondInfo.valueIn);
  bond.valueOut = bond.valueOut.plus(bondInfo.valueOut);
  const bondContract = Bond.bind(bondCreated.address);
  const debtRatio = bondContract.standardizedDebtRatio();
  bond.debtRatio = debtRatio;
  bond.timestamp = bondCreated.block.timestamp
  bond.dailyBondRevenue = bondInfo.dayTimestamp;
  bond.save();
}

export function loadOrCreateBondRevenue(
  bondId: string,
  tokenIn: Address,
  tokenOut: Address
): BondRevenue {
  let bond = BondRevenue.load(bondId);
  if (!bond) {
    bond = new BondRevenue(bondId);
    bond.tokenIn = tokenIn.toHexString();
    bond.tokenOut = tokenOut.toHexString();
    bond.amountIn = BigDecimal.zero();
    bond.amountOut = BigDecimal.zero();
    bond.valueIn = BigDecimal.zero();
    bond.valueOut = BigDecimal.zero();
    bond.debtRatio = BigInt.zero();
    bond.timestamp = BigInt.zero();
    bond.dailyBondRevenue = "";
  }
  return bond;
}
