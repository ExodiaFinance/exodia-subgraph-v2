import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { ERC20 } from "../../generated/TreasuryTracker/ERC20";
import { Transfer } from "../../generated/TreasuryTracker/EXODERC20";
import { loadOrCreateExodian } from "../entitites/Exodian";
import { loadOrCreateAux } from "../entitites/Aux";
import { WSEXOD_ERC20_CONTRACT } from "../utils/constants";
import { dayFromTimestamp, toDecimal } from "../utils/helpers";
import { updateHolders } from "../entitites/ProtocolMetric";

export function handleTransfer(transfer: Transfer): void {
  const wsExodERC20 = ERC20.bind(Address.fromString(WSEXOD_ERC20_CONTRACT))

  if (transfer.params.from.notEqual(Address.zero())
   && transfer.params.from.notEqual(Address.fromHexString(WSEXOD_ERC20_CONTRACT))
  ) {
    const sender = loadOrCreateExodian(transfer.params.from.toHexString())
    sender.wsExodBalance = toDecimal(wsExodERC20.balanceOf(transfer.params.from), 9)
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
    && transfer.params.to.notEqual(Address.fromHexString(WSEXOD_ERC20_CONTRACT))
  ) {
    const receiver = loadOrCreateExodian(transfer.params.to.toHexString())
    if (receiver.exodBalance.le(BigDecimal.zero())
      && receiver.sExodBalance.le(BigDecimal.zero())
      && receiver.wsExodBalance.le(BigDecimal.zero())
    ) {
      const aux = loadOrCreateAux()
      aux.totalHolders = aux.totalHolders.plus(BigInt.fromU32(1))
      aux.save()
      receiver.heldSince = transfer.block.timestamp
    }
    receiver.wsExodBalance = toDecimal(wsExodERC20.balanceOf(transfer.params.to), 9)
    receiver.save()
  }
  
  const dayTimestamp = dayFromTimestamp(transfer.block.timestamp)
  updateHolders(dayTimestamp)
}