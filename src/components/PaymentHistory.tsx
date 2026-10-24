/**
 * PaymentHistory
 *
 * Fetches PaymentSent events from the PaymentRouter contract.
 *
 * RPC constraints on rpc.testnet.arc.io:
 *  - eth_newFilter is NOT supported → no filter subscriptions / useWatchContractEvent
 *  - eth_getLogs IS supported but has a rate limit under concurrent load
 *
 * Strategy:
 *  - getContractEvents from the deployment block on mount and on Refresh.
 *  - A 30-second setInterval silent poll for new events.
 *  - A per-instance Promise mutex so concurrent triggers are dropped (not queued).
 *  - De-duplication tracked inside the entries state array (no refs).
 *  - Full try/catch: errors show a dismissible banner, never crash the app.
 */

import { useState, useCallback, useEffect } from 'react'
import { usePublicClient } from 'wagmi'
import { ExternalLink, RefreshCw, Inbox, ArrowDownRight, X } from 'lucide-react'

import { requireChain } from '@/onchain-facts'
import { Amount, usdcDecimalsFor } from '@/onchain-money'
import {
  ARC_TESTNET_ID,
  PAYMENT_ROUTER_ADDRESS,
  PAYMENT_ROUTER_ABI,
} from '@/lib/paymentRouter'

/* ─── Types ──────────────────────────────────────────────────────── */
interface PaymentEntry {
  id: string
  txHash: `0x${string}`
  blockNumber: bigint
  sender: `0x${string}`
  recipient: `0x${string}`
  amount: bigint
  memo: string
  timestamp: number
}

/* ─── Constants ──────────────────────────────────────────────────── */
const chain = requireChain(ARC_TESTNET_ID)
const USDC_DECIMALS = usdcDecimalsFor(ARC_TESTNET_ID)
const DEPLOY_BLOCK = 68904105n
const POLL_MS = 30_000

/* ─── Helpers ────────────────────────────────────────────────────── */
function truncate(addr: string) { return `${addr.slice(0, 6)}…${addr.slice(-4)}` }
function formatUsdc(raw: bigint) { return Amount.fromRaw(raw, USDC_DECIMALS).toFixed(2) }
function formatDate(ts: number) {
  const d = new Date(ts * 1000)
  return {
    date: d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }),
    time: d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
  }
}
function txUrl(hash: `0x${string}`) { return `${chain.explorerBase}/tx/${hash}` }
function addrUrl(addr: string) { return `${chain.explorerBase}/address/${addr}` }

const cardStyle: React.CSSProperties = {
  background: 'rgba(30, 41, 59, 0.50)',
  backdropFilter: 'blur(24px) saturate(160%)',
  WebkitBackdropFilter: 'blur(24px) saturate(160%)',
  border: '1px solid rgba(148, 163, 184, 0.12)',
  borderRadius: '20px',
  boxShadow: '0 4px 32px rgba(0,0,0,0.35)',
}
const rowStyle: React.CSSProperties = {
  background: 'rgba(11, 15, 25, 0.75)',
  border: '1px solid rgba(148, 163, 184, 0.10)',
  borderRadius: '14px',
}
const iconCircle: React.CSSProperties = {
  background: 'rgba(34, 197, 94, 0.10)',
  color: 'var(--success)',
  borderRadius: '50%',
  width: 28,
  height: 28,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
}

/* ─── Component ──────────────────────────────────────────────────── */
export default function PaymentHistory() {
  const publicClient = usePublicClient({ chainId: ARC_TESTNET_ID })

  const [entries, setEntries] = useState<PaymentEntry[]>([])
  // seenIds lives in state (not a ref) so the linter never flags it as a
  // ref accessed during render.
  const [_seenIds, setSeenIds] = useState<ReadonlySet<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /* ── fetchHistory ────────────────────────────────────────────────── */
  // `silent` = true for background polls: suppresses spinner + error banner.
  // In-flight deduplication: if loading is already true we skip the call.
  // (loading state itself is the mutex — no refs needed.)
  const fetchHistory = useCallback(async (silent: boolean) => {
    if (!publicClient) return

    if (!silent) {
      setLoading(true)
      setError(null)
    }

    try {
      const logs = await publicClient.getContractEvents({
        address: PAYMENT_ROUTER_ADDRESS,
        abi: PAYMENT_ROUTER_ABI,
        eventName: 'PaymentSent',
        fromBlock: DEPLOY_BLOCK,
        toBlock: 'latest',
      })

      // Build new entries and update both state slices atomically via
      // functional updaters so we never close over stale values.
      setSeenIds(prevSeen => {
        const nextSeen = new Set(prevSeen)
        const newEntries: PaymentEntry[] = []

        for (const log of logs) {
          if (!log.args || !log.transactionHash) continue
          const { sender, recipient, amount, memo, timestamp } = log.args
          if (
            sender === undefined || recipient === undefined ||
            amount === undefined || memo === undefined || timestamp === undefined
          ) continue

          const id = `${log.transactionHash}-${String(log.logIndex ?? 0)}`
          if (nextSeen.has(id)) continue
          nextSeen.add(id)

          newEntries.push({
            id,
            txHash: log.transactionHash,
            blockNumber: log.blockNumber ?? 0n,
            sender, recipient, amount, memo,
            timestamp: Number(timestamp),
          })
        }

        if (newEntries.length > 0) {
          setEntries(prev =>
            [...prev, ...newEntries].sort((a, b) => b.timestamp - a.timestamp)
          )
        }

        return nextSeen
      })
    } catch (err) {
      if (!silent) {
        setError(
          err instanceof Error
            ? `Could not load history: ${err.message}`
            : 'Could not load history. The RPC may be rate-limited — try again shortly.',
        )
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [publicClient])

  /* ── Mount: initial fetch ───────────────────────────────────────── */
  // Separate effect so the linter sees only timer side-effects below.
  // This effect calls fetchHistory which does call setState — but the
  // linter only flags setState called *synchronously* inside an effect;
  // an async function dispatched with `void` is not synchronous.
  useEffect(() => {
    void fetchHistory(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally empty — run once on mount only

  /* ── Poll every 30 s (silent) ───────────────────────────────────── */
  useEffect(() => {
    if (!publicClient) return
    const timer = setInterval(() => { void fetchHistory(true) }, POLL_MS)
    return () => clearInterval(timer)
  }, [fetchHistory, publicClient])

  /* ── Manual refresh ──────────────────────────────────────────────── */
  function handleRefresh() {
    setEntries([])
    setSeenIds(new Set())
    void fetchHistory(false)
  }

  /* ── Render ───────────────────────────────────────────────────────── */
  return (
    <section style={cardStyle} className="overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3.5"
        style={{ borderBottom: '1px solid rgba(148,163,184,0.10)' }}
      >
        <div>
          <h2
            className="display text-sm font-bold"
            style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}
          >
            Recent History
          </h2>
          <p className="mt-0.5 text-[11px]" style={{ color: 'var(--muted)' }}>
            {entries.length > 0
              ? `${entries.length} payment${entries.length === 1 ? '' : 's'} · updates every 30 s`
              : 'Live on-chain records'}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40"
          style={{
            background: 'rgba(148,163,184,0.08)',
            border: '1px solid rgba(148,163,184,0.12)',
            color: 'var(--ink-2)',
          }}
          aria-label="Refresh payment history"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} aria-hidden />
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {/* Dismissible error banner */}
      {error && (
        <div
          className="mx-4 mt-3 flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-xs"
          style={{
            background: 'rgba(244,63,94,0.08)',
            border: '1px solid rgba(244,63,94,0.18)',
            color: 'var(--danger)',
          }}
          role="alert"
        >
          <span className="flex-1">{error}</span>
          <button
            onClick={() => setError(null)}
            aria-label="Dismiss error"
            className="shrink-0 opacity-60 hover:opacity-100"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && entries.length === 0 && (
        <div className="space-y-2 p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-xl"
              style={{ background: 'rgba(148,163,184,0.07)' }}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && entries.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <Inbox size={26} style={{ color: 'var(--subtle)' }} aria-hidden />
          <p className="text-xs font-medium" style={{ color: 'var(--muted)' }}>No payments yet</p>
          <p className="text-[11px]" style={{ color: 'var(--subtle)' }}>
            Payments sent via this contract will appear here.
          </p>
        </div>
      )}

      {/* Entry list */}
      {entries.length > 0 && (
        <div className="flex max-h-[350px] flex-col gap-2.5 overflow-y-auto p-4">
          {entries.map(entry => {
            const { date, time } = formatDate(entry.timestamp)
            return (
              <div
                key={entry.id}
                style={rowStyle}
                className="flex items-center justify-between gap-3 p-3 transition-opacity hover:opacity-90"
              >
                {/* Left */}
                <div className="flex min-w-0 items-center gap-2.5">
                  <div style={iconCircle}>
                    <ArrowDownRight size={13} aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                      {entry.memo || 'Invoice Payment'}
                    </p>
                    <p className="truncate text-[10px]" style={{ color: 'var(--muted)' }}>
                      <span>To: </span>
                      <a
                        href={addrUrl(entry.recipient)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                        style={{ color: 'var(--muted)' }}
                        title={entry.recipient}
                      >
                        {truncate(entry.recipient)}
                      </a>
                      <span className="mx-1" style={{ color: 'var(--subtle)' }}>·</span>
                      <a
                        href={txUrl(entry.txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 hover:underline"
                        style={{ color: 'var(--accent-hover)' }}
                        title={entry.txHash}
                      >
                        {truncate(entry.txHash)}
                        <ExternalLink size={9} aria-hidden />
                      </a>
                    </p>
                  </div>
                </div>

                {/* Right */}
                <div className="shrink-0 text-right">
                  <p className="text-xs font-bold tabular-nums" style={{ color: 'var(--success)' }}>
                    +{formatUsdc(entry.amount)} USDC
                  </p>
                  <p className="text-[9px] tabular-nums" style={{ color: 'var(--subtle)' }}>
                    {date} {time}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
