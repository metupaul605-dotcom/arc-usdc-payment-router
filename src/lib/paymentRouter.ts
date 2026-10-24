/**
 * Shared PaymentRouter contract constants.
 *
 * Single source of truth for the address and ABI used by both
 * PaymentForm and PaymentHistory — import from here, never inline.
 */

export const ARC_TESTNET_ID = 5042002 as const

export const PAYMENT_ROUTER_ADDRESS =
  '0xabfe34db072e29a7dbff1d239581629756dae714' as const

export const PAYMENT_ROUTER_ABI = [
  {
    type: 'function',
    name: 'payInvoice',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'memo', type: 'string' },
    ],
    outputs: [],
  },
  {
    type: 'event',
    name: 'PaymentSent',
    inputs: [
      { name: 'sender', type: 'address', indexed: true },
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'memo', type: 'string', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
] as const
