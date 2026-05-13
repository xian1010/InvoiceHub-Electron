import { useState, useEffect } from 'react'
import { X, Send, Loader2, Paperclip, CheckCircle2, AlertCircle } from 'lucide-react'

export default function EmailComposerModal({ 
  visible, 
  onClose, 
  selectedIds,       // Array of invoice/statement IDs e.g. ['INV-0001', 'INV-0002']
  fetchDataCallback, // async (id) => { return { ...data, email: '...' } }
  exportPdfCallback, // async (data) => { return '/path/to/pdf' }
  titleContext = 'Invoices' 
}) {
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [prepProgress, setPrepProgress] = useState(0)
  const [prepTotal, setPrepTotal] = useState(0)
  
  const [toStr, setToStr] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [attachments, setAttachments] = useState([]) // Array of paths
  const [contactHistory, setContactHistory] = useState([])

  // Initialize emails and attachments when modal opens
  useEffect(() => {
    if (!visible) return
    let isMounted = true

    async function init() {
      setLoading(true)
      setSending(false)
      setError(null)
      try {
        setPrepTotal(selectedIds.length)
        const emails = new Set()
        
        // Parallel Async generation mapping
        let completed = 0;
        const pdfPromises = selectedIds.map(async (id) => {
          // 1. Fetch metadata
          const data = await fetchDataCallback(id)
          
          if (data.customer) {
             const custData = await window.api.customers.findByName(data.customer)
             if (custData && custData.email) {
                 emails.add(custData.email)
             }
          }

          // 2. Secretly generate PDF
          const pdfResult = await exportPdfCallback(data, false)
          completed += 1
          if (isMounted) setPrepProgress(completed)
          
          if (pdfResult && pdfResult.ok && pdfResult.path) {
            return pdfResult.path
          } else {
            throw new Error(`Failed to generate PDF for ${id}: ${pdfResult?.error || 'Unknown issue'}`)
          }
        })

        const paths = await Promise.all(pdfPromises)

        // 3. Fetch canonical company profile for dynamic branding
        const companyProfile = await window.api.company.get()
        const brandName = companyProfile?.name || 'YS UNIQUE TRADING'

        // 4. Fetch historically dialed contacts for autocomplete dropdown
        const history = await window.api.email.listContacts()
        if (isMounted && history) {
          setContactHistory(history.map(h => h.email))
        }

        if (isMounted) {
          setToStr(Array.from(emails).join(', '))
          setSubject(`${titleContext} from ${brandName}`)
          // Extract clean file names from paths (handles both \ and / separators)
          const cleanNames = selectedIds.map(id => {
            const name = String(id).split('\\').pop().split('/').pop()
            return name.endsWith('.pdf') ? name : id
          })
          setBody(`Dear Customer,\n\nPlease find attached the following ${titleContext.toLowerCase()}:\n${cleanNames.join('\n')}\n\nThank you for your business.\n\nBest Regards,\n${brandName}`)
          setAttachments(paths)
        }

      } catch (err) {
         if (isMounted) setError(err.message)
      } finally {
         if (isMounted) setLoading(false)
      }
    }

    init()
    return () => { isMounted = false }
  }, [visible, selectedIds, fetchDataCallback, exportPdfCallback, titleContext])

  const handleSend = () => {
    if (!toStr.trim() || sending) return
    setSending(true)
    setError(null)
    
    // Non-blocking asynchronous dispatch
    window.api.email.send({
      to: toStr.trim(),
      subject,
      body: body.replace(/\n/g, '<br/>'),
      attachments
    }).then(result => {
      if (!result.ok) throw new Error(result.error)
      // Success is silent / handled behind the scenes. Modal is already closed.
    }).catch(err => {
      setError(`Background Send Failed: ${err.message}`)
      setSending(false)
    })
    
    // Close modal immediately regardless of network wait
    onClose(true)
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div 
        className="bg-white rounded-[24px] shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <h2 className="text-[17px] font-bold text-ink">Compose Email</h2>
            <p className="text-[13px] text-ink-muted">Sending {attachments.length} Document(s)</p>
          </div>
          <button onClick={() => onClose(false)} disabled={sending} className="p-2 text-gray-400 hover:text-ink hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto max-h-[70vh]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 size={32} className="animate-spin text-accent mb-4" />
              <p className="text-sm font-semibold text-ink">
                Generating PDFs ({prepProgress}/{prepTotal})
              </p>
              <p className="text-[13px] text-ink-muted mt-1">Please wait while documents are processed in parallel.</p>
              
              {/* Progress Bar Container */}
              <div className="w-64 h-2 bg-gray-100 rounded-full mt-4 overflow-hidden">
                <div 
                  className="h-full bg-accent transition-all duration-300 ease-in-out rounded-full"
                  style={{ width: `${prepTotal > 0 ? (prepProgress / prepTotal) * 100 : 0}%` }}
                />
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
                  <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm font-medium text-red-800">{error}</p>
                </div>
              )}

              {/* To Group */}
              <div className="flex bg-[#f9fafb] rounded-xl border border-gray-100 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent transition-all overflow-hidden">
                <div className="px-4 py-3 text-[13px] font-bold text-ink-muted bg-gray-50 border-r border-gray-100 flex items-center shrink-0 w-[100px]">
                  To
                </div>
                <input 
                  type="text" 
                  list="email-contacts"
                  value={toStr}
                  onChange={e => setToStr(e.target.value)}
                  placeholder="customer@domain.com, accounts@domain.com"
                  className="flex-1 px-4 py-3 bg-transparent text-[14px] font-medium text-ink focus:outline-none placeholder:text-gray-400"
                />
                <datalist id="email-contacts">
                  {contactHistory.map((em, idx) => (
                    <option key={idx} value={em} />
                  ))}
                </datalist>
              </div>

              {/* Subject Group */}
              <div className="flex bg-[#f9fafb] rounded-xl border border-gray-100 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent transition-all overflow-hidden">
                <div className="px-4 py-3 text-[13px] font-bold text-ink-muted bg-gray-50 border-r border-gray-100 flex items-center shrink-0 w-[100px]">
                  Subject
                </div>
                <input 
                  type="text" 
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className="flex-1 px-4 py-3 bg-transparent text-[14px] font-medium text-ink focus:outline-none"
                />
              </div>

              {/* Body Area */}
              <div className="flex flex-col bg-[#f9fafb] rounded-xl border border-gray-100 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent transition-all overflow-hidden mt-2">
                <textarea 
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  rows={8}
                  className="w-full p-4 bg-transparent text-[14px] leading-relaxed text-ink resize-none focus:outline-none"
                />
              </div>

              {/* Attachments UI */}
              <div className="mt-2">
                <p className="text-[12px] font-bold text-ink-muted uppercase tracking-wider mb-3 ml-1">Included Attachments</p>
                <div className="flex flex-wrap gap-2">
                  {attachments.map((pth, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-blue-50/50 border border-blue-100 px-3 py-2 rounded-lg text-[13px] font-medium text-blue-800">
                      <Paperclip size={14} className="text-blue-500" />
                      {pth.split('\\').pop().split('/').pop()}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
          <button 
            onClick={() => onClose(false)}
            disabled={sending || loading}
            className="px-5 py-2.5 text-[14px] font-semibold text-ink-2 bg-white border border-gray-200 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button 
            onClick={handleSend}
            disabled={sending || loading || !toStr.trim() || attachments.length === 0}
            className="flex items-center gap-2 px-6 py-2.5 text-[14px] font-bold text-white bg-accent hover:bg-accent-hover rounded-xl shadow-md shadow-accent/20 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {sending ? 'Dispatching...' : 'Send Message'}
          </button>
        </div>
      </div>
    </div>
  )
}
