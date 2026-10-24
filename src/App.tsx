import Header from './components/Header'
import PaymentForm from './components/PaymentForm'
import PaymentHistory from './components/PaymentHistory'

export default function App() {
  return (
    <div className="min-h-dvh" style={{ background: 'var(--bg-gradient)' }}>
      <Header />

      <main className="mx-auto max-w-5xl px-4 py-8 pb-24 sm:px-6">

        {/* ── Page heading ───────────────────────────────────────── */}
        <div className="mx-auto mb-6 max-w-md lg:max-w-none">
          <h1
            className="display text-2xl font-bold"
            style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}
          >
            Send USDC Invoice
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            Transfer testnet USDC seamlessly on Arc Network.
          </p>
        </div>

        {/* ── Stacked single-column on mobile, two-column on lg ──── */}
        <div className="mx-auto flex max-w-md flex-col gap-5 lg:max-w-none lg:grid lg:grid-cols-12 lg:gap-6">

          {/* Left: Payment Form */}
          <div className="lg:col-span-5">
            <PaymentForm />
          </div>

          {/* Right: Payment History */}
          <div className="lg:col-span-7">
            <div className="mb-3">
              <h2
                className="display text-lg font-bold"
                style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}
              >
                Recent History
              </h2>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
                Live on-chain records
              </p>
            </div>
            <PaymentHistory />
          </div>

        </div>
      </main>
    </div>
  )
}
