import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Pencil, Trash2, X, FileText } from 'lucide-react'

// ── Design constants ──────────────────────────────────────────────────────────

const STATUS_STYLE = {
  Issued:  'bg-red-50    text-red-700    ring-red-100',
  Pending: 'bg-amber-50  text-amber-700  ring-amber-100',
  Void:    'bg-gray-100  text-gray-500   ring-gray-200',
  Draft:   'bg-gray-100  text-gray-500   ring-gray-200'
}

const STATUS_DOT = {
  Issued:  'bg-red-500',
  Pending: 'bg-amber-500',
  Void:    'bg-gray-400',
  Draft:   'bg-gray-400'
}

const ALL_STATUSES = ['Issued', 'Pending', 'Void', 'Draft']
const TABS = ['All', ...ALL_STATUSES]

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtMoney = (n) =>
  `RM ${Number(n || 0).toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.Draft
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ${s}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status] ?? STATUS_DOT.Draft}`} />
      {status ?? 'Draft'}
    </span>
  )
}

function StatPill({ label, count, color }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${color}`}>
      {count} {label}
    </span>
  )
}

function DeleteModal({ cn, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/25 backdrop-blur-[2px] flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-[400px] p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-ink">Delete Credit Note?</h2>
            <p className="text-sm text-ink-muted mt-1">
              <span className="font-medium text-ink">{cn.cn_no}</span>
              {cn.customer ? ` · ${cn.customer}` : ''}
            </p>
          </div>
          <button onClick={onCancel} className="text-ink-muted hover:text-ink p-0.5">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-ink-muted mb-5">
          This will permanently delete this credit note and all its line items. This action cannot be undone.
        </p>
        <div className="flex gap-2.5 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-ink-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-danger hover:bg-red-600 rounded-lg transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CreditNotes() {
  const navigate = useNavigate()
  const searchRef = useRef(null)

  const [creditNotes,   setCreditNotes]   = useState([])
  const [loading,       setLoading]       = useState(true)
  const [search,        setSearch]        = useState('')
  const [activeTab,     setActiveTab]     = useState('All')
  const [deleteTarget,  setDeleteTarget]  = useState(null)
  const [deleting,      setDeleting]      = useState(false)

  // ── Data loading ────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await window.api.creditNotes.list()
      setCreditNotes(rows)
    } catch (err) {
      console.error('[CreditNotes] load error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Keyboard shortcut: Cmd/Ctrl+F focuses search ────────────────────────────

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── Client-side filtering ───────────────────────────────────────────────────

  const filtered = creditNotes.filter((cn) => {
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      cn.cn_no.toLowerCase().includes(q) ||
      (cn.customer ?? '').toLowerCase().includes(q) ||
      (cn.acc_code  ?? '').toLowerCase().includes(q) ||
      (cn.linked_invoice ?? '').toLowerCase().includes(q)
    const matchTab = activeTab === 'All' || (cn.status ?? 'Pending') === activeTab
    return matchSearch && matchTab
  })

  // ── Stat counts ─────────────────────────────────────────────────────────────

  const counts = ALL_STATUSES.reduce((acc, s) => {
    acc[s] = creditNotes.filter(i => (i.status ?? 'Pending') === s).length
    return acc
  }, {})

  // ── Delete handlers ─────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    try {
      await window.api.creditNotes.delete(deleteTarget.cn_no)
      setCreditNotes(prev => prev.filter(i => i.cn_no !== deleteTarget.cn_no))
      setDeleteTarget(null)
    } catch (err) {
      console.error('[CreditNotes] delete error:', err)
    } finally {
      setDeleting(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-bg">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="px-8 pt-7 pb-0 flex items-start justify-between">
        <div>
          <h1 className="text-[26px] font-bold text-ink leading-tight">Credit Notes</h1>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-sm text-ink-muted">{creditNotes.length} total</span>
            {counts.Issued  > 0 && <StatPill label="issued"  count={counts.Issued}  color="bg-red-50 text-red-700" />}
            {counts.Pending > 0 && <StatPill label="pending" count={counts.Pending} color="bg-amber-50 text-amber-700" />}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/credit-notes/new')}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-700 hover:bg-red-800 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
          >
            <Plus size={15} />
            New Credit Note
          </button>
        </div>
      </div>

      {/* ── Toolbar: search + tabs ─────────────────────────────────────────── */}
      <div className="px-8 pt-4 pb-3 flex items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search CN or client…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700/30 focus:border-red-700 placeholder:text-ink-muted transition"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Status tabs */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activeTab === tab
                  ? 'bg-white text-ink shadow-sm'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              {tab}
              {tab !== 'All' && counts[tab] > 0 && (
                <span className="ml-1.5 text-[10px] opacity-70">{counts[tab]}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table card ────────────────────────────────────────────────────────── */}
      <div className="px-8 pb-8 flex-1 overflow-hidden">
        <div className="bg-white rounded-2xl border border-border h-full flex flex-col overflow-hidden shadow-sm">

          {/* Column headers */}
          <div className="grid grid-cols-[140px_1fr_120px_140px_140px_110px_68px] px-5 py-3 border-b border-border bg-gray-50/80 items-center">
            {['CN NO', 'CLIENT', 'DATE', 'LINKED INV', 'AMOUNT', 'STATUS', ''].map((h) => (
              <div
                key={h}
                className={`text-[10px] font-bold tracking-widest text-ink-muted select-none
                  ${h === 'AMOUNT' ? 'text-right' : h === 'STATUS' ? 'text-center' : ''}`}
              >
                {h}
              </div>
            ))}
          </div>

          {/* Rows */}
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="flex flex-col gap-0">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="grid grid-cols-[140px_1fr_120px_140px_140px_110px_68px] px-5 py-4 border-b border-border/60">
                    {[120, 200, 90, 100, 100, 80, 0].map((w, j) => (
                      <div key={j} className={`h-3.5 rounded bg-gray-100 animate-pulse ${j === 4 ? 'ml-auto' : ''}`}
                           style={{ width: w || 0, opacity: w ? 1 : 0 }} />
                    ))}
                  </div>
                ))}
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mb-3">
                  <FileText size={22} className="text-red-400" />
                </div>
                <p className="text-sm font-medium text-ink">No credit notes found</p>
                <p className="text-xs text-ink-muted mt-1">
                  {search ? `No results for "${search}"` : 'Create your first credit note'}
                </p>
                {!search && (
                  <button
                    onClick={() => navigate('/credit-notes/new')}
                    className="mt-4 px-4 py-2 text-sm font-semibold bg-red-700 hover:bg-red-800 text-white rounded-lg transition-colors"
                  >
                    + New Credit Note
                  </button>
                )}
              </div>
            )}

            {!loading && filtered.map((cn) => (
              <div
                key={cn.cn_no}
                className="grid grid-cols-[140px_1fr_120px_140px_140px_110px_68px] items-center px-5 py-3.5 border-b border-border/60 cursor-pointer group hover:bg-gray-50/80 transition-colors"
                onClick={() => navigate(`/credit-notes/${cn.cn_no}`)}
              >
                {/* CN No */}
                <div className="font-semibold text-sm text-red-700 truncate pr-2">
                  {cn.cn_no}
                </div>

                {/* Client */}
                <div className="min-w-0 pr-4">
                  <p className="text-sm text-ink truncate">{cn.customer || '—'}</p>
                  {cn.acc_code && (
                    <p className="text-[11px] text-ink-muted truncate">{cn.acc_code}</p>
                  )}
                </div>

                {/* Date */}
                <div className="text-sm text-ink-muted">{cn.date || '—'}</div>

                {/* Linked Invoice */}
                <div className="text-sm text-ink-muted font-mono">
                  {cn.linked_invoice || '—'}
                </div>

                {/* Amount */}
                <div className="text-sm font-medium text-red-700 text-right tabular-nums">
                  ({fmtMoney(cn.total)})
                </div>

                {/* Status */}
                <div className="flex justify-center">
                  <StatusBadge status={cn.status ?? 'Pending'} />
                </div>

                {/* Actions — visible on row hover */}
                <div
                  className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    title="Edit"
                    onClick={() => navigate(`/credit-notes/${cn.cn_no}`)}
                    className="p-1.5 rounded-lg text-ink-muted hover:text-red-700 hover:bg-red-50 transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    title="Delete"
                    onClick={() => setDeleteTarget(cn)}
                    className="p-1.5 rounded-lg text-ink-muted hover:text-danger hover:bg-danger-light transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Footer row count */}
          {!loading && filtered.length > 0 && (
            <div className="px-5 py-2.5 border-t border-border bg-gray-50/60 text-xs text-ink-muted">
              {filtered.length === creditNotes.length
                ? `${creditNotes.length} credit note${creditNotes.length !== 1 ? 's' : ''}`
                : `${filtered.length} of ${creditNotes.length} credit notes`}
            </div>
          )}
        </div>
      </div>

      {/* ── Delete confirmation modal ────────────────────────────────────────── */}
      {deleteTarget && (
        <DeleteModal
          cn={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

    </div>
  )
}
