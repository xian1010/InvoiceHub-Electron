/**
 * UpdateModal.jsx — Global auto-update UI overlay
 *
 * Listens to IPC events from the main process (via window.api.updater)
 * and renders a modal dialog for each stage of the update lifecycle:
 *   1. Update available → ask user to download
 *   2. Downloading → show progress bar
 *   3. Downloaded → ask user to restart
 *   4. Error → show error with dismiss
 */

import { useEffect, useState } from 'react'
import { Download, RefreshCw, X, AlertCircle, CheckCircle2, ArrowDownToLine } from 'lucide-react'

// Stages: null | 'available' | 'downloading' | 'downloaded' | 'error'
export default function UpdateModal() {
  const [stage, setStage] = useState(null)
  const [info, setInfo] = useState({})       // { version, releaseDate, releaseNotes }
  const [progress, setProgress] = useState({ percent: 0, speed: 0, transferred: 0, total: 0 })
  const [errorMsg, setErrorMsg] = useState('')
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const api = window.api?.updater
    if (!api) return

    api.onUpdateAvailable((info) => {
      setInfo(info)
      setStage('available')
      setDismissed(false)
    })

    api.onDownloadProgress((prog) => {
      setProgress(prog)
      setStage('downloading')
    })

    api.onUpdateDownloaded((info) => {
      setInfo(prev => ({ ...prev, ...info }))
      setStage('downloaded')
    })

    api.onUpdateError((msg) => {
      setErrorMsg(msg)
      setStage('error')
    })

    return () => api.removeAllListeners()
  }, [])

  // Nothing to show
  if (!stage || dismissed) return null

  const handleDownload = () => {
    window.api.updater.startDownload()
    setStage('downloading')
  }

  const handleInstall = () => {
    window.api.updater.installNow()
  }

  const handleDismiss = () => {
    setDismissed(true)
  }

  const fmtBytes = (bytes) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const fmtSpeed = (bps) => {
    if (bps < 1024) return `${bps} B/s`
    if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(0)} KB/s`
    return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[999] bg-black/40 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" />

      {/* Modal */}
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 animate-[modalIn_0.3s_ease-out]">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-border/50">

          {/* ── Header Stripe ──────────────────────────────────────────── */}
          <div className={`px-6 py-4 flex items-center gap-3 ${
            stage === 'error'
              ? 'bg-gradient-to-r from-red-500 to-rose-500'
              : stage === 'downloaded'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                : 'bg-gradient-to-r from-accent to-violet-500'
          }`}>
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
              {stage === 'error' ? (
                <AlertCircle size={20} className="text-white" />
              ) : stage === 'downloaded' ? (
                <CheckCircle2 size={20} className="text-white" />
              ) : stage === 'downloading' ? (
                <ArrowDownToLine size={20} className="text-white animate-bounce" />
              ) : (
                <Download size={20} className="text-white" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-white">
                {stage === 'error' && 'Update Error'}
                {stage === 'available' && 'Update Available'}
                {stage === 'downloading' && 'Downloading Update'}
                {stage === 'downloaded' && 'Ready to Install'}
              </h3>
              {info.version && stage !== 'error' && (
                <p className="text-[11px] text-white/70 font-medium">
                  Version {info.version}
                </p>
              )}
            </div>
            {stage !== 'downloading' && (
              <button
                onClick={handleDismiss}
                className="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
              >
                <X size={14} className="text-white" />
              </button>
            )}
          </div>

          {/* ── Body ───────────────────────────────────────────────────── */}
          <div className="px-6 py-5">

            {/* Available */}
            {stage === 'available' && (
              <div className="space-y-4">
                <p className="text-sm text-ink-2 leading-relaxed">
                  A new version of <span className="font-semibold text-ink">InvoiceHub</span> is available.
                  Would you like to download and install it?
                </p>

                {info.releaseNotes && (
                  <div className="bg-gray-50 rounded-xl p-3 max-h-32 overflow-y-auto">
                    <p className="text-[11px] font-bold text-ink-muted uppercase tracking-widest mb-1">
                      What's New
                    </p>
                    <p className="text-xs text-ink-2 leading-relaxed whitespace-pre-wrap">
                      {typeof info.releaseNotes === 'string'
                        ? info.releaseNotes.replace(/<[^>]*>/g, '')
                        : ''}
                    </p>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleDismiss}
                    className="flex-1 h-10 text-sm font-medium text-ink-muted bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                  >
                    Later
                  </button>
                  <button
                    onClick={handleDownload}
                    className="flex-1 h-10 text-sm font-semibold text-white bg-accent hover:bg-accent-hover rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <Download size={14} />
                    Download Now
                  </button>
                </div>
              </div>
            )}

            {/* Downloading */}
            {stage === 'downloading' && (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-ink tabular-nums">
                      {progress.percent}%
                    </span>
                    <span className="text-[11px] text-ink-muted font-medium tabular-nums">
                      {fmtBytes(progress.transferred)} / {fmtBytes(progress.total)}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-accent to-violet-500 transition-all duration-300 ease-out"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[11px] text-ink-muted font-medium">
                      {fmtSpeed(progress.speed)}
                    </span>
                    <span className="text-[11px] text-ink-muted font-medium">
                      Please wait…
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Downloaded */}
            {stage === 'downloaded' && (
              <div className="space-y-4">
                <p className="text-sm text-ink-2 leading-relaxed">
                  The update has been downloaded successfully.
                  Restart the application to apply the update.
                </p>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleDismiss}
                    className="flex-1 h-10 text-sm font-medium text-ink-muted bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                  >
                    Later
                  </button>
                  <button
                    onClick={handleInstall}
                    className="flex-1 h-10 text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <RefreshCw size={14} />
                    Restart Now
                  </button>
                </div>
              </div>
            )}

            {/* Error */}
            {stage === 'error' && (
              <div className="space-y-4">
                <div className="bg-red-50 rounded-xl p-3">
                  <p className="text-xs text-red-600 leading-relaxed break-all">
                    {errorMsg}
                  </p>
                </div>
                <button
                  onClick={handleDismiss}
                  className="w-full h-10 text-sm font-medium text-ink-muted bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0 }
          to   { opacity: 1 }
        }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px) }
          to   { opacity: 1; transform: scale(1) translateY(0) }
        }
      `}</style>
    </>
  )
}
