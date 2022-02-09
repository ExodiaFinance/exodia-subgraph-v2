import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { Exodian } from "../../generated/schema";

export function loadOrCreateExodian(address: string): Exodian {
  let exodian = Exodian.load(address)
  if (!exodian) {
    exodian = new Exodian(address)
    exodian.exodBalance = BigDecimal.zero()
    exodian.sExodBalance = BigDecimal.zero()
    exodian.wsExodBalance = BigDecimal.zero()
    exodian.heldSince = BigInt.zero()
  }
  return exodian
}