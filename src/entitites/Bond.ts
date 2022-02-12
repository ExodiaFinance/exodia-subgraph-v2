import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { BondCreated } from "../../generated/DAIBond/Bond";
import { Bond } from "../../generated/schema";
import { BondInfo } from "./BondDeposit";
import { Bond as BondAbi } from '../../generated/DAIBond/Bond';
import { dayFromTimestamp } from "../utils/helpers";

 export function updateBond(bondCreated: BondCreated, bondInfo: BondInfo): void {
  const bond = loadOrCreateBond(bondInfo.bondId, bondInfo.tokenIn, bondInfo.tokenOut)
  bond.amountIn = bond.amountIn.plus(bondInfo.amountIn)
  bond.amountOut = bond.amountOut.plus(bondInfo.amountOut)
  bond.valueIn = bond.valueIn.plus(bondInfo.valueIn)
  bond.valueOut = bond.valueOut.plus(bondInfo.valueOut)
  const bondContract = BondAbi.bind(bondCreated.address)
  const debtRatio = bondContract.standardizedDebtRatio()
  bond.debtRatio = debtRatio
  bond.timestamp = BigInt.fromString(dayFromTimestamp(bondCreated.block.timestamp))
  bond.save()
 }

 export function loadOrCreateBond(bondId: string, tokenIn: Address, tokenOut: Address): Bond {
   let bond = Bond.load(bondId)
   if (!bond) {
     bond = new Bond(bondId)
     bond.tokenIn = tokenIn.toHexString()
     bond.tokenOut = tokenOut.toHexString()
     bond.amountIn = BigDecimal.zero()
     bond.amountOut = BigDecimal.zero()
     bond.valueIn = BigDecimal.zero()
     bond.valueOut = BigDecimal.zero()
     bond.debtRatio = BigInt.zero()
     bond.timestamp = BigInt.zero()
   }
   return bond
 }