// import { BigInt, ethereum } from '@graphprotocol/graph-ts'
// import { Treasury } from '../../generated/schema'
// import { dayFromTimestamp } from '../utils/helpers'
// import { updateTreasury } from '../entitites/Treasury'
// import { updateProtocolMetric } from '../entitites/ProtocolMetric'
// import { updateSimpleStaking } from '../entitites/SimpleStaking'

// export function handleBlock(block: ethereum.Block): void {
//   if (block.timestamp.toU32() % 86400 < 5) {
//     const dayTimestamp = dayFromTimestamp(block.timestamp)
//     const treasury = Treasury.load(dayTimestamp)
//     if (!treasury) {
//       updateTreasury(dayTimestamp, block.number)
//       updateProtocolMetric(dayTimestamp)
//       updateSimpleStaking(dayTimestamp)
//     }
//   }
// }