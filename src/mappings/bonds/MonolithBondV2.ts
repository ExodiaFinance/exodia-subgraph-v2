import { BondCreated } from '../../../generated/DAIBond/Bond'
import { updateBond } from '../../entitites/Bond'
import { createBondDeposit } from '../../entitites/BondDeposit'

export function handleBondCreated(bond: BondCreated): void {
  updateBond(bond, createBondDeposit(bond))
}