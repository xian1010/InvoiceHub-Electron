import { useState, useEffect } from 'react'
import { Plus, Trash2, Loader2, CreditCard, X, FileText, FolderOpen } from 'lucide-react'
import { format } from 'date-fns'

// ── Delete Confirmation Modal ──────────────────────────────────────────────

function DeleteModal({ receipt, onConfirm, onCancel, deleting }) {
  return (
    <div className="fixed inset-0 bg-black/25 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[400px] p-6 animate-in fade-in zoom-in duration-200">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-ink">Delete Receipt?</h2>
            <p className="text-[15px] text-ink-muted mt-1">
              <span className="font-semibold text-accent">{receipt.payment_no}</span>
              {receipt.customer ? ` · ${receipt.customer}` : ''}
            </p>
          </div>
          <button onClick={onCancel} className="text-ink-muted hover:text-ink p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>
        <p className="text-[15px] text-ink-muted mb-6 leading-relaxed">
          Are you sure you want to delete this receipt? This action will permanently remove it from the records and cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="px-5 py-2.5 text-sm font-bold text-ink-2 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="px-5 py-2.5 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors shadow-sm shadow-red-200 flex items-center gap-2 disabled:opacity-50 min-w-[100px] justify-center"
          >
            {deleting ? <Loader2 size={16} className="animate-spin" /> : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Receipts (Payments) ────────────────────────────────────────────────────

export default function Receipts() {
  const [receipts, setReceipts] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  
  // New Payment Form State
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    payment_no: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    customer: '',
    amount: '',
    payment_method: 'Cash',
    ref: '',
    notes: ''
  })

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  
  const [toast, setToast] = useState({ show: false, message: '' })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [rData, cData, nextNo] = await Promise.all([
        window.api.receipts.list(),
        window.api.receipts.getCustomers(),
        window.api.getNextPaymentNo()
      ])
      setReceipts(rData)
      setCustomers(cData)
      setForm(f => ({ ...f, payment_no: nextNo }))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleClear = async () => {
    try {
      const nextNo = await window.api.getNextPaymentNo()
      setForm({
        payment_no: nextNo,
        date: format(new Date(), 'yyyy-MM-dd'),
        customer: '',
        amount: '',
        payment_method: 'Cash',
        ref: '',
        notes: ''
      })
    } catch (err) {
      console.error(err);
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.customer) {
      setToast({ show: true, message: "Please select a customer." })
      return
    }
    if (!form.amount || Number(form.amount) <= 0) {
      setToast({ show: true, message: "Please enter a valid amount." })
      return
    }
    
    setSaving(true)
    try {
      await window.api.receipts.save(form)
      await handleClear()
      // Refresh list
      const updatedList = await window.api.receipts.list()
      setReceipts(updatedList)
    } catch (err) {
      console.error(err)
      setToast({ show: true, message: err.message })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (receipt) => {
    setDeleteTarget(receipt)
  }

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return
    
    setDeleting(true)
    const targetNo = deleteTarget.payment_no
    
    try {
      await window.api.receipts.delete(targetNo)
      
      // Optimistic update
      setReceipts(prev => prev.filter(r => r.payment_no !== targetNo))
      setDeleteTarget(null)
      
      // Refresh next No in case the deleted one was the latest
      const nextNo = await window.api.getNextPaymentNo()
      setForm(f => ({ ...f, payment_no: nextNo }))
      
    } catch (err) {
      console.error('[Receipts] delete error:', err)
      setToast({ show: true, message: err.message })
    } finally {
      setDeleting(false)
    }
  }

  const fmtAmt = (amt) => {
    return Number(amt || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  // Segment colors based on Python UI matching
  const METHOD_COLORS = {
    'Cash': 'bg-[#F0FDF4] text-green-700 border-green-200',
    'Cheque': 'bg-[#EFF6FF] text-blue-700 border-blue-200',
    'Transfer': 'bg-[#FFF7ED] text-orange-700 border-orange-200'
  }

  return (
    <div className="flex flex-col h-full bg-bg pb-8">
      
      {/* Header */}
      <div className="px-10 pt-10 pb-6 shrink-0">
        <h1 className="text-3xl font-bold text-ink">New Receipt</h1>
        <p className="text-[15px] text-ink-muted mt-2">
          Enter the details of your payment receipt
        </p>
      </div>

      <div className="flex-1 px-10 min-h-0 flex flex-col lg:flex-row gap-6">
        
        {/* ── Form Card ─────────────────────────────────────────────────── */}
        <div className="w-full lg:w-[420px] bg-white rounded-2xl shadow-sm border border-border flex flex-col flex-none">
          <form onSubmit={handleSave} className="flex-1 overflow-auto p-8 space-y-5">
            
            {/* Receipt No */}
            <div>
              <label className="block text-[13px] font-bold text-ink mb-1.5">Receipt No.</label>
              <input
                type="text"
                value={form.payment_no}
                onChange={(e) => setForm({...form, payment_no: e.target.value})}
                className="w-full h-11 px-4 bg-[#f5f5f7] rounded-xl border-0 text-[15px] font-medium text-ink focus:ring-2 focus:ring-accent"
                required
              />
            </div>

            {/* Customer */}
            <div>
              <label className="block text-[13px] font-bold text-ink mb-1.5">Customer</label>
              <select
                value={form.customer}
                onChange={(e) => setForm({...form, customer: e.target.value})}
                className="w-full h-11 px-4 bg-[#f5f5f7] rounded-xl border-0 text-[15px] font-medium text-ink focus:ring-2 focus:ring-accent"
                required
              >
                <option value="" disabled>Select Customer...</option>
                {customers.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="block text-[13px] font-bold text-ink mb-1.5">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({...form, date: e.target.value})}
                className="w-full h-11 px-4 bg-[#f5f5f7] rounded-xl border-0 text-[15px] font-medium text-ink focus:ring-2 focus:ring-accent"
                required
              />
            </div>

            {/* Amount */}
            <div>
              <label className="block text-[13px] font-bold text-ink mb-1.5">Amount (RM)</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => setForm({...form, amount: e.target.value})}
                className="w-full h-11 px-4 bg-[#f5f5f7] rounded-xl border-0 text-[15px] font-medium text-ink focus:ring-2 focus:ring-accent"
                required
              />
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-[13px] font-bold text-ink mb-1.5">Payment Method</label>
              <div className="flex bg-[#f5f5f7] p-1 rounded-xl">
                {['Cash', 'Cheque', 'Transfer'].map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setForm({...form, payment_method: m})}
                    className={`flex-1 py-1.5 text-[13px] font-bold rounded-lg transition-colors ${
                      form.payment_method === m 
                        ? 'bg-accent text-white shadow-sm' 
                        : 'text-ink-muted hover:bg-gray-200'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Reference No */}
            <div>
              <label className="block text-[13px] font-bold text-ink mb-1.5">Reference No.</label>
              <input
                type="text"
                placeholder="Cheque no. / Transfer ID"
                value={form.ref}
                onChange={(e) => setForm({...form, ref: e.target.value})}
                className="w-full h-11 px-4 bg-[#f5f5f7] rounded-xl border-0 text-[15px] font-medium text-ink focus:ring-2 focus:ring-accent placeholder:text-ink-muted"
                required={form.payment_method !== 'Cash'}
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-[13px] font-bold text-ink mb-1.5">Notes (optional)</label>
              <input
                type="text"
                placeholder="Optional memo"
                value={form.notes}
                onChange={(e) => setForm({...form, notes: e.target.value})}
                className="w-full h-11 px-4 bg-[#f5f5f7] rounded-xl border-0 text-[15px] font-medium text-ink focus:ring-2 focus:ring-accent placeholder:text-ink-muted"
              />
            </div>

            <div className="pt-4 flex gap-3 pb-2">
              <button
                type="button"
                onClick={handleClear}
                className="flex-1 h-11 bg-[#f5f5f7] hover:bg-gray-200 text-ink-2 rounded-xl font-bold transition-colors"
              >
                Clear
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-[2] h-11 bg-accent hover:bg-accent-hover text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Save Receipt
              </button>
            </div>
          </form>
        </div>

        {/* ── List Card ─────────────────────────────────────────────────── */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-border flex flex-col min-h-0 relative">
          
          <div className="p-6 pb-4 border-b border-border flex-none flex justify-between items-center">
            <h2 className="text-[15px] font-bold text-ink flex items-center gap-2">
              <CreditCard size={18} className="text-accent" />
              Recent Receipts
            </h2>
          </div>

          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 size={32} className="animate-spin text-accent" />
              </div>
            ) : receipts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-ink-muted">
                <CreditCard size={48} className="mb-4 opacity-20" />
                <p>No receipts recorded yet.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#f9fafb] sticky top-0 z-[5] shadow-sm">
                  <tr>
                    <th className="px-5 py-3 text-[11px] font-extrabold text-ink-muted uppercase tracking-widest border-b border-border w-[120px]">Receipt No</th>
                    <th className="px-5 py-3 text-[11px] font-extrabold text-ink-muted uppercase tracking-widest border-b border-border w-[100px]">Date</th>
                    <th className="px-5 py-3 text-[11px] font-extrabold text-ink-muted uppercase tracking-widest border-b border-border">Customer</th>
                    <th className="px-5 py-3 text-[11px] font-extrabold text-ink-muted uppercase tracking-widest border-b border-border w-[100px]">Method</th>
                    <th className="px-5 py-3 text-[11px] font-extrabold text-ink-muted uppercase tracking-widest border-b border-border w-[120px]">Ref</th>
                    <th className="px-5 py-3 text-[11px] font-extrabold text-ink-muted uppercase tracking-widest border-b border-border text-right w-[120px]">Amount</th>
                    <th className="px-5 py-3 text-[11px] font-extrabold text-ink-muted uppercase tracking-widest border-b border-border w-[60px]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {receipts.map(r => (
                    <tr key={r.id} className="hover:bg-accent-light/30 transition-colors group">
                      <td className="px-5 py-3 text-[13px] font-bold text-ink">{r.payment_no}</td>
                      <td className="px-5 py-3 text-[13px] text-ink-2">{r.date}</td>
                      <td className="px-5 py-3 text-[14px] font-semibold text-ink-2 truncate max-w-[200px]" title={r.customer}>{r.customer}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold border ${METHOD_COLORS[r.payment_method] || METHOD_COLORS.Cash}`}>
                          {r.payment_method}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-[13px] text-ink-muted truncate max-w-[120px]" title={r.ref}>{r.ref || '-'}</td>
                      <td className="px-5 py-3 text-[14px] font-bold text-ink text-right font-mono">{fmtAmt(r.amount)}</td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => handleDelete(r)}
                          className="p-1.5 text-ink-muted hover:text-red-500 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete Receipt"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>

      {/* Delete Modal */}
      {deleteTarget && (
        <DeleteModal
          receipt={deleteTarget}
          deleting={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Toast */}
      {toast.show && (
        <div className="fixed bottom-6 right-6 z-50 animate-[slideUp_0.3s_ease-out]">
          <div className="bg-ink text-white rounded-2xl shadow-2xl px-5 py-4 flex items-center gap-4 min-w-[320px]">
            <div className="w-9 h-9 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
              <FileText size={18} className="text-accent" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">{toast.message}</p>
            </div>
            <button onClick={() => setToast(t => ({...t, show: false}))} className="text-white/50 hover:text-white"><X size={16} /></button>
          </div>
          <style>{`@keyframes slideUp { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) }}`}</style>
        </div>
      )}
    </div>
  )
}
