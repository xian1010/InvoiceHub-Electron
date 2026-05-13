import { useState, useEffect } from 'react'
import { Mail, Save, Server, Shield, User, Loader2, CheckCircle2, XCircle } from 'lucide-react'

export default function EmailSettings() {
  const [settings, setSettings] = useState({
    smtp_host: '',
    smtp_port: 465,
    user_email: '',
    app_password: '',
    sender_name: ''
  })
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })

  useEffect(() => {
    window.api.email.getSettings().then(data => {
      if (data) {
        setSettings({
          smtp_host: data.smtp_host || '',
          smtp_port: data.smtp_port || 465,
          user_email: data.user_email || '',
          app_password: data.app_password || '',
          sender_name: data.sender_name || ''
        })
      }
      setLoading(false)
    }).catch(err => {
      console.error('Failed to load email settings:', err)
      setLoading(false)
    })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await window.api.email.saveSettings(settings)
      setToast({ show: true, message: 'Settings saved successfully', type: 'success' })
      setTimeout(() => setToast(prev => ({...prev, show: false})), 3000)
    } catch (err) {
      console.error('Failed to save email settings:', err)
      setToast({ show: true, message: 'Failed to save settings: ' + err.message, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    
    // Auto-save before testing to make sure main process uses latest values
    await window.api.email.saveSettings(settings)
    
    try {
      const result = await window.api.email.testConnection(settings)
      setTestResult(result)
    } catch (err) {
      setTestResult({ ok: false, error: err.message })
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-accent" size={32} />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-bg overflow-auto pb-10">
      
      {/* ── Toast ──────────────────────────────────────────────────────── */}
      {toast.show && (
        <div className="fixed top-6 right-10 z-50 animate-in slide-in-from-top-4 fade-in duration-300">
          <div className={`backdrop-blur-md border shadow-xl rounded-2xl p-4 flex items-center gap-3 ${
            toast.type === 'success' ? 'bg-green-50/90 border-green-200' : 'bg-red-50/90 border-red-200'
          }`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              toast.type === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
            }`}>
              {toast.type === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
            </div>
            <div className="flex-1">
              <p className={`text-sm font-bold ${toast.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
                {toast.type === 'success' ? 'Success' : 'Error'}
              </p>
              <p className={`text-xs font-medium ${toast.type === 'success' ? 'text-green-600/80' : 'text-red-600/80'}`}>
                {toast.message}
              </p>
            </div>
            <button onClick={() => setToast(t => ({...t, show: false}))} className="text-gray-400 hover:text-gray-600">
              <XCircle size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="px-10 pt-10 pb-6 shrink-0 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold text-ink flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-inner">
              <Mail size={22} />
            </div>
            Email Settings
          </h1>
          <p className="text-[15px] text-ink-muted mt-3">
            Configure SMTP to enable auto-sending invoices and statements directly to clients.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handleTest}
            disabled={testing || saving || !settings.smtp_host}
            className="flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-gray-50 text-ink-2 shadow-sm border border-border rounded-xl font-bold transition-colors disabled:opacity-50"
          >
            {testing ? <Loader2 size={18} className="animate-spin" /> : <Server size={18} className="text-blue-500" />}
            Test Connection
          </button>
          
          <button
            onClick={handleSave}
            disabled={saving || testing}
            className="flex items-center gap-2 px-6 py-2.5 bg-accent hover:bg-accent-hover text-white shadow-sm shadow-accent/20 rounded-xl font-bold transition-all active:scale-95 disabled:opacity-50"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Save Settings
          </button>
        </div>
      </div>

      {/* ── Main Form ──────────────────────────────────────────────────── */}
      <div className="px-10 mt-2 max-w-4xl">
        
        {/* Connection Result Banner */}
        {testResult && (
          <div className={`mb-6 p-4 rounded-2xl border flex items-start gap-4 animate-in fade-in slide-in-from-top-4 ${
            testResult.ok 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${testResult.ok ? 'bg-green-200' : 'bg-red-200'}`}>
              {testResult.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
            </div>
            <div>
              <h3 className="text-[15px] font-bold">
                {testResult.ok ? 'Connection Successful!' : 'Connection Failed'}
              </h3>
              <p className={`text-[13px] font-medium mt-1 leading-relaxed ${testResult.ok ? 'text-green-700/80' : 'text-red-700/80'}`}>
                {testResult.ok 
                  ? 'Your SMTP credentials are valid. You can now bulk-send emails from the Lists view.' 
                  : testResult.error}
              </p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-3xl p-8 shadow-sm border border-border">
          <h3 className="text-[11px] font-extrabold text-ink-muted uppercase tracking-widest mb-6">SMTP Credentials</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            <div className="space-y-6">
              <div>
                <label className="block text-[13px] font-bold text-ink-muted mb-2 ml-1">SMTP Host Server</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Server size={18} className="text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={settings.smtp_host}
                    onChange={e => setSettings({...settings, smtp_host: e.target.value})}
                    placeholder="smtp.gmail.com"
                    className="w-full pl-11 pr-4 py-3 bg-[#f5f5f7] rounded-xl border-0 text-[15px] font-semibold text-ink placeholder:font-medium placeholder:text-gray-400 focus:ring-2 focus:ring-accent transition-shadow"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-bold text-ink-muted mb-2 ml-1">SMTP Port</label>
                <input
                  type="number"
                  value={settings.smtp_port}
                  onChange={e => setSettings({...settings, smtp_port: Number(e.target.value)})}
                  placeholder="465"
                  className="w-full px-4 py-3 bg-[#f5f5f7] rounded-xl border-0 text-[15px] font-semibold text-ink placeholder:font-medium placeholder:text-gray-400 focus:ring-2 focus:ring-accent transition-shadow"
                />
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-[13px] font-bold text-ink-muted mb-2 ml-1">Email Address (Username)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User size={18} className="text-gray-400" />
                  </div>
                  <input
                    type="email"
                    value={settings.user_email}
                    onChange={e => setSettings({...settings, user_email: e.target.value})}
                    placeholder="you@gmail.com"
                    className="w-full pl-11 pr-4 py-3 bg-[#f5f5f7] rounded-xl border-0 text-[15px] font-semibold text-ink placeholder:font-medium placeholder:text-gray-400 focus:ring-2 focus:ring-accent transition-shadow"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-bold text-ink-muted mb-2 ml-1">App Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Shield size={18} className="text-gray-400" />
                  </div>
                  <input
                    type="password"
                    value={settings.app_password}
                    onChange={e => setSettings({...settings, app_password: e.target.value})}
                    placeholder="••••••••••••••••"
                    className="w-full pl-11 pr-4 py-3 bg-[#f5f5f7] rounded-xl border-0 text-[15px] font-semibold text-ink placeholder:font-medium placeholder:text-gray-400 focus:ring-2 focus:ring-accent transition-shadow"
                  />
                </div>
                <p className="text-xs text-ink-muted mt-2 ml-1 font-medium leading-relaxed">
                  For Gmail, use a generated 16-character <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">App Password</a> instead of your real login password.
                </p>
              </div>
            </div>

          </div>
          
          <hr className="my-8 border-gray-100" />

          <h3 className="text-[11px] font-extrabold text-ink-muted uppercase tracking-widest mb-6">Display Settings</h3>
          <div className="max-w-md">
            <label className="block text-[13px] font-bold text-ink-muted mb-2 ml-1">Sender Name (Optional)</label>
            <input
              type="text"
              value={settings.sender_name}
              onChange={e => setSettings({...settings, sender_name: e.target.value})}
              placeholder="e.g., YS Unique Trading"
              className="w-full px-4 py-3 bg-[#f5f5f7] rounded-xl border-0 text-[15px] font-semibold text-ink placeholder:font-medium placeholder:text-gray-400 focus:ring-2 focus:ring-accent transition-shadow"
            />
          </div>

        </div>
      </div>

    </div>
  )
}
