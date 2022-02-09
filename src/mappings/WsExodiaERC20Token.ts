import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { Transfer } from "../../generated/TreasuryTracker/EXODERC20";
import { loadOrCreateExodian } from "../entitites/Exodian";
import { loadOrCreateHolders } from "../entitites/Holders";
import { WSEXOD_ERC20_CONTRACT } from "../utils/constants";
import { toDecimal } from "../utils/helpers";

export function handleTransfer(transfer: Transfer): void {
  const amount = toDecimal(transfer.params.value, 9)

  if (transfer.params.from.notEqual(Address.zero())
   && transfer.params.from.notEqual(Address.fromHexString(WSEXOD_ERC20_CONTRACT))
  ) {
    const sender = loadOrCreateExodian(transfer.params.from.toHexString())
    sender.wsExodBalance = sender.wsExodBalance.minus(amount)
    if (sender.exodBalance.le(BigDecimal.zero())
      && sender.sExodBalance.le(BigDecimal.zero())
      && sender.wsExodBalance.le(BigDecimal.zero())
    ) {
      const holders = loadOrCreateHolders()
      holders.totalHolders = holders.totalHolders.minus(BigInt.fromU32(1))
      holders.save()
      sender.heldSince = transfer.block.timestamp
    }
    sender.save()
  }

  if (transfer.params.to.notEqual(Address.zero())) {
    const receiver = loadOrCreateExodian(transfer.params.to.toHexString())
    if (receiver.exodBalance.le(BigDecimal.zero())
      && receiver.sExodBalance.le(BigDecimal.zero())
      && receiver.wsExodBalance.le(BigDecimal.zero())
    ) {
      const holders = loadOrCreateHolders()
      holders.totalHolders = holders.totalHolders.plus(BigInt.fromU32(1))
      holders.save()
      receiver.heldSince = transfer.block.timestamp
    }
    receiver.wsExodBalance = receiver.wsExodBalance.plus(amount)
    receiver.save()
  }
}