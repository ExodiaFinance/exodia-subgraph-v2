import { BigInt } from "@graphprotocol/graph-ts";
import { Holders } from "../../generated/schema";

export function loadOrCreateHolders(): Holders {
  let holders = Holders.load("0")
  if (!holders) {
    holders = new Holders("0")
    holders.totalHolders = BigInt.zero()
  }
  return holders
}