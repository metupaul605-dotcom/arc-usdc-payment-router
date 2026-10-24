/**
 * StatusBanner — inline transaction-state surface.
 * Shows Pending / Confirming / Success (with explorer link) / Error states.
 * Never simulates progress — all state comes from real wagmi hooks.
 */
import { CheckCircle2, Loader2, XCircle, ExternalLink } from 'lucide-react'
import { buildTxExplorerUrl } from '@/onchain-facts'

const ARC_TESTNET_ID = 5042002

type Status = 'idle' | 'pending' | 'confirming' | 'success' | 'error'

interface Props {
  status: Status
  txHash?: `0x${string}`
  errorMessage?: string
  label?: string // e.g. 'Approve' | 'Pay Invoice'
}

const styles: Record<string, React.CSSProperties> = {
  pending: {
    background: 'rgba(79, 70, 229, 0.10)',
    border: '1px solid rgba(79, 70, 229, 0.22)',
    color: 'var(--ink-2)',
  },
  confirming: {
    background: 'rgba(79, 70, 229, 0.10)',
    border: '1px solid rgba(79, 70, 229, 0.22)',
    color: 'var(--ink-2)',
  },
  success: {
    background: 'rgba(34, 197, 94, 0.08)',
    border: '1px solid rgba(34, 197, 94, 0.22)',
    color: 'var(--success)',
  },
  error: {
    background: 'rgba(244, 63, 94, 0.08)',
    border: '1px solid rgba(244, 63, 94, 0.22)',
    color: 'var(--danger)',
  },
}

export default function StatusBanner({ status, txHash, errorMessage, label = '' }: Props) {
  if (status === 'idle') return null

  const explorerUrl = txHash
    ? buildTxExplorerUrl(ARC_TESTNET_ID, txHash)
    : null

  return (
    <div
      className="flex items-start gap-3 rounded-2xl p-3.5 text-sm font-medium"
      style={styles[status] ?? styles.pending}
      role="status"
      aria-live="polite"
    >
      {/* Icon */}
      <span className="mt-0.5 shrink-0">
        {status === 'success' && (
          <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />
        )}
        {(status === 'pending' || status === 'confirming') && (
          <Loader2 size={18} className="animate-spin" style={{ color: 'var(--accent-hover)' }} />
        )}
        {status === 'error' && (
          <XCircle size={18} style={{ color: 'var(--danger)' }} />
        )}
      </span>

      {/* Copy */}
      <div className="min-w-0 flex-1">
        {status === 'pending' && (
          <p style={{ color: 'var(--ink-2)' }}>
            {label ? `${label} — confirm` : 'Confirm'} in your wallet&hellip;
          </p>
        )}
        {status === 'confirming' && (
          <p style={{ color: 'var(--ink-2)' }}>
            {label ? `${label} submitted` : 'Transaction submitted'} — waiting for confirmation&hellip;
          </p>
        )}
        {status === 'success' && (
          <div>
            <p className="font-semibold" style={{ color: 'var(--success)' }}>
              {label ? `${label} confirmed!` : 'Confirmed!'}
            </p>
            {explorerUrl && (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium underline-offset-2 hover:underline"
                style={{ color: 'var(--success)' }}
              >
                View on Arc Testnet Explorer
                <ExternalLink size={11} />
              </a>
            )}
          </div>
        )}
        {status === 'error' && (
          <p style={{ color: 'var(--danger)' }}>
            {errorMessage ?? 'Something went wrong. Please try again.'}
          </p>
        )}
      </div>
    </div>
  )
}
