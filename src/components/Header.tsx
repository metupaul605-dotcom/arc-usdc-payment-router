/**
 * Header — "Arc Pay Studio" brand bar with wallet connect + USDC balance chip.
 *
 * Dark theme: translucent slate-900 glass, indigo accent, green network badge.
 * On Arc Testnet, USDC is the native gas token — we show a single USDC balance
 * from the ERC-20 balanceOf view (6 decimals) and never read the native balance
 * separately (that would double-count the same pool).
 */
import { ConnectKitButton } from 'connectkit'
import { useAccount, useReadContract } from 'wagmi'
import { erc20Abi } from 'viem'
import { requireChain, getUsdc, buildAddressExplorerUrl } from '@/onchain-facts'
import { Amount, usdcDecimalsFor } from '@/onchain-money'
import { ExternalLink, Zap } from 'lucide-react'

const ARC_TESTNET_ID = 5042002
const chain = requireChain(ARC_TESTNET_ID)
const usdcFact = getUsdc(ARC_TESTNET_ID)!

const headerStyle: React.CSSProperties = {
  background: 'rgba(13, 17, 32, 0.85)',
  backdropFilter: 'blur(20px) saturate(160%)',
  WebkitBackdropFilter: 'blur(20px) saturate(160%)',
  borderBottom: '1px solid rgba(148, 163, 184, 0.10)',
}

export default function Header() {
  const { address, isConnected, chainId } = useAccount()
  const wrongChain = isConnected && chainId !== ARC_TESTNET_ID

  const { data: rawBalance, isLoading: balanceLoading } = useReadContract({
    address: usdcFact.address as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: ARC_TESTNET_ID,
    query: { enabled: !!address },
  })

  const formatted =
    rawBalance !== undefined
      ? Amount.fromRaw(rawBalance, usdcDecimalsFor(ARC_TESTNET_ID)).toFixed(2)
      : null

  return (
    <header className="sticky top-0 z-30 w-full px-4 py-3" style={headerStyle}>
      <div className="mx-auto flex max-w-md flex-wrap items-center justify-between gap-3 lg:max-w-5xl">

        {/* ── Brand ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="flex size-8 shrink-0 items-center justify-center rounded-lg shadow-lg"
            style={{ background: 'var(--accent)', boxShadow: '0 0 12px var(--accent-shadow)' }}
          >
            <Zap size={16} className="text-white" fill="white" />
          </div>
          <span
            className="display truncate text-base font-bold tracking-tight"
            style={{ color: 'var(--ink)' }}
          >
            Arc Pay Studio
          </span>

          {/* Network badge */}
          <span
            className="hidden shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold sm:flex"
            style={{
              background: wrongChain
                ? 'rgba(244,63,94,0.10)'
                : 'rgba(34,197,94,0.10)',
              borderColor: wrongChain
                ? 'rgba(244,63,94,0.25)'
                : 'rgba(34,197,94,0.25)',
              color: wrongChain ? 'var(--danger)' : 'var(--success)',
            }}
          >
            {!wrongChain && (
              <span
                className="size-1.5 rounded-full animate-pulse"
                style={{ background: 'var(--success)', flexShrink: 0 }}
              />
            )}
            {wrongChain ? 'Wrong Network' : chain.name}
          </span>
        </div>

        {/* ── Right controls ────────────────────────────────────── */}
        <div className="flex shrink-0 items-center gap-2">

          {/* USDC balance chip */}
          {isConnected && !wrongChain && (
            <a
              href={address ? buildAddressExplorerUrl(ARC_TESTNET_ID, address) : '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold tabular-nums transition-all hover:opacity-80"
              style={{
                background: 'rgba(30,41,59,0.70)',
                borderColor: 'rgba(148,163,184,0.15)',
                color: 'var(--ink-2)',
                textDecoration: 'none',
              }}
            >
              {/* USDC dot */}
              <span
                className="size-2 rounded-full shrink-0"
                style={{ background: '#2775ca' }}
              />
              <span>
                {balanceLoading || formatted === null ? (
                  <span
                    className="inline-block h-3 w-14 animate-pulse rounded"
                    style={{ background: 'rgba(148,163,184,0.15)' }}
                  />
                ) : (
                  <>{formatted}&nbsp;USDC</>
                )}
              </span>
              <ExternalLink size={10} style={{ color: 'var(--subtle)', flexShrink: 0 }} />
            </a>
          )}

          {/* ConnectKit wallet button */}
          <ConnectKitButton.Custom>
            {({ isConnected: ckConnected, show, address: ckAddr, truncatedAddress }) => (
              <button
                onClick={show}
                className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={
                  ckConnected
                    ? {
                        background: 'rgba(30,41,59,0.80)',
                        color: 'var(--ink)',
                        border: '1px solid rgba(148,163,184,0.18)',
                      }
                    : {
                        background: 'var(--accent)',
                        color: '#ffffff',
                        border: 'none',
                        boxShadow: '0 2px 14px var(--accent-shadow)',
                      }
                }
              >
                {ckConnected ? (
                  <>
                    <span
                      className="size-2 rounded-full shrink-0"
                      style={{ background: 'var(--success)' }}
                    />
                    {truncatedAddress ??
                      (ckAddr
                        ? `${ckAddr.slice(0, 6)}…${ckAddr.slice(-4)}`
                        : 'Connected')}
                  </>
                ) : (
                  'Connect Wallet'
                )}
              </button>
            )}
          </ConnectKitButton.Custom>
        </div>
      </div>
    </header>
  )
}
