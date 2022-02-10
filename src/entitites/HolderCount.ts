import { BigInt } from "@graphprotocol/graph-ts";
import { HolderCount } from "../../generated/schema";

export function loadOrCreateHolderCount(): HolderCount {
  let holders = HolderCount.load("0")
  if (!holders) {
    holders = new HolderCount("0")
    holders.totalHolders = BigInt.zero()
  }
  return holders
}