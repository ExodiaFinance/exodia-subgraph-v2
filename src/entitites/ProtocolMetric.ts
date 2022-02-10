import { BigDecimal, Address, log, BigInt } from "@graphprotocol/graph-ts"
import { Exodian, ProtocolMetric } from "../../generated/schema"
import { CirculatingSupply } from "../../generated/TreasuryTracker/CirculatingSupply"
import { EXODERC20 } from "../../generated/TreasuryTracker/EXODERC20"
import { ExodStaking } from "../../generated/TreasuryTracker/ExodStaking"
import { SEXODERC20 } from "../../generated/TreasuryTracker/SEXODERC20"
import { CIRCULATING_SUPPLY_CONTRACT, EXOD_ERC20_CONTRACT, EXOD_STAKING_CONTRACT, SEXOD_ERC20_CONTRACT } from "../utils/constants"
import { getExodPrice, toDecimal } from "../utils/helpers"
import { loadOrCreateHolderCount } from "./HolderCount"

export function updateProtocolMetric(dayTimestamp: string): void {
  const protocolMetric = loadOrCreateProtocolMetric(dayTimestamp)
  const exodPrice = getExodPrice()

  protocolMetric.circulatingSupply = getCirculatingSupply()
  protocolMetric.totalSupply = getTotalSupply()
  protocolMetric.price = exodPrice
  protocolMetric.marketCap = protocolMetric.totalSupply.times(protocolMetric.price)
  protocolMetric.tvl = getTVL(exodPrice)
  protocolMetric.save()
}

export function loadOrCreateProtocolMetric(timestamp: string): ProtocolMetric {
  let protocolMetric = ProtocolMetric.load(timestamp)
  if (!protocolMetric) {
   protocolMetric = new ProtocolMetric(timestamp)

   protocolMetric.circulatingSupply = BigDecimal.zero()
   protocolMetric.totalSupply = BigDecimal.zero()
   protocolMetric.price = BigDecimal.zero()
   protocolMetric.marketCap = BigDecimal.zero()
   protocolMetric.tvl = BigDecimal.zero()
   protocolMetric.holders = loadOrCreateHolderCount().totalHolders
   protocolMetric.runway = BigDecimal.zero()
  }
  return protocolMetric
}

function getRunway(rfv: BigDecimal): BigDecimal {
  const stakingContract = ExodStaking.bind(Address.fromString(EXOD_STAKING_CONTRACT))
  const sExodContract = SEXODERC20.bind(Address.fromString(SEXOD_ERC20_CONTRACT))
  const sExodSupply = toDecimal(sExodContract.circulatingSupply(), 9)
  const rebaseRate = toDecimal(stakingContract.epoch().value3, 9)
    .div(sExodSupply)
  const rebases = Math.log( parseFloat(rfv.div(sExodSupply).toString()) ) / Math.log( 1 + parseFloat(rebaseRate.toString()) )
  const runway = rebases * 28800 * 0.9 / 86400
  log.debug("rebases: {}, runway: {}", [rebases.toString(), runway.toString()])
  return BigDecimal.fromString(runway.toString())
}

function getTVL(exodPrice: BigDecimal): BigDecimal {
  const sExodContract = SEXODERC20.bind(Address.fromString(SEXOD_ERC20_CONTRACT))
  const sExodSupply = toDecimal(sExodContract.circulatingSupply(), 9)
  return sExodSupply.times(exodPrice)
}

function getTotalSupply(): BigDecimal {
  const exodContract = EXODERC20.bind(Address.fromString(EXOD_ERC20_CONTRACT))
  const totalSupply = exodContract.totalSupply()
  return toDecimal(totalSupply, 9)
}

function getCirculatingSupply(): BigDecimal {
  const circulatingSupplyContract = CirculatingSupply.bind(Address.fromString(CIRCULATING_SUPPLY_CONTRACT))
  const circulatingSupply = circulatingSupplyContract.OHMCirculatingSupply()
  return toDecimal(circulatingSupply, 9)
}

export function getIndex(): BigDecimal {
  const stakingContract = ExodStaking.bind(Address.fromString(EXOD_STAKING_CONTRACT))
  const index = toDecimal(stakingContract.index(), 9)
  return index
}

export function updateRunway(timestamp: string, rfv: BigDecimal): void {
  const protocolMetric = loadOrCreateProtocolMetric(timestamp)
  protocolMetric.runway = getRunway(rfv)
  protocolMetric.save()
}