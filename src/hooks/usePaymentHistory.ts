/**
 * usePaymentHistory — standalone hook for fetching PaymentSent events.
 *
 * RPC constraints on rpc.testnet.arc.io:
 *   - eth_newFilter is NOT supported — no filter subscriptions.
 *   - eth_getLogs IS supported but has a rate limit under concurrent load.
 *
 * This hook:
 *   - Queries from the deployment block (68904105) so no events are missed.
 *   - Uses an in-flight guard (fetching ref) so duplicate calls are dropped.
 *   - Returns refreshHistory() for callers that want manual or polled refetch.
 *   - Does NOT self-trigger via useEffect — the caller decides the schedule.
 *
 * Usage:
 *   const { history, loading, error, refreshHistory } = usePaymentHistory(client)
 *   // Initial load + 30 s poll from the consumer:
 *   useEffect(() => {
 *     void refreshHistory()
 *     const t = setInterval(() => void refreshHistory(true), 30_000)
 *     return () => clearInterval(t)
 *   }, [refreshHistory])
 */

import { useState, useCallback, useRef } from 'react'
import type { PublicClient } from 'viem'
import { Amount, usdcDecimalsFor } from '@/onchain-money'
import {
  ARC_TESTNET_ID,
  PAYMENT_ROUTER_ADDRESS,
  PAYMENT_ROUTER_ABI,
} from '@/lib/paymentRouter'

/* ─── Types ──────────────────────────────────────────────────────── */
export interface PaymentHistoryEntry {
  id: string
  txHash: string
  sender: string
  recipient: string
  /** Human-readable USDC amount, e.g. "12.50" */
  amount: string
  memo: string
  /** ISO timestamp string */
  timestamp: string
  /** Unix seconds, for sorting */
  timestampRaw: number
}

/* ─── Constants ──────────────────────────────────────────────────── */
const USDC_DECIMALS = usdcDecimalsFor(ARC_TESTNET_ID)
/** Deployment block of PaymentRouter on Arc Testnet (Oct 24 2026). */
const DEPLOY_BLOCK = 68904105n

/* ─── Hook ───────────────────────────────────────────────────────── */
export function usePaymentHistory(
  publicClient: PublicClient | undefined,
  contractAddress: `0x${string}` = PAYMENT_ROUTER_ADDRESS,
) {
  const [history, setHistory] = useState<PaymentHistoryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // In-flight guard — drops calls that arrive while a fetch is running.
  const fetching = useRef(false)
  // Seen IDs — prevents duplicates when polling merges with existing state.
  const seenRef = useRef(new Set<string>())

  /**
   * Fetch all PaymentSent events from the deployment block.
   * Pass silent=true for background polls — skips the loading spinner
   * and suppresses error banners on transient rate-limit hiccups.
   */
  const refreshHistory = useCallback(async (silent = false) => {
    if (!publicClient || fetching.current) return
    fetching.current = true
    if (!silent) {
      setLoading(true)
      setError(null)
    }

    try {
      const logs = await publicClient.getContractEvents({
        address: contractAddress,
        abi: PAYMENT_ROUTER_ABI,
        eventName: 'PaymentSent',
        // Pinned to the deployment block — the earliest block that can
        // contain a PaymentSent event. Never use a sliding window here;
        // it would silently drop old events once the chain advances past
        // DEPLOY_BLOCK + windowSize.
        fromBlock: DEPLOY_BLOCK,
        toBlock: 'latest',
      })

      const newEntries: PaymentHistoryEntry[] = []

      for (const log of logs) {
        if (!log.args || !log.transactionHash) continue
        const { sender, recipient, amount, memo, timestamp } = log.args
        if (
          sender === undefined || recipient === undefined ||
          amount === undefined || memo === undefined || timestamp === undefined
        ) continue

        const id = `${log.transactionHash}-${String(log.logIndex ?? 0)}`
        if (seenRef.current.has(id)) continue
        seenRef.current.add(id)

        const tsNum = Number(timestamp)
        newEntries.push({
          id,
          txHash: log.transactionHash,
          sender,
          recipient,
          // Use Amount.fromRaw — never Number(bigint)/1e6, loses precision above MAX_SAFE_INTEGER.
          amount: Amount.fromRaw(amount, USDC_DECIMALS).toFixed(2),
          memo: memo || 'No Memo',
          timestamp: new Date(tsNum * 1000).toLocaleString(),
          timestampRaw: tsNum,
        })
      }

      if (newEntries.length > 0) {
        setHistory(prev =>
          [...prev, ...newEntries].sort((a, b) => b.timestampRaw - a.timestampRaw)
        )
      }
    } catch (err) {
      if (!silent) {
        setError(
          err instanceof Error
            ? `Could not load history: ${err.message}`
            : 'Could not load history. The RPC may be rate-limited — try again shortly.',
        )
      }
      // Silent errors are swallowed — the next poll will retry automatically.
    } finally {
      fetching.current = false
      if (!silent) setLoading(false)
    }
  }, [publicClient, contractAddress])

  return { history, loading, error, refreshHistory }
}
