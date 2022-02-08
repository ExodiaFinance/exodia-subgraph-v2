import { Address } from "@graphprotocol/graph-ts"
import { Token } from "../../generated/schema"
import { ERC20 } from "../../generated/TreasuryTracker/ERC20"

export function loadOrCreateToken(address: string): Token {
  let token = Token.load(address)
  if (!token) {
    const tokenContract = ERC20.bind(Address.fromString(address))
    token = new Token(address)
    token.ticker = tokenContract.symbol()
    token.fullName = tokenContract.name()
    token.save()
  }
  return token
}