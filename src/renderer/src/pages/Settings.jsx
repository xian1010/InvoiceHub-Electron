import { useState, useEffect } from 'react'
import { FolderOpen, Save, Loader2, FileText, X, RotateCcw, AlertTriangle, CheckCircle2, SkipForward, HardDriveDownload } from 'lucide-react'

export default function Settings() {
  const [invoicePath, setInvoicePath] = useState('')
  const [quotationPath, setQuotationPath] = useState('')
  const [statementPath, setStatementPath] = useState('')
  const [creditNotePath, setCreditNotePath] = useState('')
  const [defaults, setDefaults] = useState({ inv: '', quot: '', stmt: '', cn: '' })
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [toast, setToast] = useState({ show: false, message: '' })

  // Recovery state
  const [recoveryStage, setRecoveryStage] = useState('idle') // idle | confirming | running | done
  const [recoveryFolder, setRecoveryFolder] = useState('')
  const [recoveryCount, setRecoveryCount] = useState(0)
  const [recoveryProgress, setRecoveryProgress] = useState({ current: 0, total: 0, fileName: '' })
  const [recoveryResult, setRecoveryResult] = useState(null)

  // Load current paths on mount
  useEffect(() => {
    Promise.all([
      window.api.getInvoiceExportPath(),
      window.api.getQuotationExportPath(),
      window.api.getStatementExportPath(),
      window.api.getCreditNoteExportPath(),
      window.api.getDefaultPaths()
    ]).then(([inv, qt, st, cn, defs]) => {
      setInvoicePath(inv || '')
      setQuotationPath(qt || '')
      setStatementPath(st || '')
      setCreditNotePath(cn || '')
      if (defs) setDefaults(defs)
      setLoaded(true)
    }).catch(console.error)
  }, [])

  // Listen for recovery progress events
  useEffect(() => {
    if (!window.api?.recovery) return
    window.api.recovery.onProgress((data) => {
      setRecoveryProgress(data)
    })
    return () => window.api.recovery.removeProgressListener()
  }, [])

  const browse = async (setter) => {
    const result = await window.api.selectFolder()
    if (result) setter(result)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await window.api.saveExportPaths(invoicePath, quotationPath, statementPath, creditNotePath)
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
            <PathRow
              label="Credit Note Export Folder"
              value={creditNotePath}
              onChange={setCreditNotePath}
              onBrowse={() => browse(setCreditNotePath)}
              defaultHint={`Default: ${defaults.cn}`}
            />
          </div>
        </div>

        {/* Recovery Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-border p-8 max-w-3xl mt-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <RotateCcw size={20} className="text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-ink">Bulk PDF Recovery</h2>
              <p className="text-sm text-ink-muted">Recover invoice data from exported PDF files using AI</p>
            </div>
          </div>

          {/* Idle — start button */}
          {recoveryStage === 'idle' && (
            <div className="space-y-3">
              <p className="text-sm text-ink-2 leading-relaxed">
                Lost your database? Select a folder containing your exported Invoice PDFs.
                AI will read each PDF, extract all data, and restore them into your database.
              </p>
              <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 rounded-xl border border-amber-200">
                <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                <p className="text-xs text-amber-700">
                  Duplicates are automatically skipped — safe to run multiple times.
                </p>
              </div>
              <button
                onClick={async () => {
                  const result = await window.api.recovery.selectFolder()
                  if (result) {
                    setRecoveryFolder(result.folder)
                    setRecoveryCount(result.count)
                    setRecoveryStage('confirming')
                  }
                }}
                className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold transition-colors shadow-sm text-sm"
              >
                <FolderOpen size={16} />
                Select Invoice PDF Folder
              </button>
            </div>
          )}

          {/* Confirming — show count, confirm */}
          {recoveryStage === 'confirming' && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm text-ink font-medium">
                  Found <span className="font-bold text-accent">{recoveryCount}</span> PDF files in:
                </p>
                <p className="text-xs text-ink-muted mt-1 font-mono truncate">{recoveryFolder}</p>
              </div>
              {recoveryCount === 0 ? (
                <div className="flex gap-2">
                  <p className="text-sm text-red-500">No PDF files found in this folder.</p>
                  <button
                    onClick={() => setRecoveryStage('idle')}
                    className="text-sm text-accent hover:underline font-medium"
                  >
                    Try Another Folder
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => setRecoveryStage('idle')}
                    className="flex-1 h-10 text-sm font-medium text-ink-muted bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      setRecoveryStage('running')
                      setRecoveryProgress({ current: 0, total: recoveryCount, fileName: '' })
                      try {
                        const result = await window.api.recovery.bulkFromPdf(recoveryFolder)
                        setRecoveryResult(result)
                        setRecoveryStage('done')
                      } catch (err) {
                        setRecoveryResult({ total: recoveryCount, saved: 0, skipped: 0, errors: [{ file: 'System', error: err.message }] })
                        setRecoveryStage('done')
                      }
                    }}
                    className="flex-1 h-10 text-sm font-semibold text-white bg-accent hover:bg-accent-hover rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <RotateCcw size={14} />
                    Start Recovery ({recoveryCount} PDFs)
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Running — progress bar */}
          {recoveryStage === 'running' && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-ink tabular-nums">
                    {recoveryProgress.current} / {recoveryProgress.total}
                  </span>
                  <span className="text-[11px] text-ink-muted font-medium">
                    {Math.round((recoveryProgress.current / Math.max(recoveryProgress.total, 1)) * 100)}%
                  </span>
                </div>
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 to-accent transition-all duration-500 ease-out"
                    style={{ width: `${(recoveryProgress.current / Math.max(recoveryProgress.total, 1)) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-ink-muted mt-2 truncate">
                  <Loader2 size={11} className="inline animate-spin mr-1" />
                  Processing: {recoveryProgress.fileName || '...'}
                </p>
              </div>
            </div>
          )}

          {/* Done — results summary */}
          {recoveryStage === 'done' && recoveryResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 rounded-xl p-3 text-center">
                  <CheckCircle2 size={18} className="text-emerald-500 mx-auto mb-1" />
                  <p className="text-lg font-bold text-emerald-700">{recoveryResult.saved}</p>
                  <p className="text-[11px] text-emerald-600 font-medium">Recovered</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <SkipForward size={18} className="text-gray-400 mx-auto mb-1" />
                  <p className="text-lg font-bold text-ink-muted">{recoveryResult.skipped}</p>
                  <p className="text-[11px] text-ink-muted font-medium">Skipped (exists)</p>
                </div>
                <div className="bg-red-50 rounded-xl p-3 text-center">
                  <AlertTriangle size={18} className="text-red-400 mx-auto mb-1" />
                  <p className="text-lg font-bold text-red-600">{recoveryResult.errors?.length || 0}</p>
                  <p className="text-[11px] text-red-500 font-medium">Errors</p>
                </div>
              </div>

              {recoveryResult.errors?.length > 0 && (
                <div className="bg-red-50 rounded-xl p-3 max-h-40 overflow-y-auto">
                  <p className="text-[11px] font-bold text-red-600 uppercase tracking-widest mb-2">Errors</p>
                  {recoveryResult.errors.map((e, i) => (
                    <p key={i} className="text-xs text-red-600 py-0.5 truncate">
                      <span className="font-semibold">{e.file}:</span> {e.error}
                    </p>
                  ))}
                </div>
              )}

              <button
                onClick={() => {
                  setRecoveryStage('idle')
                  setRecoveryResult(null)
                }}
                className="w-full h-10 text-sm font-medium text-ink-muted bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </div>

        {/* Database Management Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-border p-8 max-w-3xl mt-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <HardDriveDownload size={20} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-ink">Database Management</h2>
              <p className="text-sm text-ink-muted">Restore a previous database backup to recover your data</p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-ink-2 leading-relaxed">
              Select a <code className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">.db</code> backup file to replace the current database.
              The app will restart automatically after the restore is complete.
            </p>
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 rounded-xl border border-red-200">
              <AlertTriangle size={14} className="text-red-500 shrink-0" />
              <p className="text-xs text-red-600">
                This will overwrite your current data. Make sure you have a backup before proceeding.
              </p>
            </div>
            <button
              onClick={async () => {
                const confirmed = window.confirm(
                  'Are you sure you want to restore a database backup?\n\n' +
                  'Your current data will be REPLACED and the app will restart.\n' +
                  'This action cannot be undone.'
                )
                if (!confirmed) return
                try {
                  const result = await window.api.restoreDatabase()
                  if (result && !result.ok && result.reason !== 'cancelled') {
                    setToast({ show: true, message: `Restore failed: ${result.reason}` })
                  }
                } catch (err) {
                  setToast({ show: true, message: `Restore error: ${err.message}` })
                }
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold transition-colors shadow-sm text-sm"
            >
              <HardDriveDownload size={16} />
              Restore Database Backup
            </button>
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
