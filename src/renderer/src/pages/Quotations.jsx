import { useState, useEffect } from 'react'
import { Plus, Search, FileText, ChevronRight, Loader2, Trash2, AlertCircle, Mail, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import EmailComposerModal from '../components/EmailComposerModal'

// ── Quotations ─────────────────────────────────────────────────────────────

// Status styles identical to invoice
const STATUS_STYLES = {
  'Draft':    'bg-gray-100 text-gray-600',
  'Sent':     'bg-blue-100 text-blue-700',
  'Accepted': 'bg-green-100 text-green-700',
  'Rejected': 'bg-red-100 text-red-700',
  'Invoiced': 'bg-purple-100 text-purple-700'
}

export default function Quotations() {
  const [quotations, setQuotations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [toast, setToast] = useState({ show: false, message: '' })
  const navigate = useNavigate()

  useEffect(() => {
    fetchQuotations()
  }, [])

  const fetchQuotations = async () => {
    try {
      setLoading(true)
      const data = await window.api.quotations.list()
      setQuotations(data)
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const executeDelete = async () => {
    if (!confirmDelete) return
    const no = confirmDelete.quotation_no
    
    setConfirmDelete(null)
    setDeletingId(no)
    
    try {
      await window.api.quotations.delete(no)
      await fetchQuotations()
    } catch (err) {
      console.error(err)
      setToast({ show: true, message: err.message })
    } finally {
      setDeletingId(null)
    }
  }

  // ── Render Helpers ──────────────────────────────────────────────────────────

  const formatAmount = (amt) => {
    return new Intl.NumberFormat('en-MY', {
      style: 'currency', currency: 'MYR'
    }).format(amt)
  }

  const parseDate = (dStr) => {
    if (!dStr) return null
    const parts = dStr.split('/')
    if (parts.length === 3) {
      return new Date(parts[2], parts[1] - 1, parts[0])
    }
    return new Date(dStr)
  }

  // Filter 
  const filtered = quotations.filter(q => 
    q.quotation_no?.toLowerCase().includes(search.toLowerCase()) || 
    q.customer?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col h-full bg-bg pb-8">
      
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="px-10 pt-10 pb-6 shrink-0 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold text-ink">Quotations</h1>
          <p className="text-[15px] text-ink-muted mt-2">
            Create, track and manage your business proposals
          </p>
        </div>
        <div className="flex items-center gap-3">
          {selectedIds.length > 0 && (
            <button
              onClick={() => setShowEmailModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-100/50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl shadow-sm transition-all"
            >
              <Mail size={18} />
              Email Selected ({selectedIds.length})
            </button>
          )}
          <button 
            onClick={() => navigate('/quotations/new')}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-xl font-bold transition-colors shadow-sm"
          >
            <Plus size={18} />
            New Quotation
          </button>
        </div>
      </div>

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <div className="flex-1 px-10 min-h-0 flex flex-col">
        
        {/* Toolbar */}
        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" size={18} />
            <input
              type="text"
              placeholder="Search quotation or customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30 text-ink transition-all shadow-sm"
            />
          </div>
        </div>

        {/* List Card */}
        <div className="bg-white rounded-[20px] shadow-sm border border-border flex-1 min-h-0 overflow-hidden flex flex-col relative">
          
          {loading && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center">
              <Loader2 className="animate-spin text-accent" size={32}/>
            </div>
          )}

          <div className="overflow-auto flex-1 p-2">
            <div className="space-y-1.5">
              {/* Header row */}
              <div className="grid grid-cols-[40px_1fr_2fr_1fr_1.5fr_1fr_40px] gap-4 px-4 py-3 text-xs font-bold text-ink-muted uppercase tracking-wider sticky top-0 bg-white z-[5] border-b border-border mb-2">
                <div className="flex items-center justify-center">
                  {filtered.length > 0 && (
                    <input
                      type="checkbox"
                      checked={selectedIds.length > 0 && selectedIds.length === filtered.length}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedIds(filtered.map(q => q.quotation_no))
                        else setSelectedIds([])
                      }}
                      className="w-3.5 h-3.5 rounded border-gray-300 text-accent focus:ring-accent/30 cursor-pointer"
                    />
                  )}
                </div>
                <div>Quotation No</div>
                <div>Customer</div>
                <div>Date</div>
                <div className="text-right">Amount</div>
                <div className="text-center">Status</div>
                <div></div>
              </div>

              {/* Rows */}
              {filtered.map(q => {
                const isDraft = q.status === 'Draft'
                const d = parseDate(q.date)
                                return (
                  <div
                    key={q.quotation_no}
                    onClick={() => navigate(`/quotations/${q.quotation_no}`)}
                    className={`group grid grid-cols-[40px_1fr_2fr_1fr_1.5fr_1fr_40px] items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all border border-transparent ${selectedIds.includes(q.quotation_no) ? 'bg-accent/5 hover:bg-accent/10 border-accent/10' : 'hover:bg-accent-light/30 hover:border-accent/10'}`}
                  >
                    <div className="flex items-center justify-center" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(q.quotation_no)}
                        onChange={() => {
                          setSelectedIds(prev =>
                            prev.includes(q.quotation_no) ? prev.filter(id => id !== q.quotation_no) : [...prev, q.quotation_no]
                          )
                        }}
                        className="w-3.5 h-3.5 rounded border-gray-300 text-accent focus:ring-accent/30 cursor-pointer"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-ink">{q.quotation_no}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gray-50 border border-border flex items-center justify-center text-ink-muted flex-shrink-0">
                        <FileText size={16} />
                      </div>
                      <span className="font-semibold text-ink-2 truncate">{q.customer}</span>
                    </div>

                    <div>
                      <span className="text-[15px] font-medium text-ink-2">
                        {d ? format(d, 'dd MMM yyyy') : q.date}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="font-bold text-ink text-[15px]">
                        {formatAmount(q.total)}
                      </span>
                    </div>

                    <div className="flex justify-center">
                      <span className={`px-2.5 py-1 rounded-md text-[13px] font-bold ${STATUS_STYLES[q.status] || STATUS_STYLES.Draft}`}>
                        {q.status}
                      </span>
                    </div>

                    <div className="flex justify-end items-center gap-1 text-ink-muted opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setConfirmDelete(q)
                        }}
                        disabled={deletingId === q.quotation_no}
                        className="p-1.5 text-ink-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Delete Quotation"
                      >
                        {deletingId === q.quotation_no ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                      </button>
                      <button className="p-1.5 text-ink-muted hover:bg-gray-100 rounded-lg transition-colors">
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </div>
                )
              })}

              {filtered.length === 0 && !loading && (
                <div className="py-20 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4">
                    <FileText className="text-ink-muted" size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-ink">No Quotations Found</h3>
                  <p className="text-ink-muted mt-1 max-w-sm">
                    {search ? 'Try adjusting your search terms.' : 'Create your very first quotation by clicking the "New Quotation" button.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 pb-2 text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="text-red-600" size={24} />
              </div>
              <h3 className="text-lg font-bold text-ink mb-2">Delete Quotation</h3>
              <p className="text-sm text-ink-muted leading-relaxed">
                Are you sure you want to delete <br/>
                <strong className="text-ink">{confirmDelete.quotation_no}</strong>? <br/>
                This action cannot be undone.
              </p>
            </div>
            <div className="p-6 pt-5 flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-ink-2 rounded-xl font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeDelete}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-colors shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Composer Modal */}
      <EmailComposerModal 
        visible={showEmailModal}
        titleContext="Quotations"
        selectedIds={selectedIds}
        onClose={(success) => {
          setShowEmailModal(false)
          if (success) setSelectedIds([])
        }}
        fetchDataCallback={async (id) => await window.api.quotations.get(id)}
        exportPdfCallback={async (data, shouldOpen) => await window.api.quotations.exportPdf(data, shouldOpen)}
      />

      {/* Toast */}
      {toast.show && (
        <div className="fixed bottom-6 right-6 z-50 animate-[slideUp_0.3s_ease-out]">
          <div className="bg-ink text-white rounded-2xl shadow-2xl px-5 py-4 flex items-center gap-4 min-w-[320px]">
            <div className="w-9 h-9 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
              <FileText size={18} className="text-accent" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">{toast.message}</p>
            </div>
            <button onClick={() => setToast(t => ({...t, show: false}))} className="text-white/50 hover:text-white transition-colors shrink-0">
              <X size={16} />
            </button>
          </div>
        </div>
      )}
      <style>{`@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); }}`}</style>

    </div>
  )
}
