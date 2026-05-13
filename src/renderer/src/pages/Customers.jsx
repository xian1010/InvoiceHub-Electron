import { useState, useEffect } from 'react'
import { Plus, Search, Trash2, Edit2, Loader2, Save, X, AlertCircle, FileText } from 'lucide-react'

// ── Customers ───────────────────────────────────────────────────────────────

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  const [search, setSearch] = useState('')
  
  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  
  // Delete State
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  
  const [toast, setToast] = useState({ show: false, message: '' })

  // Form state
  const [form, setForm] = useState({
    acc_code: '',
    name: '',
    address: '',
    tel: '',
    attn: ''
  })

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchCustomers = async () => {
    try {
      setLoading(true)
      const data = await window.api.customers.list()
      setCustomers(data)
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomers()
  }, [])

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleAdd = async () => {
    try {
      const nextCode = await window.api.customers.nextCode()
      setForm({ acc_code: nextCode, name: '', address: '', tel: '', attn: '' })
      setEditingId(null)
      setShowModal(true)
    } catch (err) {
      console.error(err)
      setToast({ show: true, message: "Failed to get next code" })
    }
  }

  const handleEdit = (c) => {
    setForm({ ...c })
    setEditingId(c.id)
    setShowModal(true)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    const { id, name } = deleteTarget
    setDeleteTarget(null)
    setDeletingId(id)
    try {
      await window.api.customers.delete(id)
      fetchCustomers()
    } catch (err) {
      setToast({ show: true, message: err.message })
    } finally {
      setDeletingId(null)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name || !form.acc_code) {
      setToast({ show: true, message: "Account code and Name are required." })
      return
    }
    setSaving(true)
    try {
      await window.api.customers.save({ ...form, id: editingId })
      setShowModal(false)
      fetchCustomers()
    } catch (err) {
      console.error(err)
      setToast({ show: true, message: "Error saving: " + err.message })
    } finally {
      setSaving(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const filtered = customers.filter(c => 
    c.name?.toLowerCase().includes(search.toLowerCase()) || 
    c.acc_code?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col h-full bg-bg pb-8">
      {/* Header */}
      <div className="px-10 pt-10 pb-6 shrink-0 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold text-ink">Customers</h1>
          <p className="text-[15px] text-ink-muted mt-2">
            Manage your client directory
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-xl font-bold transition-colors shadow-sm"
        >
          <Plus size={18} />
          New Customer
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 px-10 min-h-0 flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" size={18} />
            <input
              type="text"
              placeholder="Search by name or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30 text-ink transition-all shadow-sm"
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
                  <th className="px-5 py-4 text-xs font-semibold text-ink-muted uppercase tracking-wider border-b border-border w-[120px]">Acc Code</th>
                  <th className="px-5 py-4 text-xs font-semibold text-ink-muted uppercase tracking-wider border-b border-border w-[240px]">Name</th>
                  <th className="px-5 py-4 text-xs font-semibold text-ink-muted uppercase tracking-wider border-b border-border w-[150px]">Tel / Attn</th>
                  <th className="px-5 py-4 text-xs font-semibold text-ink-muted uppercase tracking-wider border-b border-border text-left">Address</th>
                  <th className="px-5 py-4 text-xs font-semibold text-ink-muted uppercase tracking-wider border-b border-border text-right w-[100px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-accent-light/30 transition-colors group">
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-ink-2 text-xs font-mono font-medium">
                        {c.acc_code}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-semibold text-ink text-[15px]">{c.name}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm text-ink-2">{c.tel || '-'}</span>
                        <span className="text-xs text-ink-muted mt-0.5">{c.attn || '-'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-ink-2 line-clamp-2" title={c.address}>
                        {c.address ? c.address.replace(/\\n/g, ', ') : '-'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleEdit(c)}
                          className="p-1.5 text-accent hover:bg-accent-light rounded-md"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => setDeleteTarget({ id: c.id, name: c.name })}
                          className={`p-1.5 rounded-md ${deletingId === c.id ? 'text-ink-muted cursor-not-allowed' : 'text-red-500 hover:bg-red-50'}`}
                          title="Delete"
                          disabled={deletingId === c.id}
                        >
                          {deletingId === c.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && !loading && (
                  <tr>
                    <td colSpan="5" className="px-5 py-12 text-center text-ink-muted">
                      No customers found.
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
                {editingId ? 'Edit Customer' : 'Add Customer'}
              </h2>
              <button 
                onClick={() => setShowModal(false)}
                className="p-2 text-ink-muted hover:bg-gray-200 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-bold text-ink-2 mb-1.5">Acc Code</label>
                  <input
                    type="text"
                    value={form.acc_code}
                    onChange={(e) => setForm({...form, acc_code: e.target.value})}
                    className="w-full px-4 py-2.5 bg-gray-50 border-0 rounded-xl text-ink font-medium focus:ring-2 focus:ring-accent"
                    required
                  />
                </div>
                <div className="flex-[2]">
                  <label className="block text-sm font-bold text-ink-2 mb-1.5">Company Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({...form, name: e.target.value})}
                    className="w-full px-4 py-2.5 bg-gray-50 border-0 rounded-xl text-ink font-medium focus:ring-2 focus:ring-accent"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-bold text-ink-2 mb-1.5">Tel Number</label>
                  <input
                    type="text"
                    value={form.tel}
                    onChange={(e) => setForm({...form, tel: e.target.value})}
                    className="w-full px-4 py-2.5 bg-gray-50 border-0 rounded-xl text-ink font-medium focus:ring-2 focus:ring-accent"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-bold text-ink-2 mb-1.5">Attention (Attn)</label>
                  <input
                    type="text"
                    value={form.attn}
                    onChange={(e) => setForm({...form, attn: e.target.value})}
                    className="w-full px-4 py-2.5 bg-gray-50 border-0 rounded-xl text-ink font-medium focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-ink-2 mb-1.5">Address</label>
                <textarea
                  value={form.address}
                  onChange={(e) => setForm({...form, address: e.target.value})}
                  className="w-full px-4 py-2.5 bg-gray-50 border-0 rounded-xl text-ink font-medium focus:ring-2 focus:ring-accent resize-none h-24"
                />
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
                  {saving ? 'Saving...' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Confirm Delete Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 pb-2 text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="text-red-600" size={24} />
              </div>
              <h3 className="text-lg font-bold text-ink mb-2">Delete Customer</h3>
              <p className="text-sm text-ink-muted leading-relaxed">
                Are you sure you want to delete <br/>
                <strong className="text-ink">{deleteTarget.name}</strong>? <br/>
                This action cannot be undone.
              </p>
            </div>
            <div className="p-6 pt-5 flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-ink-2 rounded-xl font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
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
