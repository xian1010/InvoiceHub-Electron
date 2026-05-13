import { useState, useEffect } from 'react'
import { Save, Loader2, Building2, FileText, X } from 'lucide-react'

// ── Company Profile ─────────────────────────────────────────────────────────

export default function CompanyProfile() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [toast, setToast] = useState({ show: false, message: '' })
  
  const [form, setForm] = useState({
    name: '',
    reg_no: '',
    tel: '',
    email: '',
    address: '',
    bank_info: ''
  })

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await window.api.company.get()
        if (data) {
          setForm({
            name: data.name || '',
            reg_no: data.reg_no || '',
            tel: data.tel || '',
            email: data.email || '',
            address: data.address || '',
            bank_info: data.bank_info || ''
          })
        }
      } catch (err) {
        console.error("Failed to load company profile", err)
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setSuccessMsg('')
    try {
      await window.api.company.save(form)
      setSuccessMsg('Company profile updated successfully!')
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err) {
      console.error(err)
      setToast({ show: true, message: "Error saving: " + err.message })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="animate-spin text-accent" size={32} />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-bg pb-8">
      {/* Header */}
      <div className="px-10 pt-10 pb-6 shrink-0">
        <h1 className="text-3xl font-bold text-ink">Company Profile</h1>
        <p className="text-[15px] text-ink-muted mt-2">
          This information will be printed on all your outgoing documents (Invoices, Quotations, Statements).
        </p>
      </div>

      {/* Main Content */}
      <div className="flex-1 px-10 overflow-auto">
        <div className="max-w-3xl bg-white rounded-[20px] shadow-sm border border-border overflow-hidden">
          
          <div className="p-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 rounded-[14px] bg-accent-light flex items-center justify-center text-accent">
                <Building2 size={24} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-ink">Business Details</h2>
                <p className="text-sm text-ink-muted">General public information</p>
              </div>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
              
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-ink-2 mb-2">Company Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({...form, name: e.target.value})}
                    placeholder="e.g. YS Unique Trading"
                    className="w-full px-4 py-3 bg-[#f5f5f7] border-0 rounded-xl text-ink font-medium focus:ring-2 focus:ring-accent transition-shadow"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-ink-2 mb-2">Registration No.</label>
                  <input
                    type="text"
                    value={form.reg_no}
                    onChange={(e) => setForm({...form, reg_no: e.target.value})}
                    placeholder="e.g. 202103445521 (123456-X)"
                    className="w-full px-4 py-3 bg-[#f5f5f7] border-0 rounded-xl text-ink font-medium focus:ring-2 focus:ring-accent transition-shadow"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-ink-2 mb-2">Telephone</label>
                  <input
                    type="text"
                    value={form.tel}
                    onChange={(e) => setForm({...form, tel: e.target.value})}
                    placeholder="e.g. +6012-345 6789"
                    className="w-full px-4 py-3 bg-[#f5f5f7] border-0 rounded-xl text-ink font-medium focus:ring-2 focus:ring-accent transition-shadow"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-ink-2 mb-2">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({...form, email: e.target.value})}
                    placeholder="e.g. hello@ysunique.com"
                    className="w-full px-4 py-3 bg-[#f5f5f7] border-0 rounded-xl text-ink font-medium focus:ring-2 focus:ring-accent transition-shadow"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-ink-2 mb-2">Official Address</label>
                <textarea
                  value={form.address}
                  onChange={(e) => setForm({...form, address: e.target.value})}
                  placeholder="Full registered address..."
                  className="w-full px-4 py-3 bg-[#f5f5f7] border-0 rounded-xl text-ink font-medium focus:ring-2 focus:ring-accent transition-shadow h-24 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-ink-2 mb-2">Bank / Payment Information</label>
                <p className="text-xs text-ink-muted mb-3">This appears at the bottom of your invoices.</p>
                <textarea
                  value={form.bank_info}
                  onChange={(e) => setForm({...form, bank_info: e.target.value})}
                  placeholder="e.g. Maybank 123456789012 (YS Unique)"
                  className="w-full px-4 py-3 bg-[#f5f5f7] border-0 rounded-xl text-ink font-medium focus:ring-2 focus:ring-accent transition-shadow h-28 resize-none"
                />
              </div>

              <div className="pt-6 mt-6 border-t border-border flex items-center justify-between">
                <div>
                  {successMsg && (
                    <span className="text-green-600 font-medium text-sm animate-in fade-in duration-300">
                      {successMsg}
                    </span>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-8 py-3 bg-accent hover:bg-accent-hover text-white rounded-xl font-bold transition-all shadow-sm active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none"
                >
                  {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  Save Profile
                </button>
              </div>

            </form>
          </div>
          
        </div>
      </div>
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
