import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Pencil, Trash2, X, ChevronDown } from 'lucide-react'
import EmailComposerModal from '../components/EmailComposerModal'

// ── Design constants ──────────────────────────────────────────────────────────

const STATUS_STYLE = {
  Paid:    'bg-green-50  text-green-700  ring-green-100',
  Pending: 'bg-blue-50   text-blue-700   ring-blue-100',
  Overdue: 'bg-red-50    text-red-700    ring-red-100',
  Draft:   'bg-gray-100  text-gray-500   ring-gray-200'
}

const STATUS_DOT = {
  Paid:    'bg-green-500',
  Pending: 'bg-blue-500',
  Overdue: 'bg-red-500',
  Draft:   'bg-gray-400'
}

const ALL_STATUSES = ['Paid', 'Pending', 'Overdue', 'Draft']
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

function DeleteModal({ invoice, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/25 backdrop-blur-[2px] flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-[400px] p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-ink">Delete Invoice?</h2>
            <p className="text-sm text-ink-muted mt-1">
              <span className="font-medium text-ink">{invoice.invoice_no}</span>
              {invoice.customer ? ` · ${invoice.customer}` : ''}
            </p>
          </div>
          <button onClick={onCancel} className="text-ink-muted hover:text-ink p-0.5">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-ink-muted mb-5">
          This will permanently delete the invoice and all its line items. This action cannot be undone.
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

export default function Invoices() {
  const navigate = useNavigate()
  const searchRef = useRef(null)

  const [invoices,     setInvoices]     = useState([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [activeTab,    setActiveTab]    = useState('All')
  const [deleteTarget, setDeleteTarget] = useState(null)  // invoice object
  const [deleting,     setDeleting]     = useState(false)
  const [selectedIds,  setSelectedIds]  = useState([])
  const [showEmailModal, setShowEmailModal] = useState(false)

  // ── Data loading ────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await window.api.invoices.list()
      setInvoices(rows)
    } catch (err) {
      console.error('[Invoices] load error:', err)
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

  const filtered = invoices.filter((inv) => {
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      inv.invoice_no.toLowerCase().includes(q) ||
      (inv.customer ?? '').toLowerCase().includes(q) ||
      (inv.acc_code  ?? '').toLowerCase().includes(q)
    const matchTab = activeTab === 'All' || (inv.status ?? 'Pending') === activeTab
    return matchSearch && matchTab
  })

  // ── Selection Handlers ──────────────────────────────────────────────────────

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filtered.map(inv => inv.invoice_no))
    } else {
      setSelectedIds([])
    }
  }

  const handleSelectRow = (invoice_no) => {
    setSelectedIds(prev => 
      prev.includes(invoice_no) 
        ? prev.filter(id => id !== invoice_no)
        : [...prev, invoice_no]
    )
  }

  // ── Stat counts ─────────────────────────────────────────────────────────────

  const counts = ALL_STATUSES.reduce((acc, s) => {
    acc[s] = invoices.filter(i => (i.status ?? 'Pending') === s).length
    return acc
  }, {})

  // ── Delete handlers ─────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    try {
      await window.api.invoices.delete(deleteTarget.invoice_no)
      setInvoices(prev => prev.filter(i => i.invoice_no !== deleteTarget.invoice_no))
      setDeleteTarget(null)
    } catch (err) {
      console.error('[Invoices] delete error:', err)
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
          <h1 className="text-[26px] font-bold text-ink leading-tight">Invoices</h1>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-sm text-ink-muted">{invoices.length} total</span>
            {counts.Paid    > 0 && <StatPill label="paid"    count={counts.Paid}    color="bg-green-50 text-green-700" />}
            {counts.Pending > 0 && <StatPill label="pending" count={counts.Pending} color="bg-blue-50 text-blue-700" />}
            {counts.Overdue > 0 && <StatPill label="overdue" count={counts.Overdue} color="bg-red-50 text-red-700" />}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {selectedIds.length > 0 && (
            <button
              onClick={() => setShowEmailModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-border hover:bg-gray-50 text-ink font-semibold rounded-xl shadow-sm transition-all"
            >
              <svg xmlns="http://www.lucide.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
              Email Selected ({selectedIds.length})
            </button>
          )}
          <button
            onClick={() => navigate('/invoices/new')}
            className="flex items-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
          >
            <Plus size={15} />
            New Invoice
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
            placeholder="Search invoice or client…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent placeholder:text-ink-muted transition"
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
          <div className="grid grid-cols-[36px_150px_1fr_120px_150px_110px_68px] px-5 py-3 border-b border-border bg-gray-50/80 items-center">
            
            <div className="flex justify-center -ml-1">
              <input 
                type="checkbox"
                checked={filtered.length > 0 && selectedIds.length === filtered.length}
                onChange={handleSelectAll}
                className="w-3.5 h-3.5 rounded border-gray-300 text-accent focus:ring-accent/30 cursor-pointer"
              />
            </div>

            {['INVOICE', 'CLIENT', 'DATE', 'AMOUNT', 'STATUS', ''].map((h) => (
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
                  <div key={i} className="grid grid-cols-[150px_1fr_120px_150px_110px_68px] px-5 py-4 border-b border-border/60">
                    {[150, 220, 90, 100, 80, 0].map((w, j) => (
                      <div key={j} className={`h-3.5 rounded bg-gray-100 animate-pulse ${j === 3 ? 'ml-auto' : ''}`}
                           style={{ width: w || 0, opacity: w ? 1 : 0 }} />
                    ))}
                  </div>
                ))}
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
                  <Search size={22} className="text-ink-muted" />
                </div>
                <p className="text-sm font-medium text-ink">No invoices found</p>
                <p className="text-xs text-ink-muted mt-1">
                  {search ? `No results for "${search}"` : 'Create your first invoice'}
                </p>
                {!search && (
                  <button
                    onClick={() => navigate('/invoices/new')}
                    className="mt-4 px-4 py-2 text-sm font-semibold bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors"
                  >
                    + New Invoice
                  </button>
                )}
              </div>
            )}

            {!loading && filtered.map((inv) => {
              const checked = selectedIds.includes(inv.invoice_no)
              return (
              <div
                key={inv.invoice_no}
                className={`grid grid-cols-[36px_150px_1fr_120px_150px_110px_68px] items-center px-5 py-3.5 border-b border-border/60 cursor-pointer group transition-colors
                  ${checked ? 'bg-accent/5 hover:bg-accent/10' : 'hover:bg-gray-50/80'}
                `}
                onClick={() => navigate(`/invoices/${inv.invoice_no}`)}
              >
                {/* Checkbox */}
                <div 
                  className="flex justify-center -ml-1 h-full items-center" 
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSelectRow(inv.invoice_no)
                  }}
                >
                  <input 
                    type="checkbox"
                    checked={checked}
                    onChange={() => {}} // handled by parent div onClick
                    className="w-3.5 h-3.5 rounded border-gray-300 text-accent focus:ring-accent/30 cursor-pointer"
                  />
                </div>

                {/* Invoice No */}
                <div className="font-semibold text-sm text-accent truncate pr-2">
                  {inv.invoice_no}
                </div>

                {/* Client */}
                <div className="min-w-0 pr-4">
                  <p className="text-sm text-ink truncate">{inv.customer || '—'}</p>
                  {inv.acc_code && (
                    <p className="text-[11px] text-ink-muted truncate">{inv.acc_code}</p>
                  )}
                </div>

                {/* Date */}
                <div className="text-sm text-ink-muted">{inv.date || '—'}</div>

                {/* Amount */}
                <div className="text-sm font-medium text-ink text-right tabular-nums">
                  {fmtMoney(inv.total)}
                </div>

                {/* Status */}
                <div className="flex justify-center">
                  <StatusBadge status={inv.status ?? 'Pending'} />
                </div>

                {/* Actions — visible on row hover */}
                <div
                  className={`flex items-center justify-end gap-1 transition-opacity ${checked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    title="Edit"
                    onClick={() => navigate(`/invoices/${inv.invoice_no}`)}
                    className="p-1.5 rounded-lg text-ink-muted hover:text-accent hover:bg-accent-light transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    title="Delete"
                    onClick={() => setDeleteTarget(inv)}
                    className="p-1.5 rounded-lg text-ink-muted hover:text-danger hover:bg-danger-light transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )})}
          </div>

          {/* Footer row count */}
          {!loading && filtered.length > 0 && (
            <div className="px-5 py-2.5 border-t border-border bg-gray-50/60 text-xs text-ink-muted">
              {filtered.length === invoices.length
                ? `${invoices.length} invoice${invoices.length !== 1 ? 's' : ''}`
                : `${filtered.length} of ${invoices.length} invoices`}
            </div>
          )}
        </div>
      </div>

      {/* ── Delete confirmation modal ────────────────────────────────────────── */}
      {deleteTarget && (
        <DeleteModal
          invoice={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* ── Email Composer Modal ───────────────────────────────────────────── */}
      <EmailComposerModal 
        visible={showEmailModal}
        titleContext="Invoices"
        selectedIds={selectedIds}
        onClose={(success) => {
          setShowEmailModal(false)
          if (success) {
            setSelectedIds([])
          }
        }}
        fetchDataCallback={async (id) => await window.api.invoices.get(id)}
        exportPdfCallback={async (data, shouldOpen) => await window.api.invoices.exportPdf(data, shouldOpen)}
      />

    </div>
  )
}
