import { BigInt } from "@graphprotocol/graph-ts";
import { Aux } from "../../generated/schema";

export function loadOrCreateAux(): Aux {
  let aux = Aux.load("0")
  if (!aux) {
    aux = new Aux("0")
    aux.totalHolders = BigInt.zero()
    aux.hourlyTimestamp = BigInt.zero()
  }
  return aux
}