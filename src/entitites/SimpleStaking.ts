import { Address, BigDecimal } from "@graphprotocol/graph-ts";
import { SimpleStaking } from "../../generated/schema";
import { ExodStaking } from "../../generated/TreasuryTracker/ExodStaking";
import { SEXODERC20 } from "../../generated/TreasuryTracker/SEXODERC20";
import { EXOD_STAKING_CONTRACT, SEXOD_ERC20_CONTRACT } from "../utils/constants";
import { toDecimal } from "../utils/helpers";

export function loadOrCreateSimpleStaking(timestamp: string): SimpleStaking {
  let simpleStaking = SimpleStaking.load(timestamp)
  if (!simpleStaking) {
    simpleStaking = new SimpleStaking(timestamp)
    simpleStaking.stakedSupply = BigDecimal.zero()
    simpleStaking.rebaseRate = BigDecimal.zero()
    simpleStaking.apy = BigDecimal.zero()
    simpleStaking.index = BigDecimal.zero()
  }
  return simpleStaking
}

export function updateSimpleStaking(timestamp: string): void {
  const simpleStaking = loadOrCreateSimpleStaking(timestamp)
  simpleStaking.stakedSupply = getStakedSupply()
  const rebaseRateApyAndIndex = getRebaseRateApyAndIndex(simpleStaking.stakedSupply)
  simpleStaking.rebaseRate = rebaseRateApyAndIndex[0]
  simpleStaking.apy = rebaseRateApyAndIndex[1]
  simpleStaking.index = rebaseRateApyAndIndex[2]
  simpleStaking.save()
}

function getStakedSupply(): BigDecimal {
  const sExodiaContract = SEXODERC20.bind(Address.fromString(SEXOD_ERC20_CONTRACT))
  const stakedSupply = toDecimal(sExodiaContract.circulatingSupply(), 9)
  return stakedSupply
}

function getRebaseRateApyAndIndex(stakedSupply: BigDecimal): BigDecimal[] {
  const exodStakingContract = ExodStaking.bind(Address.fromString(EXOD_STAKING_CONTRACT))
  const nextDistributedExod = toDecimal(exodStakingContract.epoch().value3, 9)
  const index = toDecimal(exodStakingContract.index(), 9)

  if (stakedSupply.gt(BigDecimal.zero())) {
    const rebaseRate = nextDistributedExod.div(stakedSupply).times(BigDecimal.fromString("100"))
    const blockLength = 0.9
    const epochLength = 28800
    const epochSeconds = epochLength * blockLength
    const rebasesPerDay = 86400 / epochSeconds
    const rebasesPerYear = rebasesPerDay * 365
    const apy = BigDecimal.fromString(
      ( (Math.pow( 1 + ( parseFloat( rebaseRate.toString() ) / 100 ), rebasesPerYear ) - 1) * 100 )
      .toString()
    )
  
    return [rebaseRate, apy, index]
  } else {
    return [BigDecimal.zero(), BigDecimal.zero(), index]
  }
}