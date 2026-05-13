import { useState, useEffect } from 'react'
import { Plus, Search, Trash2, Edit2, Loader2, Save, X, Package, AlertCircle, ChevronDown, FileText } from 'lucide-react'

// ── Products ────────────────────────────────────────────────────────────────
const UOM_OPTS = ['PCS', 'SETS', 'BOOKS', 'UNIT', 'LOT', 'BOX', 'PKT', 'KG', 'ROLL', 'LTR', 'MTR']

export default function Products() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  const [search, setSearch] = useState('')
  
  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [toast, setToast] = useState({ show: false, message: '' })
  
  // Form state
  const [form, setForm] = useState({
    item_code: '',
    description: '',
    uom: '',
    qty: 1,
    unit_price: '',
    total_price: ''
  })

  // ── Handlers ──
  const handleUnitPriceChange = (val) => {
    setForm({ ...form, unit_price: val })
  }

  const handleTotalPriceChange = (val) => {
    setForm({ ...form, total_price: val })
  }

  const handleQtyChange = (val) => {
    setForm({ ...form, qty: val })
  }

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchProducts = async () => {
    try {
      setLoading(true)
      const data = await window.api.products.list()
      setProducts(data)
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleAdd = async () => {
    setForm({ item_code: '', description: '', uom: 'PCS', qty: 1, unit_price: '', total_price: '' })
    setEditingId(null)
    setShowModal(true)
  }

  const handleEdit = (p) => {
    const up = parseFloat(p.unit_price) || 0
    setForm({ 
      item_code: p.item_code || '', 
      description: p.description || '', 
      uom: p.uom || '', 
      qty: p.default_qty || 1,
      unit_price: p.unit_price || '',
      total_price: p.default_total || ''
    })
    setEditingId(p.id)
    setShowModal(true)
  }

  const refocusSearch = () => {
    setTimeout(() => {
      window.focus()
      document.getElementById('search-input')?.focus()
    }, 150)
  }

  const executeDelete = async () => {
    if (!confirmDelete) return
    const { id } = confirmDelete
    
    setConfirmDelete(null)
    setDeletingId(id)
    
    // Anti-lock: auto-unlock UI after 1 second even if backend DB is hanging
    const unlockTimeout = setTimeout(() => {
      setDeletingId(null)
      fetchProducts().then(refocusSearch)
    }, 1000)

    try {
      await window.api.products.delete(id)
    } catch (err) {
      console.error(err)
      if (err.message && !err.message.includes('database is locked')) {
        setToast({ show: true, message: err.message })
      }
    } finally {
      clearTimeout(unlockTimeout)
      setDeletingId(null)
      fetchProducts().then(refocusSearch)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.description) {
      setToast({ show: true, message: "Description is required." })
      return
    }
    setSaving(true)
    try {
      const payload = {
        id: editingId,
        item_code: form.item_code,
        description: form.description,
        uom: form.uom,
        unit_price: form.unit_price, // Treat as literal text
        default_qty: form.qty,
        default_total: form.total_price
      }
      await window.api.products.save(payload)
      setShowModal(false)
      fetchProducts().then(refocusSearch)
    } catch (err) {
      console.error(err)
      if (err.message && err.message.includes('UNIQUE constraint')) {
        setToast({ show: true, message: "该产品名称已存在，请换一个名称或修改现有条目。" })
      } else {
        setToast({ show: true, message: "Error saving: " + err.message })
      }
    } finally {
      setSaving(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const filtered = products.filter(p => 
    p.description?.toLowerCase().includes(search.toLowerCase()) || 
    p.item_code?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col h-full bg-bg pb-8">
      {/* Header */}
      <div className="px-10 pt-10 pb-6 shrink-0 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold text-ink flex items-center gap-3">
            <Package size={28} className="text-accent" />
            Products
          </h1>
          <p className="text-[15px] text-ink-muted mt-2">
            Manage your item library for quick invoicing
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-xl font-bold transition-colors shadow-sm"
        >
          <Plus size={18} />
          New Product
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 px-10 min-h-0 flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" size={18} />
            <input
              id="search-input"
              type="text"
              placeholder="Search by description or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30 text-ink transition-all shadow-sm"
              autoFocus
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-border shadow-sm flex-1 min-h-0 overflow-hidden flex flex-col relative">
          {loading && <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center"><Loader2 className="animate-spin text-accent" size={32}/></div>}
          
          <div className="overflow-auto flex-1 h-full rounded-2xl">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#f9fafb] sticky top-0 z-[5] shadow-sm">
                <tr>
                  <th className="px-5 py-4 text-xs font-semibold text-ink-muted uppercase tracking-wider border-b border-border w-[120px]">Item Code</th>
                  <th className="px-5 py-4 text-xs font-semibold text-ink-muted uppercase tracking-wider border-b border-border w-[350px]">Description</th>
                  <th className="px-5 py-4 text-xs font-semibold text-ink-muted uppercase tracking-wider border-b border-border w-[100px]">UOM</th>
                  <th className="px-5 py-4 text-xs font-semibold text-ink-muted uppercase tracking-wider border-b border-border text-right w-[80px]">Qty</th>
                  <th className="px-5 py-4 text-xs font-semibold text-ink-muted uppercase tracking-wider border-b border-border text-right w-[150px]">Unit Price</th>
                  <th className="px-5 py-4 text-xs font-semibold text-ink-muted uppercase tracking-wider border-b border-border text-right w-[150px]">Total Price</th>
                  <th className="px-5 py-4 text-xs font-semibold text-ink-muted uppercase tracking-wider border-b border-border text-right w-[100px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-accent-light/30 transition-colors group">
                    <td className="px-5 py-4">
                      {p.item_code ? (
                        <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-ink-2 text-xs font-mono font-medium">
                          {p.item_code}
                        </span>
                      ) : (
                        <span className="text-ink-muted text-sm">-</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-semibold text-ink text-[15px]">{p.description}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-ink-2">{p.uom || '-'}</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="font-mono text-sm text-ink-2">{p.default_qty || '1'}</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="font-mono text-sm font-semibold text-ink">
                        {p.unit_price === '-' ? '-' : (p.unit_price ? Number(p.unit_price).toLocaleString('en-US', {minimumFractionDigits: 2}) : '-')}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="font-mono text-[15px] font-bold text-ink">
                        {p.default_total ? Number(p.default_total).toLocaleString('en-US', {minimumFractionDigits: 2}) : '-'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleEdit(p)}
                          className="p-1.5 text-accent hover:bg-accent-light rounded-md"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => setConfirmDelete({ id: p.id, desc: p.description })}
                          className={`p-1.5 rounded-md ${deletingId === p.id ? 'text-ink-muted cursor-not-allowed' : 'text-red-500 hover:bg-red-50'}`}
                          title="Delete"
                          disabled={deletingId === p.id}
                        >
                          {deletingId === p.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && !loading && (
                  <tr>
                    <td colSpan="7" className="px-5 py-12 text-center text-ink-muted">
                      No products found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-[500px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-[#f9fafb]">
              <h2 className="text-xl font-bold text-ink">
                {editingId ? 'Edit Product' : 'Add Product'}
              </h2>
              <button 
                onClick={() => setShowModal(false)}
                className="p-2 text-ink-muted hover:bg-gray-200 rounded-lg transition-colors"
                title="Close"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5">
              
              <div>
                <label className="block text-sm font-bold text-ink-2 mb-1.5">Description<span className="text-red-500 ml-1">*</span></label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({...form, description: e.target.value})}
                  className="w-full px-4 py-2.5 bg-gray-50 border-0 rounded-xl text-ink font-medium focus:ring-2 focus:ring-accent resize-none h-20"
                  required
                  autoFocus
                />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-bold text-ink-2 mb-1.5">Item Code <span className="text-ink-muted font-normal">(Optional)</span></label>
                  <input
                    type="text"
                    value={form.item_code}
                    onChange={(e) => setForm({...form, item_code: e.target.value})}
                    className="w-full px-4 py-2.5 bg-gray-50 border-0 rounded-xl text-ink font-medium focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-[1.5]">
                  <label className="block text-sm font-bold text-ink-2 mb-1.5">Unit of Measure (UOM)</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={form.uom}
                      onChange={(e) => setForm({...form, uom: e.target.value})}
                      placeholder="e.g., PCS"
                      className="peer w-full pl-4 pr-10 py-2.5 bg-[#f5f5f7] hover:bg-[#ebebef] focus:bg-white border-0 rounded-xl text-ink font-bold focus:ring-2 focus:ring-accent/30 uppercase transition-all"
                    />
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none transition-transform peer-focus:rotate-180" />
                    
                    <div className="absolute top-full left-0 w-full mt-1 bg-white border border-border rounded-xl shadow-xl z-50 overflow-hidden hidden peer-focus:block">
                      <div className="max-h-48 overflow-y-auto py-1">
                        {UOM_OPTS.map(u => (
                          <div 
                            key={u} 
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setForm({...form, uom: u});
                              document.activeElement?.blur();
                            }} 
                            className="px-4 py-2.5 text-[13px] font-bold text-ink hover:bg-accent-light hover:text-accent cursor-pointer transition-colors"
                          >
                            {u}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex-[0.5]">
                  <label className="block text-sm font-bold text-ink-2 mb-1.5">Default Qty</label>
                  <input
                    type="text"
                    value={form.qty}
                    onChange={(e) => handleQtyChange(e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-50 border-0 rounded-xl text-ink font-mono font-medium focus:ring-2 focus:ring-accent text-center"
                  />
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="flex-1">
                  <label className="block text-sm font-bold text-ink-2 mb-1.5">Unit Price</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted">$</span>
                    <input
                      type="text"
                      value={form.unit_price}
                      onChange={(e) => handleUnitPriceChange(e.target.value)}
                      className="w-full pl-8 pr-4 py-2.5 bg-gray-50 border-0 rounded-xl text-ink font-mono font-medium focus:ring-2 focus:ring-accent"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-center pt-9 text-ink-muted font-bold">=</div>
                <div className="flex-1">
                  <label className="block text-sm font-bold text-ink-2 mb-1.5">Total Price</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted">$</span>
                    <input
                      type="text"
                      value={form.total_price}
                      onChange={(e) => handleTotalPriceChange(e.target.value)}
                      className="w-full pl-8 pr-4 py-2.5 bg-gray-50 border-0 rounded-xl text-ink font-mono font-medium focus:ring-2 focus:ring-accent"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-ink-2 rounded-xl font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-xl font-bold transition-colors shadow-sm disabled:opacity-50"
                >
                  {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  {saving ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 pb-2 text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="text-red-600" size={24} />
              </div>
              <h3 className="text-lg font-bold text-ink mb-2">Delete Product</h3>
              <p className="text-sm text-ink-muted leading-relaxed">
                Are you sure you want to delete <br/>
                <strong className="text-ink">{confirmDelete.desc}</strong>? <br/>
                This action cannot be undone.
              </p>
            </div>
            <div className="p-6 pt-5 flex gap-3">
              <button
                onClick={() => {
                  setConfirmDelete(null)
                  refocusSearch()
                }}
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
