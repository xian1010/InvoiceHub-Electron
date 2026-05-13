import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_STYLE = {
  Paid:    'bg-green-50  text-green-700',
  Pending: 'bg-blue-50   text-blue-700',
  Overdue: 'bg-red-50    text-red-700',
  Draft:   'bg-gray-50   text-gray-500'
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[status] ?? STATUS_STYLE.Draft}`}>
      {status}
    </span>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ title, value, sub, iconBg, iconFg, icon }) {
  return (
    <div className="bg-card rounded-card p-[18px] flex items-start justify-between gap-3">
      <div>
        <p className="text-xs text-ink-muted mb-1">{title}</p>
        <p className="text-lg font-bold text-ink leading-tight">{value}</p>
        <p className="text-[11px] mt-1" style={{ color: iconFg }}>{sub}</p>
      </div>
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-base font-bold"
        style={{ background: iconBg, color: iconFg }}
      >
        {icon}
      </div>
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats,   setStats]   = useState(null)
  const [recent,  setRecent]  = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [s, r] = await Promise.all([
          window.api.getDashboardStats(),
          window.api.getRecentInvoices(8)
        ])
        setStats(s)
        setRecent(r)
      } catch (err) {
        console.error('[Dashboard] load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const fmt = (n) =>
    `RM ${Number(n || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div className="min-h-full bg-bg px-10 py-7">

      {/* Header */}
      <div className="mb-5">
        <h1 className="text-[28px] font-bold text-ink">Dashboard</h1>
        <p className="text-sm text-ink-muted mt-0.5">Overview of your invoicing activity</p>
      </div>

      {/* Stat cards — 5 across */}
      {loading ? (
        <div className="grid grid-cols-5 gap-4 mb-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-card rounded-card h-[90px] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-4 mb-5">
          <StatCard
            title="Total Revenue"   value={fmt(stats?.revenue)}
            sub="↑ Paid invoices"   icon="$"
            iconBg="#DCFCE7"        iconFg="#16A34A"
          />
          <StatCard
            title="Pending"         value={fmt(stats?.pending)}
            sub={`${stats?.pendingCnt ?? 0} invoices`} icon="○"
            iconBg="#DBEAFE"        iconFg="#3B82F6"
          />
          <StatCard
            title="Overdue"         value={fmt(stats?.overdue)}
            sub={`${stats?.overdueCnt ?? 0} invoice(s)`} icon="!"
            iconBg="#FEE2E2"        iconFg="#EF4444"
          />
          <StatCard
            title="Total Invoices"  value={String(stats?.totalCnt ?? 0)}
            sub="All time"          icon="≡"
            iconBg="#F3E8FF"        iconFg="#9333EA"
          />
          <StatCard
            title="Total Paid (Receipts)" value={fmt(stats?.totalPaid)}
            sub="Cash received"     icon="✓"
            iconBg="#FEF3C7"        iconFg="#D97706"
          />
        </div>
      )}

      {/* Recent Invoices card */}
      <div className="bg-card rounded-card overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <h2 className="font-bold text-ink text-[15px]">Recent Invoices</h2>
          <button
            onClick={() => navigate('/invoices')}
            className="text-xs text-accent hover:underline"
          >
            View all →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-t border-border">
                {['INVOICE', 'CLIENT', 'DATE', 'AMOUNT', 'STATUS'].map(h => (
                  <th
                    key={h}
                    className={`px-5 py-2.5 text-[10px] font-bold tracking-widest text-ink-muted bg-gray-50
                      ${h === 'AMOUNT' ? 'text-right' : h === 'STATUS' ? 'text-center' : 'text-left'}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-ink-muted text-sm">
                    No invoices yet
                  </td>
                </tr>
              )}
              {recent.map((row) => (
                <tr
                  key={row.invoice_no}
                  className="border-t border-border hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/invoices?edit=${row.invoice_no}`)}
                >
                  <td className="px-5 py-3 font-medium text-accent">{row.invoice_no}</td>
                  <td className="px-5 py-3 text-ink-2">{row.customer ?? '—'}</td>
                  <td className="px-5 py-3 text-ink-muted">{row.date ?? '—'}</td>
                  <td className="px-5 py-3 text-right font-mono text-ink">
                    {fmt(row.total)}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <StatusBadge status={row.status ?? 'Pending'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
