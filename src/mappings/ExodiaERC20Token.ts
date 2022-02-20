import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { ERC20 } from "../../generated/TreasuryTracker/ERC20";
import { Transfer } from "../../generated/TreasuryTracker/EXODERC20";
import { loadOrCreateExodian } from "../entitites/Exodian";
import { loadOrCreateAux } from "../entitites/Aux";
import { EXOD_ERC20_CONTRACT } from "../utils/constants";
import { dayFromTimestamp, hourFromTimestamp, toDecimal } from "../utils/helpers";
import { updateHolders, updateProtocolMetric } from "../entitites/ProtocolMetric";
import { updateSimpleStaking } from "../entitites/SimpleStaking";
import { updateTreasury } from "../entitites/Treasury";

export function handleTransfer(transfer: Transfer): void {
  const dayTimestamp = dayFromTimestamp(transfer.block.timestamp)
  const hourTimestamp = hourFromTimestamp(transfer.block.timestamp)
  const aux = loadOrCreateAux()
  if (aux.hourlyTimestamp.notEqual(hourTimestamp)) {
    aux.hourlyTimestamp = hourTimestamp
    aux.save()
    const treasuryValues = updateTreasury(dayTimestamp, transfer.block.number)
    updateProtocolMetric(dayTimestamp, treasuryValues)
    updateSimpleStaking(dayTimestamp)
  }

  const exodERC20 = ERC20.bind(Address.fromString(EXOD_ERC20_CONTRACT))

  if (transfer.params.from.notEqual(Address.zero())
    && transfer.params.from.notEqual(Address.fromHexString(EXOD_ERC20_CONTRACT))
  ) {
    const sender = loadOrCreateExodian(transfer.params.from.toHexString())
    sender.exodBalance = toDecimal(exodERC20.balanceOf(transfer.params.from), 9)
    if (sender.exodBalance.le(BigDecimal.zero())
      && sender.sExodBalance.le(BigDecimal.zero())
      && sender.wsExodBalance.le(BigDecimal.zero())
    ) {
      const aux = loadOrCreateAux()
      aux.totalHolders = aux.totalHolders.minus(BigInt.fromU32(1))
      aux.save()
      sender.heldSince = transfer.block.timestamp
      sender.active = false
    }
    sender.save()
  }

  if (transfer.params.to.notEqual(Address.zero())
    && transfer.params.to.notEqual(Address.fromHexString(EXOD_ERC20_CONTRACT))) {
    const receiver = loadOrCreateExodian(transfer.params.to.toHexString())
    if (receiver.exodBalance.le(BigDecimal.zero())
      && receiver.sExodBalance.le(BigDecimal.zero())
      && receiver.wsExodBalance.le(BigDecimal.zero())
    ) {
      const aux = loadOrCreateAux()
      aux.totalHolders = aux.totalHolders.plus(BigInt.fromU32(1))
      aux.save()
      receiver.heldSince = transfer.block.timestamp
      receiver.active = true
    }
    receiver.exodBalance = toDecimal(exodERC20.balanceOf(transfer.params.to), 9)
    receiver.save()
  }

  updateHolders(dayTimestamp)
}