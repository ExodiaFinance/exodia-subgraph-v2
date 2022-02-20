import { BondCreated } from '../../../generated/DAIBond/Bond'
import { updateBondRevenue } from '../../entitites/BondRevenue'
import { createBondDeposit } from '../../entitites/BondDeposit'
import { updateDailyBondRevenue } from '../../entitites/DailyBondRevenue'
import { updateAllTimeBondRevenue } from '../../entitites/AllTimeBondRevenue'

export function handleBondCreated(bond: BondCreated): void {
  const bondInfo = createBondDeposit(bond)
  updateBondRevenue(bond, createBondDeposit(bond))
  updateDailyBondRevenue(bondInfo)
  updateAllTimeBondRevenue(bondInfo)
}