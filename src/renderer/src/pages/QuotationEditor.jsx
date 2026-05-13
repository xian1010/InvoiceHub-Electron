import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, ArrowLeft, Save, Eye, Loader2, ArrowRight, FileText, FolderOpen, X, ChevronDown } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'

// ── Shared styling tokens ─────────────────────────────────────────────────────
const STATUS_OPTS = ['Draft', 'Sent', 'Accepted', 'Rejected', 'Invoiced']
const UOM_OPTS = ['PCS', 'SETS', 'BOOKS', 'UNIT', 'LOT', 'BOX', 'PKT', 'KG', 'ROLL', 'LTR', 'MTR']

const today = () => new Date().toISOString().slice(0, 10)

/** Convert DD/MM/YYYY (v1) → YYYY-MM-DD (v2 HTML date input) */
function convertDateToIso(dateStr) {
  if (!dateStr) return today()
  if (dateStr.includes('-')) return dateStr // already ISO
  const parts = dateStr.split('/')
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
  }
  return today()
}

// ── Modals ───────────────────────────────────────────────────────────────────

function ConfirmModal({ title, message, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 bg-black/25 backdrop-blur-[2px] flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[400px] p-6 animate-in fade-in zoom-in duration-200">
        <h2 className="text-lg font-bold text-ink mb-2">{title}</h2>
        <p className="text-[15px] text-ink-muted mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-5 py-2.5 text-sm font-bold text-ink-2 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-5 py-2.5 text-sm font-bold text-white bg-accent hover:bg-accent-hover rounded-xl transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50 min-w-[100px] justify-center"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function QuotationEditor() {
  const navigate = useNavigate()
  const { id } = useParams()
  
  const [loading, setLoading] = useState(!!id)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [converting, setConverting] = useState(false)
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [toast, setToast] = useState({ show: false, message: '', folderPath: '' })

  // Header State
  const [header, setHeader] = useState({
    quotation_no: '',
    date: new Date().toISOString().slice(0, 10),
    customer: '',
    address: '',
    acc_code: '',
    attn: '',
    tel: '',
    terms: '30 Days',
    ref1: '',
    ref2: '',
    status: 'Draft'
  })

  // Items State
  const [items, setItems] = useState([
    { id: Date.now(), description: '', qty: 1, uom: 'PCS', uprice: '', subtotal: '' }
  ])

  const [total, setTotal] = useState(0)
  const [customerList, setCustomerList] = useState([])
  const [productList, setProductList] = useState([])
  const [focusedRow, setFocusedRow] = useState(null)
  const [autoFocusRow, setAutoFocusRow] = useState(null)

  // ── Load Existing Data ─────────────────────────────────────────────────────

  useEffect(() => {
    if (id) {
      window.api.quotations.get(id).then(data => {
        if (data) {
          setHeader({
            quotation_no: data.quotation_no || '',
            date: convertDateToIso(data.date),
            customer: data.customer || '',
            address: data.address || '',
            acc_code: data.acc_code || '',
            attn: data.attn || '',
            tel: data.tel || '',
            terms: data.terms || '',
            ref1: data.ref1 || '',
            ref2: data.ref2 || '',
            status: data.status || 'Draft'
          })
          if (data.items && data.items.length > 0) {
            setItems(data.items.map(item => {
              const up = item.uprice
              const normalized = (!up && up !== 0) || up === 0 || Number(up) === 0 ? '-' : String(up)
              return {
                id: item.id || Date.now() + Math.random(),
                description: item.description || '',
                qty: item.qty || 0,
                uom: item.uom || 'PCS',
                uprice: normalized,
                subtotal: item.subtotal || 0
              }
            }))
          }
        }
        setLoading(false)
      }).catch(err => {
        console.error(err)
        setLoading(false)
      })
    } else {
      window.api.quotations.nextNo().then(no => {
        setHeader(h => ({ ...h, quotation_no: no }))
      })
    }
  }, [id])

  // ── Calculate Totals ───────────────────────────────────────────────────────

  useEffect(() => {
    const sum = items.reduce((acc, it) => acc + (parseFloat(it.subtotal) || 0), 0)
    setTotal(sum)
  }, [items])

  // ── Load customer list for datalist ─────────────────────────────────────────
  useEffect(() => {
    window.api.customers.list()
      .then(list => setCustomerList(list || []))
      .catch(() => {})
      
    window.api.products.list()
      .then(list => setProductList(list || []))
      .catch(() => {})
  }, [])

  // ── Handlers ─────────────────────────────────────────────────────────────────────

  const handleHeaderChange = (field, value) => {
    setHeader(h => ({ ...h, [field]: value }))
  }

  const handleCustomerChange = (e) => {
    const name = e.target.value
    setHeader(h => ({ ...h, customer: name }))
    const match = customerList.find(c => c.name === name)
    if (match) {
      setHeader(h => ({
        ...h,
        customer: match.name,
        acc_code: match.acc_code || h.acc_code,
        address:  match.address  || h.address,
        tel:      match.tel      || h.tel,
        attn:     match.attn     || h.attn
      }))
    }
  }

  const addItem = () => {
    const newId = Date.now()
    setItems(prev => [...prev, { id: newId, description: '', qty: 1, uom: 'PCS', uprice: '', subtotal: '' }])
    setAutoFocusRow(newId)
  }

  const removeItem = (idToRemove) => {
    setItems(prev => prev.filter(it => it.id !== idToRemove))
  }

  const updateItem = (id, field, value) => {
    setItems(prev => prev.map(it => {
      if (it.id === id) {
        const updated = { ...it, [field]: value }
        if (field === 'qty' || field === 'uprice') {
          if (updated.uprice !== '-') {
            const q = parseFloat(updated.qty) || 0
            const p = parseFloat(updated.uprice) || 0
            updated.subtotal = q * p
          }
        }
        return updated
      }
      return it
    }))
  }

  // ── Save (core, no navigation) ─────────────────────────────────────────────

  const performSave = async () => {
    if (!header.quotation_no) throw new Error('Quotation Number is required.')
    if (!header.customer) throw new Error('Customer name is required.')
    const hdr = { ...header, total }
    await window.api.quotations.save(hdr, items)
  }

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      await performSave()
      setToast({ show: true, message: 'Quotation saved successfully!' })
      setTimeout(() => navigate('/quotations'), 1000)
    } catch (err) {
      console.error('[Editor] save error:', err)
      setToast({ show: true, message: err.message || 'Error saving quotation' })
    } finally {
      setSaving(false)
    }
  }

  // ── Convert to Invoice ─────────────────────────────────────────────────────

  const handleConvertToInvoiceClick = () => {
    const qt_no = header.quotation_no
    if (!qt_no) {
      setToast({ show: true, message: "Please save the quotation first." })
      return
    }
    setShowConvertModal(true)
  }

  const confirmConvertToInvoice = async () => {
    if (converting) return
    const qt_no = header.quotation_no
    
    setConverting(true)
    try {
      // Create new invoice data
      const nextInvNo = await window.api.invoices.nextNo()
      const invHeader = {
        invoice_no: nextInvNo,
        customer: header.customer,
        date: new Date().toISOString().slice(0, 10), // Default to Today as requested
        total: total,
        address: header.address,
        attn: header.attn,
        tel: header.tel,
        acc_code: header.acc_code,
        terms: header.terms,
        ref1: header.ref1,
        ref2: header.ref2,
        ref3: '',
        ref4: '',
        status: 'Pending'
      }
      // Re-map items, stripping ID and po_no placeholders
      const invItems = items.map(idx => ({
        description: idx.description,
        po_no: '',
        qty: idx.qty,
        uom: idx.uom,
        uprice: idx.uprice,
        subtotal: idx.subtotal
      }))
      
      // Save Invoice
      await window.api.invoices.save(invHeader, invItems)
      // Update Quotation Status
      await window.api.quotations.setStatus(qt_no, 'Invoiced')
      setHeader(h => ({ ...h, status: 'Invoiced' }))
      
      setToast({ show: true, message: `Quotation ${qt_no} converted to Invoice ${nextInvNo}.`, folderPath: '' })
      setShowConvertModal(false)
      setTimeout(() => {
        navigate(`/invoices/${nextInvNo}`)
      }, 1500)
    } catch (err) {
      console.error('[Editor] Convert error:', err)
      setToast({ show: true, message: 'Conversion failed: ' + err.message })
    } finally {
      setConverting(false)
    }
  }

  // ── Export PDF (auto-saves first) ──────────────────────────────────────────

  const handleExportPdf = async () => {
    if (exporting) return
    setExporting(true)
    try {
      // Auto-save so PDF always reflects latest data
      await performSave()

      const payload = {
        invoice_no: header.quotation_no,
        date: header.date,
        billing: header.customer,
        billing_address: header.address,
        acc_code: header.acc_code,
        attn: header.attn,
        tel: header.tel,
        terms: header.terms,
        ref1: header.ref1,
        ref2: header.ref2,
        grand_total: total,
        items: items.map(idx => ({
          desc: idx.description,
          po_no: '',
          qty: idx.qty,
          uom: idx.uom,
          price: idx.uprice,
          total: idx.subtotal
        }))
      }

      const result = await window.api.quotations.exportPdf(payload)
      if (result.ok) {
        const folder = result.path ? result.path.replace(/[\\/][^\\/]+$/, '') : ''
        setToast({ show: true, message: 'Quotation PDF exported!', folderPath: folder })
        setTimeout(() => setToast(t => ({ ...t, show: false })), 6000)
      }
    } catch (err) {
      console.error('[Editor] Export PDF error:', err)
      setToast({ show: true, message: err.message || 'Error exporting PDF' })
    } finally {
      setExporting(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-accent" size={32}/></div>
  }

  return (
    <>
    <div className="flex flex-col h-full bg-bg">
      {/* ── Top Bar ─────────────────────────────────────────────────────── */}
      <div className="flex-none px-10 py-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-white border border-border text-ink-2 hover:bg-gray-50 transition-colors shadow-sm"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-ink">
              {id ? 'Edit Quotation' : 'New Quotation'}
            </h1>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <select
            value={header.status}
            onChange={(e) => handleHeaderChange('status', e.target.value)}
            className={`h-10 px-3 pl-4 pr-8 rounded-lg font-bold text-sm appearance-none border-0 ring-1 ring-inset cursor-pointer transition-shadow focus:ring-2 focus:ring-accent
              ${header.status === 'Draft' ? 'bg-gray-100 text-gray-700 ring-gray-200' : ''}
              ${header.status === 'Sent' ? 'bg-blue-50 text-blue-700 ring-blue-200' : ''}
              ${header.status === 'Accepted' ? 'bg-green-50 text-green-700 ring-green-200' : ''}
              ${header.status === 'Rejected' ? 'bg-red-50 text-red-700 ring-red-200' : ''}
              ${header.status === 'Invoiced' ? 'bg-purple-50 text-purple-700 ring-purple-200' : ''}
            `}
          >
            {STATUS_OPTS.map(s => <option key={s}>{s}</option>)}
          </select>
          <button 
            onClick={handleExportPdf}
            disabled={exporting}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-ink-2 bg-white border border-border hover:bg-gray-50 rounded-lg transition-colors shadow-sm disabled:opacity-50">
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}
            Export PDF
          </button>
          {id && (
            <button 
              onClick={handleConvertToInvoiceClick}
              disabled={converting || header.status === 'Invoiced'}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors shadow-sm disabled:opacity-50">
              {converting ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              Convert to Invoice
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2 text-sm font-bold text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors shadow-sm disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save
          </button>
        </div>
      </div>

      {/* ── Scrollable Form Area ──────────────────────────────────────── */}
      <div className="flex-1 overflow-auto px-10 pb-20">
        
        {/* Header Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr] gap-6 mb-8">
          
          {/* Bill To Card */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-border">
            <h3 className="text-[11px] font-extrabold text-ink-muted uppercase tracking-widest mb-4">Bill To</h3>
            
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <input
                    placeholder="Type to search customers…"
                    list="qt-customer-datalist"
                    value={header.customer}
                    onChange={handleCustomerChange}
                    className="w-full h-11 px-4 bg-[#f5f5f7] rounded-xl border-0 text-[15px] font-semibold text-ink focus:ring-2 focus:ring-accent transition-shadow placeholder:font-medium placeholder:text-ink-muted"
                  />
                  <datalist id="qt-customer-datalist">
                    {customerList.map(c => (
                      <option key={c.id || c.name} value={c.name}>
                        {c.acc_code} — {c.name}
                      </option>
                    ))}
                  </datalist>
                </div>
              </div>
              <div>
                <textarea
                  placeholder="Billing Address"
                  value={header.address}
                  onChange={(e) => handleHeaderChange('address', e.target.value)}
                  className="w-full p-4 bg-[#f5f5f7] rounded-xl border-0 text-[14px] leading-relaxed text-ink focus:ring-2 focus:ring-accent transition-shadow min-h-[90px] resize-none placeholder:text-ink-muted"
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <input
                    placeholder="Attention (Attn)"
                    value={header.attn}
                    onChange={(e) => handleHeaderChange('attn', e.target.value)}
                    className="w-full h-11 px-4 bg-[#f5f5f7] rounded-xl border-0 text-[14px] text-ink focus:ring-2 focus:ring-accent transition-shadow placeholder:text-ink-muted"
                  />
                </div>
                <div className="flex-1">
                  <input
                    placeholder="Telephone"
                    value={header.tel}
                    onChange={(e) => handleHeaderChange('tel', e.target.value)}
                    className="w-full h-11 px-4 bg-[#f5f5f7] rounded-xl border-0 text-[14px] text-ink focus:ring-2 focus:ring-accent transition-shadow placeholder:text-ink-muted"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Document Properties Card */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-border">
            <h3 className="text-[11px] font-extrabold text-ink-muted uppercase tracking-widest mb-4">Document</h3>
            
            <div className="space-y-3">
              {[
                { label: 'QT NO:', field: 'quotation_no' },
                { label: 'DATE:', field: 'date', type: 'date' },
                { label: 'TERMS:', field: 'terms' },
                { label: 'REF 1:', field: 'ref1' },
                { label: 'REF 2:', field: 'ref2' },
              ].map((prop) => (
                <div key={prop.field} className="flex grid grid-cols-[80px_1fr] items-center gap-4">
                  <span className="text-[12px] font-bold text-ink-muted text-right tracking-wide">{prop.label}</span>
                    <input
                      type={prop.type || 'text'}
                      value={header[prop.field]}
                      onChange={(e) => handleHeaderChange(prop.field, e.target.value)}
                      className="h-9 px-3 bg-[#f5f5f7] rounded-lg border-0 text-[13px] font-medium text-ink focus:ring-2 focus:ring-accent transition-shadow w-full"
                    />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Line Items Table ──────────────────────────────────────────── */}
        <div className="bg-white rounded-[24px] shadow-sm border border-border">
          
          {/* Table Header */}
          <div className="grid grid-cols-[3fr_60px_60px_100px_120px_40px] gap-4 px-6 py-4 bg-[#f9fafb] border-b border-border text-[11px] font-extrabold text-ink-muted uppercase tracking-widest">
            <div>Description</div>
            <div className="text-center">Qty</div>
            <div className="text-center">UOM</div>
            <div className="text-right">Price (RM)</div>
            <div className="text-right">Subtotal</div>
            <div></div>
          </div>

          <div className="flex flex-col">
            {items.map((it, idx) => {
              const matches = productList.filter(p => !it.description || p.description.toLowerCase().includes(it.description.toLowerCase()))
              const showDropdown = focusedRow === it.id && matches.length > 0
              
              return (
              <div key={it.id} className="grid grid-cols-[3fr_60px_60px_100px_120px_40px] items-start gap-4 p-4 border-b border-gray-100 last:border-0 hover:bg-[#fcfcfd] transition-colors group">
                {/* Description */}
                <div className="relative w-full">
                  <textarea
                    autoFocus={autoFocusRow === it.id}
                    value={it.description}
                    onChange={(e) => updateItem(it.id, 'description', e.target.value)}
                    onFocus={() => {
                      setFocusedRow(it.id)
                      setAutoFocusRow(null)
                    }}
                    onBlur={() => setTimeout(() => setFocusedRow(null), 200)}
                    className="w-full p-3 bg-transparent hover:bg-gray-50 focus:bg-white rounded-lg border border-transparent focus:border-accent/30 text-[14px] text-ink focus:ring-4 focus:ring-accent/10 transition-all min-h-[44px] leading-relaxed resize-none"
                    rows={1}
                    onInput={(e) => {
                      e.target.style.height = 'auto';
                      e.target.style.height = e.target.scrollHeight + 'px';
                    }}
                  />
                  {showDropdown && (
                    <div className="absolute top-full left-0 z-50 w-[400px] mt-1 bg-white border border-border shadow-xl rounded-xl max-h-64 overflow-auto py-1">
                      {matches.map(p => (
                        <div 
                          key={p.id}
                          className="px-4 py-2.5 hover:bg-accent-light cursor-pointer flex flex-col gap-0.5"
                          onClick={() => {
                            setItems(prev => prev.map(oldIt => {
                              if (oldIt.id !== it.id) return oldIt
                              const curr = { ...oldIt, description: p.description }
                              if (p.uom) curr.uom = p.uom
                              
                              if (p.default_qty !== null && p.default_qty !== undefined && p.default_qty !== '') {
                                curr.qty = p.default_qty.toString()
                              } else if (!curr.qty) {
                                curr.qty = '1'
                              }
                              
                              if (p.unit_price !== null && p.unit_price !== undefined) {
                                let upStr = p.unit_price.toString()
                                curr.uprice = (upStr === '0' || upStr === '0.00' || upStr === '') ? '-' : upStr
                              }
                              
                              // Directly map Total Price if it exists in the database
                              if (p.default_total !== null && p.default_total !== undefined && p.default_total !== '') {
                                curr.subtotal = p.default_total.toString()
                              } else if (curr.uprice && curr.uprice !== '-') {
                                const q = parseFloat(curr.qty) || 1
                                const pr = parseFloat(curr.uprice) || 0
                                curr.subtotal = (q * pr).toFixed(2)
                              }
                              return curr
                            }))
                            setFocusedRow(null)
                          }}
                        >
                          <div className="text-[13px] font-semibold text-ink">{p.description}</div>
                          <div className="text-[11px] font-mono text-ink-muted flex items-center gap-2">
                            {p.item_code && <span>{p.item_code} • </span>}
                            <span>{p.uom || '-'}</span>
                            <span className="font-semibold text-accent ml-auto">
                              {p.unit_price === '-' 
                                ? 'LUMP SUM' 
                                : `RM ${Number(p.unit_price || 0).toFixed(2)}`}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Qty */}
                <div>
                  <input
                    type="number"
                    value={it.qty || ''}
                    onChange={(e) => updateItem(it.id, 'qty', e.target.value)}
                    className="w-full h-11 px-2 text-center bg-transparent hover:bg-gray-50 focus:bg-white rounded-lg border border-transparent focus:border-accent/30 text-[14px] font-medium text-ink focus:ring-4 focus:ring-accent/10 transition-all font-mono"
                  />
                </div>

                {/* UOM */}
                <div className="relative">
                  <input
                    className="peer w-full h-11 text-[13px] text-ink font-bold bg-[#f5f5f7] hover:bg-[#ebebef] focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 rounded-lg px-2 text-center uppercase pr-5 transition-all border-0"
                    placeholder="PCS"
                    value={it.uom}
                    onChange={(e) => updateItem(it.id, 'uom', e.target.value)}
                  />
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none transition-transform peer-focus:rotate-180" />
                  
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-[110px] mt-1 bg-white border border-border rounded-xl shadow-xl z-50 overflow-hidden hidden peer-focus:block">
                    <div className="max-h-48 overflow-y-auto py-1">
                      {UOM_OPTS.map(u => (
                        <div 
                          key={u} 
                          onMouseDown={(e) => {
                            e.preventDefault();
                            updateItem(it.id, 'uom', u);
                            document.activeElement?.blur();
                          }} 
                          className="px-3 py-2 text-[12px] font-bold text-ink hover:bg-accent-light hover:text-accent cursor-pointer transition-colors text-center"
                        >
                          {u}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Unit Price */}
                <div>
                  <input
                    type="text"
                    value={it.uprice || ''}
                    onChange={(e) => updateItem(it.id, 'uprice', e.target.value)}
                    placeholder="-"
                    className="w-full h-11 px-3 text-right bg-transparent hover:bg-gray-50 focus:bg-white rounded-lg border border-transparent focus:border-accent/30 text-[14px] font-medium text-ink focus:ring-4 focus:ring-accent/10 transition-all font-mono"
                  />
                </div>

                {/* Subtotal View */}
                <div>
                  <input
                    type="number"
                    step="any"
                    value={it.subtotal || ''}
                    onChange={(e) => updateItem(it.id, 'subtotal', e.target.value)}
                    className="w-full h-11 px-3 text-right bg-transparent hover:bg-gray-50 focus:bg-white rounded-lg border border-transparent focus:border-accent/30 text-[15px] font-bold text-ink focus:ring-4 focus:ring-accent/10 transition-all font-mono"
                    placeholder="0.00"
                  />
                </div>

                {/* Remove Line Action */}
                <div className="h-11 flex items-center justify-center">
                  <button
                    onClick={() => removeItem(it.id)}
                    className="p-1.5 text-ink-muted hover:bg-red-50 hover:text-red-500 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              )
            })}
          </div>

          {/* Table Footer Controls */}
          <div className="p-4 border-t border-border bg-[#fcfcfd] flex items-center justify-between">
            <button
              onClick={addItem}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-accent hover:bg-accent-light rounded-lg transition-colors"
            >
              <Plus size={16} />
              Add Line Item
            </button>
            <div className="flex items-center gap-6 mr-[170px]">
              <span className="text-[13px] font-bold text-ink-muted uppercase tracking-wider">Grand Total</span>
              <span className="text-3xl font-extrabold text-accent font-mono tracking-tight">
                {Number(total).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits:2})}
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>

    {/* Modals */}
    {showConvertModal && (
      <ConfirmModal
        title="Convert to Invoice?"
        message={`Are you sure you want to convert Quotation ${header.quotation_no} to a new Invoice? This status will be updated to 'Invoiced'.`}
        onConfirm={confirmConvertToInvoice}
        onCancel={() => setShowConvertModal(false)}
        loading={converting}
      />
    )}


    {/* Toast */}
    {toast.show && (
      <div className="fixed bottom-6 right-6 z-50 animate-[slideUp_0.3s_ease-out]">
        <div className="bg-ink text-white rounded-2xl shadow-2xl px-5 py-4 flex items-center gap-4 min-w-[320px]">
          <div className="w-9 h-9 rounded-xl bg-green-500/20 flex items-center justify-center shrink-0">
            <FileText size={18} className="text-green-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">{toast.message}</p>
            {toast.folderPath && (
              <button onClick={() => window.api.openFolder(toast.folderPath)} className="text-xs text-blue-300 hover:underline mt-1 flex items-center gap-1">
                <FolderOpen size={12} /> Open Folder
              </button>
            )}
          </div>
          <button onClick={() => setToast(t => ({...t, show: false}))} className="text-white/50 hover:text-white"><X size={16} /></button>
        </div>
        <style>{`@keyframes slideUp { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) }}`}</style>
      </div>
    )}

    </>
  )
}
