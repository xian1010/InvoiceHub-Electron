import { useState, useEffect } from 'react'
import { FolderOpen, Save, Loader2, FileText, X } from 'lucide-react'

export default function Settings() {
  const [invoicePath, setInvoicePath] = useState('')
  const [quotationPath, setQuotationPath] = useState('')
  const [statementPath, setStatementPath] = useState('')
  const [defaults, setDefaults] = useState({ inv: '', quot: '', stmt: '' })
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [toast, setToast] = useState({ show: false, message: '' })

  // Load current paths on mount
  useEffect(() => {
    Promise.all([
      window.api.getInvoiceExportPath(),
      window.api.getQuotationExportPath(),
      window.api.getStatementExportPath(),
      window.api.getDefaultPaths()
    ]).then(([inv, qt, st, defs]) => {
      setInvoicePath(inv || '')
      setQuotationPath(qt || '')
      setStatementPath(st || '')
      if (defs) setDefaults(defs)
      setLoaded(true)
    }).catch(console.error)
  }, [])

  const browse = async (setter) => {
    const result = await window.api.selectFolder()
    if (result) setter(result)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await window.api.saveExportPaths(invoicePath, quotationPath, statementPath)
      setTimeout(() => setSaving(false), 600)
    } catch (err) {
      console.error(err)
      setToast({ show: true, message: err.message })
      setSaving(false)
    }
  }

  const inputCls = 'flex-1 h-11 px-4 bg-[#f5f5f7] rounded-xl border-0 text-[14px] font-medium text-ink focus:ring-2 focus:ring-accent transition-shadow truncate'
  const btnCls = 'h-11 px-4 bg-white border border-border rounded-xl text-sm font-bold text-ink-2 hover:bg-gray-50 transition-colors flex items-center gap-2 shrink-0'

  const handleOpen = (path) => {
    if (!path) {
      setToast({ show: true, message: 'No folder path set. Please browse or type a path first.' })
      return
    }
    window.api.openFolder(path)
  }

  const PathRow = ({ label, value, onChange, onBrowse, defaultHint }) => (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-bold text-ink-2">{label}</label>
      <div className="flex gap-2">
        <input
          className={inputCls}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={defaultHint || 'Click Browse to select a folder...'}
        />
        <button type="button" onClick={onBrowse} className={btnCls}>
          <FolderOpen size={16} />
          Browse
        </button>
        <button
          type="button"
          onClick={() => handleOpen(value)}
          className={btnCls + ' !px-3'}
          title="Open in Explorer"
        >
          <FolderOpen size={16} className="text-accent" />
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col h-full bg-bg">

      {/* Header */}
      <div className="px-10 pt-10 pb-6 shrink-0 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold text-ink">Settings</h1>
          <p className="text-[15px] text-ink-muted mt-2">
            Configure PDF export folders and application preferences
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !loaded}
          className="flex items-center gap-2 px-6 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-xl font-bold transition-colors shadow-sm disabled:opacity-50"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {saving ? 'Saved!' : 'Save Settings'}
        </button>
      </div>

      <div className="flex-1 px-10 pb-10 overflow-auto">

        {/* Export Paths Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-border p-8 max-w-3xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <FolderOpen size={20} className="text-accent" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-ink">PDF Export Folders</h2>
              <p className="text-sm text-ink-muted">Choose where generated PDF files are saved</p>
            </div>
          </div>

          <div className="space-y-5">
            <PathRow
              label="Invoice Export Folder"
              value={invoicePath}
              onChange={setInvoicePath}
              onBrowse={() => browse(setInvoicePath)}
              defaultHint={`Default: ${defaults.inv}`}
            />
            <PathRow
              label="Quotation Export Folder"
              value={quotationPath}
              onChange={setQuotationPath}
              onBrowse={() => browse(setQuotationPath)}
              defaultHint={`Default: ${defaults.quot}`}
            />
            <PathRow
              label="Statement Export Folder"
              value={statementPath}
              onChange={setStatementPath}
              onBrowse={() => browse(setStatementPath)}
              defaultHint={`Default: ${defaults.stmt}`}
            />
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
