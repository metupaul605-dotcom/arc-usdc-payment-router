/**
 * PaymentForm — 2-step USDC payment flow.
 *
 * Step 1: Check allowance. If < amount → show "Approve USDC".
 * Step 2: Once allowance is sufficient → show "Pay Invoice".
 *
 * Transaction states are derived directly from wagmi hook values
 * (no useEffect status sync). This keeps the component purely
 * reactive with no side-effect races.
 */
import { useState, useEffect } from 'react'
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
} from 'wagmi'
import { erc20Abi, isAddress } from 'viem'
import { TokenUSDC } from '@web3icons/react'
import { ArrowRight, ShieldCheck, Wallet } from 'lucide-react'

import { getUsdc } from '@/onchain-facts'
import { parseAmount, Amount, usdcDecimalsFor } from '@/onchain-money'
import { parseOnchainError } from '@/lib/parseOnchainError'
import {
  ARC_TESTNET_ID,
  PAYMENT_ROUTER_ADDRESS,
  PAYMENT_ROUTER_ABI,
} from '@/lib/paymentRouter'
import StatusBanner from './StatusBanner'

/* ─── Chain / contract constants ─────────────────────────────────── */
const usdcFact = getUsdc(ARC_TESTNET_ID)!
const USDC_ADDRESS = usdcFact.address as `0x${string}`

/* ─── Shared card / field style helpers ──────────────────────────── */
const card: React.CSSProperties = {
  background: 'rgba(30, 41, 59, 0.50)',
  backdropFilter: 'blur(24px) saturate(160%)',
  WebkitBackdropFilter: 'blur(24px) saturate(160%)',
  border: '1px solid rgba(148, 163, 184, 0.12)',
  borderRadius: '20px',
  boxShadow: '0 4px 32px rgba(0,0,0,0.35)',
}

const field: React.CSSProperties = {
  background: 'rgba(11, 15, 25, 0.80)',
  border: '1px solid rgba(148, 163, 184, 0.13)',
  borderRadius: '12px',
}

/* ─── Component ──────────────────────────────────────────────────── */
export default function PaymentForm() {
  const { address, isConnected, chainId } = useAccount()
  const { switchChain, isPending: isSwitching } = useSwitchChain()

  /* form fields */
  const [recipient, setRecipient] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [memo, setMemo] = useState('')

  /* user-facing error messages */
  const [approveErrorMsg, setApproveErrorMsg] = useState('')
  const [payErrorMsg, setPayErrorMsg] = useState('')

  /* derived */
  const wrongChain = isConnected && chainId !== ARC_TESTNET_ID
  const validRecipient = isAddress(recipient)
  const parsedAmount = (() => {
    try {
      if (!amountStr || Number(amountStr) <= 0) return null
      return parseAmount(ARC_TESTNET_ID, amountStr)
    } catch {
      return null
    }
  })()
  const formReady = validRecipient && parsedAmount !== null

  /* ── USDC balance ─────────────────────────────────────────────── */
  const { data: rawBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: ARC_TESTNET_ID,
    query: { enabled: !!address && !wrongChain },
  })
  const formattedBalance =
    rawBalance !== undefined
      ? Amount.fromRaw(rawBalance, usdcDecimalsFor(ARC_TESTNET_ID)).toFixed(2)
      : null

  /* ── Allowance read ───────────────────────────────────────────── */
  const { data: rawAllowance, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address ? [address, PAYMENT_ROUTER_ADDRESS] : undefined,
    chainId: ARC_TESTNET_ID,
    query: { enabled: !!address && !wrongChain, refetchInterval: 6_000 },
  })

  const sufficientAllowance =
    rawAllowance !== undefined &&
    parsedAmount !== null &&
    rawAllowance >= parsedAmount.raw

  /* ── Approve tx ───────────────────────────────────────────────── */
  const {
    writeContractAsync: writeApprove,
    data: approveHash,
    isPending: approveWalletPending,
    reset: resetApprove,
  } = useWriteContract()

  const {
    isLoading: approveConfirming,
    isSuccess: approveConfirmed,
    isError: approveReceiptError,
  } = useWaitForTransactionReceipt({ hash: approveHash })

  const approveStatus = (() => {
    if (approveConfirmed) return 'success' as const
    if (approveConfirming) return 'confirming' as const
    if (approveWalletPending) return 'pending' as const
    if (approveReceiptError && approveHash) return 'error' as const
    if (approveErrorMsg) return 'error' as const
    return 'idle' as const
  })()

  useEffect(() => {
    if (approveConfirmed) void refetchAllowance()
  }, [approveConfirmed, refetchAllowance])

  async function handleApprove() {
    if (!parsedAmount) return
    setApproveErrorMsg('')
    try {
      await writeApprove({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: 'approve',
        args: [PAYMENT_ROUTER_ADDRESS, parsedAmount.raw],
        chainId: ARC_TESTNET_ID,
      })
    } catch (err) {
      const msg = parseOnchainError(err)
      if (msg !== 'Transaction cancelled.') setApproveErrorMsg(msg)
    }
  }

  /* ── Pay Invoice tx ───────────────────────────────────────────── */
  const {
    writeContractAsync: writePay,
    data: payHash,
    isPending: payWalletPending,
    reset: resetPay,
  } = useWriteContract()

  const {
    isLoading: payConfirming,
    isSuccess: payConfirmed,
    isError: payReceiptError,
  } = useWaitForTransactionReceipt({ hash: payHash })

  const payStatus = (() => {
    if (payConfirmed) return 'success' as const
    if (payConfirming) return 'confirming' as const
    if (payWalletPending) return 'pending' as const
    if (payReceiptError && payHash) return 'error' as const
    if (payErrorMsg) return 'error' as const
    return 'idle' as const
  })()

  async function handlePay() {
    if (!parsedAmount || !validRecipient) return
    setPayErrorMsg('')
    try {
      await writePay({
        address: PAYMENT_ROUTER_ADDRESS,
        abi: PAYMENT_ROUTER_ABI,
        functionName: 'payInvoice',
        args: [recipient, parsedAmount.raw, memo],
        chainId: ARC_TESTNET_ID,
      })
    } catch (err) {
      const msg = parseOnchainError(err)
      if (msg !== 'Transaction cancelled.') setPayErrorMsg(msg)
    }
  }

  function handleReset() {
    setRecipient('')
    setAmountStr('')
    setMemo('')
    setApproveErrorMsg('')
    setPayErrorMsg('')
    resetApprove()
    resetPay()
  }

  const approveBusy = approveStatus === 'pending' || approveStatus === 'confirming'
  const payBusy     = payStatus === 'pending'    || payStatus === 'confirming'

  /* ── Render ───────────────────────────────────────────────────── */
  return (
    <section className="flex w-full flex-col gap-4">

      {/* Main card */}
      <div className="flex flex-col gap-4 p-5" style={card}>

        {/* Title */}
        <div>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
            Send USDC Invoice
          </h2>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
            Transfer testnet USDC seamlessly on Arc Network.
          </p>
        </div>

        {/* Balance chip */}
        <div
          className="flex items-center justify-between rounded-xl px-3.5 py-2.5"
          style={field}
        >
          <span className="text-xs" style={{ color: 'var(--muted)' }}>
            Your Balance
          </span>
          <div className="flex items-center gap-1.5">
            <TokenUSDC size={14} variant="branded" />
            <span className="tabular-nums text-xs font-bold" style={{ color: 'var(--accent-hover)' }}>
              {!isConnected
                ? '—'
                : formattedBalance === null
                  ? <span className="inline-block h-3 w-16 animate-pulse rounded" style={{ background: 'var(--border)' }} />
                  : `${formattedBalance} USDC`}
            </span>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2">
          <StepDot
            n={1}
            done={approveStatus === 'success' || sufficientAllowance}
            active={!sufficientAllowance}
            label="Approve"
          />
          <div
            className="h-px flex-1"
            style={{ background: sufficientAllowance ? 'var(--success)' : 'var(--border)' }}
          />
          <StepDot
            n={2}
            done={payStatus === 'success'}
            active={sufficientAllowance}
            label="Pay"
          />
        </div>

        {/* Fields */}
        <div className="flex flex-col gap-3">

          {/* Recipient */}
          <div>
            <label
              htmlFor="recipient"
              className="mb-1 block text-xs font-medium"
              style={{ color: 'var(--ink-2)' }}
            >
              Recipient Wallet Address
            </label>
            <input
              id="recipient"
              type="text"
              spellCheck={false}
              autoComplete="off"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value.trim())}
              placeholder="0x..."
              disabled={payStatus === 'success'}
              className="mono w-full px-3 py-2 text-xs outline-none transition-all placeholder:opacity-40 disabled:opacity-50"
              style={{
                ...field,
                color: 'var(--ink)',
                borderColor: recipient && !validRecipient ? 'var(--danger)' : undefined,
              }}
            />
            {recipient && !validRecipient && (
              <p className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>
                Not a valid EVM address
              </p>
            )}
          </div>

          {/* Amount */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label
                htmlFor="amount"
                className="text-xs font-medium"
                style={{ color: 'var(--ink-2)' }}
              >
                Amount in USDC
              </label>
              {formattedBalance && (
                <button
                  type="button"
                  onClick={() => setAmountStr(formattedBalance)}
                  disabled={payStatus === 'success'}
                  className="text-xs font-semibold underline-offset-2 hover:underline disabled:opacity-40"
                  style={{ color: 'var(--accent-hover)' }}
                >
                  Max
                </button>
              )}
            </div>
            <div className="relative" style={field}>
              <input
                id="amount"
                inputMode="decimal"
                value={amountStr}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9.]/g, '')
                  if (v === '' || /^\d*\.?\d*$/.test(v)) setAmountStr(v)
                }}
                placeholder="0.00"
                disabled={payStatus === 'success'}
                className="display w-full bg-transparent px-3 py-2 pr-16 text-xl font-bold tabular-nums outline-none placeholder:opacity-30 disabled:opacity-50"
                style={{ color: 'var(--ink)', borderRadius: '12px' }}
              />
              <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1">
                <TokenUSDC size={13} variant="branded" />
                <span className="text-xs font-bold" style={{ color: 'var(--accent-hover)' }}>
                  USDC
                </span>
              </div>
            </div>
          </div>

          {/* Memo */}
          <div>
            <label
              htmlFor="memo"
              className="mb-1 block text-xs font-medium"
              style={{ color: 'var(--ink-2)' }}
            >
              Payment Memo / Note{' '}
              <span style={{ color: 'var(--subtle)' }}>(optional)</span>
            </label>
            <textarea
              id="memo"
              rows={2}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="Invoice details..."
              disabled={payStatus === 'success'}
              className="w-full resize-none px-3 py-2 text-xs outline-none placeholder:opacity-40 disabled:opacity-50"
              style={{ ...field, color: 'var(--ink)', fontFamily: 'DM Sans, sans-serif' }}
            />
          </div>
        </div>

        {/* Status banners */}
        <div className="flex flex-col gap-2">
          {approveStatus !== 'idle' && (
            <StatusBanner
              status={approveStatus}
              txHash={approveHash}
              errorMessage={
                approveErrorMsg ||
                (approveReceiptError ? 'Transaction failed. Please try again.' : undefined)
              }
              label="Approve USDC"
            />
          )}
          {payStatus !== 'idle' && (
            <StatusBanner
              status={payStatus}
              txHash={payHash}
              errorMessage={
                payErrorMsg ||
                (payReceiptError ? 'Transaction failed. Please try again.' : undefined)
              }
              label="Pay Invoice"
            />
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-2">

          {/* Wrong chain */}
          {wrongChain && (
            <ActionButton
              onClick={() => switchChain({ chainId: ARC_TESTNET_ID })}
              disabled={isSwitching}
              busy={isSwitching}
              variant="warn"
            >
              Switch to Arc Testnet
            </ActionButton>
          )}

          {/* Not connected */}
          {!isConnected && (
            <p
              className="rounded-2xl py-2.5 text-center text-xs font-semibold"
              style={{ background: 'var(--surface-muted)', color: 'var(--muted)' }}
            >
              <Wallet size={13} className="mr-1.5 inline" />
              Connect your wallet to continue
            </p>
          )}

          {/* Step 1: Approve */}
          {isConnected && !wrongChain && !sufficientAllowance && payStatus !== 'success' && (
            <ActionButton
              onClick={() => void handleApprove()}
              disabled={!formReady || approveBusy}
              busy={approveBusy}
              variant="amber"
              icon={<ShieldCheck size={14} />}
            >
              {approveBusy
                ? approveStatus === 'pending' ? 'Confirm in wallet…' : 'Approving…'
                : `1. Approve USDC`}
            </ActionButton>
          )}

          {/* Step 2: Pay */}
          {isConnected && !wrongChain && sufficientAllowance && payStatus !== 'success' && (
            <ActionButton
              onClick={() => void handlePay()}
              disabled={!formReady || payBusy}
              busy={payBusy}
              icon={<ArrowRight size={14} />}
            >
              {payBusy
                ? payStatus === 'pending' ? 'Confirm in wallet…' : 'Sending…'
                : `2. Pay Invoice Now`}
            </ActionButton>
          )}

          {/* Success reset */}
          {payStatus === 'success' && (
            <button
              onClick={handleReset}
              className="w-full rounded-2xl py-2.5 text-xs font-semibold transition-all hover:scale-[1.01] active:scale-[0.99]"
              style={{
                background: 'var(--surface-muted)',
                border: '1px solid var(--border)',
                color: 'var(--ink-2)',
              }}
            >
              Send Another Payment
            </button>
          )}
        </div>

        {/* Contextual hint */}
        {isConnected && !wrongChain && !sufficientAllowance && formReady && (
          <p className="text-center text-xs" style={{ color: 'var(--subtle)' }}>
            Step 1 of 2 — allow the contract to spend your USDC, then pay.
          </p>
        )}
        {isConnected && !wrongChain && sufficientAllowance && payStatus !== 'success' && (
          <p className="text-center text-xs" style={{ color: 'var(--success)' }}>
            USDC approved — ready to send.
          </p>
        )}

      </div>
    </section>
  )
}

/* ─── Sub-components ──────────────────────────────────────────────── */

function StepDot({
  n, done, active, label,
}: { n: number; done: boolean; active: boolean; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div
        className="flex size-6 items-center justify-center rounded-full text-xs font-bold transition-all"
        style={{
          background: done ? 'var(--success)' : active ? 'var(--accent)' : 'var(--surface-muted)',
          color: done || active ? '#ffffff' : 'var(--subtle)',
          border: done || active ? 'none' : '1.5px solid var(--border)',
        }}
      >
        {done ? <span>&#10003;</span> : n}
      </div>
      <span
        className="text-[10px] font-medium"
        style={{ color: done ? 'var(--success)' : active ? 'var(--ink)' : 'var(--subtle)' }}
      >
        {label}
      </span>
    </div>
  )
}

function ActionButton({
  children, onClick, disabled, busy, icon, variant = 'primary',
}: {
  children: React.ReactNode
  onClick: () => void
  disabled: boolean
  busy?: boolean
  icon?: React.ReactNode
  variant?: 'primary' | 'warn' | 'amber'
}) {
  const bg =
    variant === 'warn'  ? 'var(--danger)' :
    variant === 'amber' ? '#d97706'       :
    'var(--accent)'

  const shadow =
    variant === 'warn'  ? '0 2px 14px rgba(244,63,94,0.28)'    :
    variant === 'amber' ? '0 2px 14px rgba(217,119,6,0.28)'    :
    '0 2px 18px var(--accent-shadow)'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center justify-center gap-2 rounded-2xl py-2.5 text-xs font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
      style={{ background: bg, boxShadow: shadow }}
    >
      {busy ? (
        <svg className="size-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
      ) : icon}
      {children}
    </button>
  )
}
