import { useState, useEffect, useRef } from 'react'
import { FileText, Eye, Loader2, Calendar, FolderOpen, X, Mail } from 'lucide-react'
import { format, subMonths, startOfMonth, endOfMonth, formatDistanceToNow } from 'date-fns'
import EmailComposerModal from '../components/EmailComposerModal'

// ── Period presets ────────────────────────────────────────────────────────────

function getPeriodDates(key) {
  const now = new Date()
  switch (key) {
    case 'current': {
      const from = startOfMonth(now)
      return { from: format(from, 'yyyy-MM-dd'), to: format(now, 'yyyy-MM-dd') }
    }
    case 'last1': {
      const prev = subMonths(now, 1)
      return { from: format(startOfMonth(prev), 'yyyy-MM-dd'), to: format(endOfMonth(prev), 'yyyy-MM-dd') }
    }
    case 'last2': {
      const prev = subMonths(now, 1)
      return { from: format(startOfMonth(prev), 'yyyy-MM-dd'), to: format(now, 'yyyy-MM-dd') }
    }
    case 'last3': {
      const prev2 = subMonths(now, 2)
      return { from: format(startOfMonth(prev2), 'yyyy-MM-dd'), to: format(now, 'yyyy-MM-dd') }
    }
    default:
      return null
  }
}

const PERIOD_OPTIONS = [
  { value: '',        label: 'Custom Range' },
  { value: 'current', label: 'Current Month' },
  { value: 'last1',   label: 'Last Month' },
  { value: 'last2',   label: 'Last 2 Months' },
  { value: 'last3',   label: 'Last 3 Months' },
]

// ── Toast Component ──────────────────────────────────────────────────────────

function Toast({ show, message, folderPath, onClose }) {
  if (!show) return null
  return (
    <div className="fixed bottom-6 right-6 z-50 animate-[slideUp_0.3s_ease-out]">
      <div className="bg-ink text-white rounded-2xl shadow-2xl px-5 py-4 flex items-center gap-4 min-w-[320px]">
        <div className="w-9 h-9 rounded-xl bg-green-500/20 flex items-center justify-center shrink-0">
          <FileText size={18} className="text-green-400" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">{message}</p>
          {folderPath && (
            <button
              onClick={() => window.api.openFolder(folderPath)}
              className="text-xs text-accent-light hover:underline mt-1 flex items-center gap-1"
            >
              <FolderOpen size={12} /> Open Folder
            </button>
          )}
        </div>
        <button onClick={onClose} className="text-white/50 hover:text-white transition-colors shrink-0">
          <X size={16} />
        </button>
      </div>
      <style>{`@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); }}`}</style>
    </div>
  )
}

// ── Statement of Account ──────────────────────────────────────────────────

export default function Statement() {
  const [customers, setCustomers] = useState([])
  const [selectedCustomer, setSelectedCustomer] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const searchRef = useRef(null)

  const [period, setPeriod] = useState('current')
  const [fromDate, setFromDate] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [toDate, setToDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  
  const [transactions, setTransactions] = useState([])
  const [openingBalance, setOpeningBalance] = useState(0)
  
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  
  const [selectedIds, setSelectedIds] = useState([])
  const [showEmailModal, setShowEmailModal] = useState(false)
  
  // PDF Archive State
  const [generatedFiles, setGeneratedFiles] = useState([])
  const [selectedPdfPaths, setSelectedPdfPaths] = useState([])
  const [showPdfEmailModal, setShowPdfEmailModal] = useState(false)

  // Toast state
  const [toast, setToast] = useState({ show: false, message: '', folderPath: '' })
  const showToast = (message, folderPath = '') => {
    setToast({ show: true, message, folderPath })
    setTimeout(() => setToast(t => ({ ...t, show: false })), 6000)
  }

  // Fetch customers on mount
  useEffect(() => {
    window.api.statement.getCustomers().then(setCustomers).catch(console.error)
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filteredCustomers = customers.filter(c =>
    c.toLowerCase().includes(customerSearch.toLowerCase())
  )

  // ── Period selector ────────────────────────────────────────────────────────
  const handlePeriodChange = (e) => {
    const key = e.target.value
    setPeriod(key)
    const dates = getPeriodDates(key)
    if (dates) {
      setFromDate(dates.from)
      setToDate(dates.to)
    }
  }

  const handleGenerate = async (e) => {
    e.preventDefault()
    if (!selectedCustomer) {
      showToast("Please select a customer first.")
      return
    }
    setLoading(true)
    setHasSearched(true)
    try {
      const data = await window.api.statement.fetchTransactions(selectedCustomer, fromDate, toDate)
      setOpeningBalance(data.openingBalance)
      setTransactions(data.txns)
      setSelectedIds([]) // Reset selections on new query
      fetchPdfHistory(selectedCustomer)
    } catch (err) {
      console.error(err)
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── PDF History Fetcher ───────────────────────────────────────────────────
  const fetchPdfHistory = async (custName) => {
    try {
      if (!custName) return
      const files = await window.api.statement.listGenerated(custName)
      setGeneratedFiles(files || [])
      setSelectedPdfPaths([])
    } catch (e) {
      console.error('Failed to fetch statement history:', e)
    }
  }

  // ── Selection Handlers ──────────────────────────────────────────────────────

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(transactions.filter(t => t.type === 'debit').map(t => t.invoice_no))
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

  // ── Aging computation ──────────────────────────────────────────────────────
  const computeAgingAndTotals = () => {
    const end = new Date(toDate)
    let current = 0, age30 = 0, age60 = 0, age90 = 0, age120 = 0
    let balanceToBeAllocated = transactions.length > 0
      ? transactions[transactions.length - 1].balance
      : openingBalance;
      
    let remainingBal = Math.max(0, balanceToBeAllocated)
    
    const allInvoices = transactions
      .filter(t => t.type === 'debit')
      .sort((a,b) => new Date(b.date) - new Date(a.date))
    
    for (const inv of allInvoices) {
      if (remainingBal <= 0) break
      const invDate = new Date(inv.date)
      const diffDays = Math.floor((end - invDate) / (1000 * 60 * 60 * 24))
      const allocate = Math.min(inv.debit, remainingBal)
      if (allocate > 0) {
        if (diffDays <= 30) current += allocate
        else if (diffDays <= 60) age30 += allocate
        else if (diffDays <= 90) age60 += allocate
        else if (diffDays <= 120) age90 += allocate
        else age120 += allocate
        remainingBal -= allocate
      }
    }
    if (remainingBal > 0) age120 += remainingBal

    return { current, age30, age60, age90, age120, total: balanceToBeAllocated }
  }

  // ── PDF Export ─────────────────────────────────────────────────────────────
  const handleExportPdf = async () => {
    if (!hasSearched || !selectedCustomer) return
    setExporting(true)
    try {
      const payload = {
        customer: selectedCustomer,
        from_date: fromDate,
        to_date: toDate,
        opening_balance: openingBalance,
        transactions: transactions
      }
      const result = await window.api.statement.exportPdf(payload)
      if (result.ok) {
        // Extract folder from full path
        const folder = result.path ? result.path.replace(/[\\/][^\\/]+$/, '') : ''
        showToast('Statement exported successfully!', folder)
        fetchPdfHistory(selectedCustomer)
      }
    } catch (err) {
      console.error(err)
      showToast(err.message)
    } finally {
      setExporting(false)
    }
  }

  // ── Formatters ─────────────────────────────────────────────────────────────
  const fmtAmt = (val) => {
    if (!val || Number(val) === 0) return '-'
    return Number(val).toLocaleString('en-MY', {minimumFractionDigits: 2, maximumFractionDigits: 2})
  }
  const fmtDateDisp = (dStr) => {
    if (!dStr) return ''
    if (dStr.includes('/')) {
        let p = dStr.split('/')
        if (p[2] && p[2].length===4) return `${p[0]}-${p[1]}-${p[2]}`
        return dStr
    }
    const d = new Date(dStr)
    return isNaN(d) ? dStr : format(d, 'dd-MM-yyyy')
  }

  const aging = hasSearched ? computeAgingAndTotals() : null

  return (
    <div className="flex flex-col h-full bg-bg pb-8">
      
      {/* Header */}
      <div className="px-10 pt-10 pb-6 shrink-0 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold text-ink">Statement of Account</h1>
          <p className="text-[15px] text-ink-muted mt-2">
            Generate account ledgers and aging reports for customers
          </p>
        </div>
        <div className="flex items-center gap-3">
          {selectedPdfPaths.length > 0 && (
            <button
              onClick={() => setShowPdfEmailModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-100/50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl shadow-sm transition-all"
            >
              <Mail size={18} />
              Email Selected ({selectedPdfPaths.length})
            </button>
          )}
          {selectedIds.length > 0 && (
            <button
              onClick={() => setShowEmailModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border border-border hover:bg-gray-50 text-ink font-bold rounded-xl shadow-sm transition-all text-sm"
            >
              Email Invoices ({selectedIds.length})
            </button>
          )}
          <button 
            onClick={handleExportPdf}
            disabled={exporting || !hasSearched}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-xl font-bold transition-colors shadow-sm disabled:opacity-50"
          >
            {exporting ? <Loader2 size={18} className="animate-spin" /> : <Eye size={18} />}
            Export PDF
          </button>
        </div>
      </div>

      <div className="flex-1 px-10 min-h-0 flex flex-col gap-6">
        
        {/* Top Controls Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-border p-6 flex-none">
          <form onSubmit={handleGenerate} className="flex items-end gap-4 flex-wrap">
            
            {/* Searchable Customer Select */}
            <div className="flex-1 min-w-[200px] relative" ref={searchRef}>
              <label className="block text-sm font-bold text-ink-2 mb-2">Customer</label>
              <input
                type="text"
                value={selectedCustomer || customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value)
                  setSelectedCustomer('')
                  setShowDropdown(true)
                }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Type to search customers..."
                className="w-full h-11 px-4 bg-[#f5f5f7] rounded-xl border-0 text-[15px] font-medium text-ink focus:ring-2 focus:ring-accent"
                required
              />
              {showDropdown && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-border max-h-[240px] overflow-auto">
                  {filteredCustomers.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-ink-muted">No customers found</div>
                  ) : (
                    filteredCustomers.map(c => (
                      <button
                        type="button"
                        key={c}
                        onClick={() => {
                          setSelectedCustomer(c)
                          setCustomerSearch('')
                          setShowDropdown(false)
                        }}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-accent-light/40 transition-colors ${
                          c === selectedCustomer ? 'bg-accent-light text-accent font-semibold' : 'text-ink'
                        }`}
                      >
                        {c}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Period */}
            <div className="min-w-[150px]">
              <label className="block text-sm font-bold text-ink-2 mb-2">Period</label>
              <select
                value={period}
                onChange={handlePeriodChange}
                className="w-full h-11 px-4 bg-[#f5f5f7] rounded-xl border-0 text-[14px] font-medium text-ink focus:ring-2 focus:ring-accent appearance-none cursor-pointer"
              >
                {PERIOD_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-bold text-ink-2 mb-2">From Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" size={16} />
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => { setFromDate(e.target.value); setPeriod('') }}
                  className="w-40 h-11 pl-9 pr-3 bg-[#f5f5f7] rounded-xl border-0 text-[14px] font-medium text-ink focus:ring-2 focus:ring-accent"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-ink-2 mb-2">To Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" size={16} />
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => { setToDate(e.target.value); setPeriod('') }}
                  className="w-40 h-11 pl-9 pr-3 bg-[#f5f5f7] rounded-xl border-0 text-[14px] font-medium text-ink focus:ring-2 focus:ring-accent"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="h-11 px-8 bg-ink-2 hover:bg-ink text-white rounded-xl font-bold transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : 'Generate'}
            </button>
            
          </form>
        </div>

        {/* Results Area */}
        <div className="bg-white rounded-2xl shadow-sm border border-border flex-1 min-h-0 flex flex-col relative overflow-hidden">
          <div className="flex-1 overflow-auto">
            {!hasSearched && !loading && (
              <div className="h-full flex flex-col items-center justify-center text-ink-muted">
                <FileText size={48} className="mb-4 opacity-20" />
                <p>Select parameters and click Generate to view statement.</p>
              </div>
            )}
            
            {hasSearched && (
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#f9fafb] sticky top-0 z-[5] shadow-sm">
                  <tr>
                    <th className="px-5 py-4 w-[60px] text-center border-b border-border">
                      {transactions.filter(t => t.type === 'debit').length > 0 && (
                        <input 
                          type="checkbox"
                          checked={selectedIds.length > 0 && selectedIds.length === transactions.filter(t => t.type === 'debit').length}
                          onChange={handleSelectAll}
                          className="w-3.5 h-3.5 rounded border-gray-300 text-accent focus:ring-accent/30 cursor-pointer"
                        />
                      )}
                    </th>
                    <th className="px-5 py-4 text-xs font-semibold text-ink-muted uppercase tracking-wider border-b border-border w-[120px]">Date</th>
                    <th className="px-5 py-4 text-xs font-semibold text-ink-muted uppercase tracking-wider border-b border-border">Description / Ref</th>
                    <th className="px-5 py-4 text-xs font-semibold text-ink-muted uppercase tracking-wider border-b border-border text-right w-[150px]">Debit (RM)</th>
                    <th className="px-5 py-4 text-xs font-semibold text-ink-muted uppercase tracking-wider border-b border-border text-right w-[150px]">Credit (RM)</th>
                    <th className="px-5 py-4 text-xs font-semibold text-ink-muted uppercase tracking-wider border-b border-border text-right w-[150px]">Balance (RM)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  
                  {/* Opening Balance */}
                  <tr className="bg-gray-50/50">
                    <td className="px-5 py-3 border-r border-gray-100/50"></td>
                    <td className="px-5 py-3 text-sm text-ink-2">{fmtDateDisp(fromDate)}</td>
                    <td className="px-5 py-3 text-sm font-semibold text-ink-2">Opening Balance</td>
                    <td className="px-5 py-3 text-sm text-right font-mono text-ink-2">{openingBalance > 0 ? fmtAmt(openingBalance) : '-'}</td>
                    <td className="px-5 py-3 text-sm text-right font-mono text-ink-2">{openingBalance <= 0 && openingBalance !== 0 ? fmtAmt(Math.abs(openingBalance)) : '-'}</td>
                    <td className="px-5 py-3 text-[15px] font-bold text-right font-mono text-ink">{fmtAmt(openingBalance)}</td>
                  </tr>

                  {transactions.map((t, idx) => {
                    const isInvoice = t.type === 'debit'
                    const checked = isInvoice && selectedIds.includes(t.invoice_no)
                    return (
                    <tr 
                      key={idx} 
                      className={`transition-colors ${isInvoice ? 'cursor-pointer' : ''} ${checked ? 'bg-accent/5 hover:bg-accent/10' : 'hover:bg-accent-light/30'}`}
                      onClick={() => {
                        if (isInvoice) handleSelectRow(t.invoice_no)
                      }}
                    >
                      <td className="px-5 py-3 border-r border-gray-100/50 text-center" onClick={e => e.stopPropagation()}>
                        {isInvoice && (
                          <input 
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleSelectRow(t.invoice_no)}
                            className="w-3.5 h-3.5 rounded border-gray-300 text-accent focus:ring-accent/30 cursor-pointer"
                          />
                        )}
                      </td>
                      <td className="px-5 py-3 text-sm text-ink-2 whitespace-nowrap">{fmtDateDisp(t.date)}</td>
                      <td className="px-5 py-3">
                        <div className="text-[14.5px] font-medium text-ink">{t.description}</div>
                        {t.ref_no && <div className="text-[12.5px] text-ink-muted font-mono mt-0.5">{t.ref_no}</div>}
                      </td>
                      <td className="px-5 py-3 text-[15px] text-right font-mono text-ink-2">{fmtAmt(t.debit)}</td>
                      <td className="px-5 py-3 text-[15px] text-right font-mono text-ink-2">{fmtAmt(t.credit)}</td>
                      <td className="px-5 py-3 text-[15px] font-bold text-right font-mono text-ink">{fmtAmt(t.balance)}</td>
                    </tr>
                  )})}

                  {transactions.length === 0 && (
                    <tr>
                      <td colSpan="5" className="px-5 py-8 text-center text-sm text-ink-muted">
                        No transactions found in this period.
                      </td>
                    </tr>
                  )}
                  
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── Closing Balance + Aging Analysis Blocks ─────────────────────── */}
        {aging && (
          <div className="flex-none grid grid-cols-7 gap-3">
            {/* Closing Balance — full accent */}
            <div className="col-span-1 bg-accent rounded-2xl p-4 flex flex-col justify-center shadow-sm">
              <span className="text-[11px] font-bold text-white/70 uppercase tracking-wider">Closing</span>
              <span className="text-xl font-extrabold text-white mt-1">{fmtAmt(aging.total)}</span>
            </div>

            {/* Aging buckets */}
            {[
              { label: 'Current',   val: aging.current },
              { label: '31–60',     val: aging.age30 },
              { label: '61–90',     val: aging.age60 },
              { label: '91–120',    val: aging.age90 },
              { label: '120+',      val: aging.age120 },
              { label: 'Total',     val: aging.total },
            ].map(b => (
              <div
                key={b.label}
                className="bg-white rounded-2xl border border-border p-4 flex flex-col justify-center shadow-sm"
              >
                <span className="text-[11px] font-bold text-ink-muted uppercase tracking-wider">{b.label}</span>
                <span className={`text-lg font-extrabold mt-1 ${b.val > 0 ? 'text-ink' : 'text-ink-muted'}`}>
                  {fmtAmt(b.val)}
                </span>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* ── Generated Statements History ─────────────────────────────────── */}
      {hasSearched && (
        <div className="bg-white rounded-2xl shadow-sm border border-border flex-none flex flex-col relative overflow-hidden mx-10 mb-8 mt-[-10px]">
          <div className="px-6 py-4 border-b border-border bg-[#f9fafb] flex items-center justify-between">
            <h2 className="text-[15px] font-bold text-ink flex items-center gap-2">
              <FileText size={18} className="text-accent" />
              Generated Statements for {selectedCustomer}
            </h2>
          </div>
          <div className="max-h-[250px] overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#f9fafb] sticky top-0 z-[5] shadow-sm">
                <tr>
                  <th className="px-5 py-3 w-[60px] text-center border-b border-border">
                    {generatedFiles.length > 0 && (
                      <input
                        type="checkbox"
                        checked={selectedPdfPaths.length > 0 && selectedPdfPaths.length === generatedFiles.length}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedPdfPaths(generatedFiles.map(f => f.path))
                          else setSelectedPdfPaths([])
                        }}
                        className="w-3.5 h-3.5 rounded border-gray-300 text-blue-500 focus:ring-blue-500/30 cursor-pointer"
                      />
                    )}
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider border-b border-border">File Name</th>
                  <th className="px-5 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider border-b border-border">Generated On</th>
                  <th className="px-5 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wider border-b border-border text-right">Size</th>
                  <th className="px-5 py-3 w-[80px] border-b border-border"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {generatedFiles.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-5 py-8 text-center text-sm text-ink-muted">
                      No PDF statements generated yet for {selectedCustomer}.
                    </td>
                  </tr>
                ) : (
                  generatedFiles.map((file, idx) => {
                    const checked = selectedPdfPaths.includes(file.path)
                    return (
                      <tr
                        key={idx}
                        className={`transition-colors cursor-pointer ${checked ? 'bg-blue-50 hover:bg-blue-100/50' : 'hover:bg-gray-50'}`}
                        onClick={() => {
                          setSelectedPdfPaths(prev =>
                            prev.includes(file.path) ? prev.filter(p => p !== file.path) : [...prev, file.path]
                          )
                        }}
                      >
                        <td className="px-5 py-3 border-r border-gray-100/50 text-center" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setSelectedPdfPaths(prev =>
                                prev.includes(file.path) ? prev.filter(p => p !== file.path) : [...prev, file.path]
                              )
                            }}
                            className="w-3.5 h-3.5 rounded border-gray-300 text-blue-500 focus:ring-blue-500/30 cursor-pointer"
                          />
                        </td>
                        <td className="px-5 py-3 text-sm font-medium text-ink flex items-center gap-2">
                          <FileText size={14} className="text-red-500" />
                          {file.name}
                        </td>
                        <td className="px-5 py-3 text-sm text-ink-muted">
                          {formatDistanceToNow(file.mtime, { addSuffix: true })}
                        </td>
                        <td className="px-5 py-3 text-sm text-right text-ink-muted font-mono">
                          {(file.size / 1024).toFixed(1)} KB
                        </td>
                        <td className="px-5 py-3 text-center" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => {
                              const folder = file.path.replace(/[\\/][^\\/]+$/, '')
                              window.api.openFolder(folder)
                            }}
                            title="Open Folder"
                            className="p-1.5 text-ink-muted hover:text-accent hover:bg-accent/10 rounded-md transition-colors"
                          >
                            <FolderOpen size={16} />
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Toast notification */}
      <Toast
        show={toast.show}
        message={toast.message}
        folderPath={toast.folderPath}
        onClose={() => setToast(t => ({ ...t, show: false }))}
      />

      {/* Email Composer Modal (Treating Statements as sending their underlying Invoices) */}
      <EmailComposerModal 
        visible={showEmailModal}
        titleContext="Invoices (From Statement)"
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

      {/* Email Composer Modal (Direct Statement PDF attachments) */}
      <EmailComposerModal 
        visible={showPdfEmailModal}
        titleContext="Statement PDFs"
        selectedIds={selectedPdfPaths}
        onClose={(success) => {
          setShowPdfEmailModal(false)
          if (success) setSelectedPdfPaths([])
        }}
        fetchDataCallback={async (path) => ({ customer: selectedCustomer, _preGeneratedPath: path })}
        exportPdfCallback={async (data) => ({ ok: true, path: data._preGeneratedPath })}
      />
    </div>
  )
}
