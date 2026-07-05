import React, { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [forms, setForms] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [paymentStats, setPaymentStats] = useState({});
  const [settings, setSettings] = useState({
    smtp_host: '', smtp_port: '', smtp_user: '', smtp_pass: '', smtp_from_name: '',
    whatsapp_token: '', whatsapp_phone_number_id: '',
    razorpay_key_id: '', razorpay_key_secret: '',
    paypal_client_id: '', paypal_client_secret: '', paypal_mode: 'sandbox'
  });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form Editor Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingForm, setEditingForm] = useState(null);
  const [emailExpanded, setEmailExpanded] = useState(false);
  const [whatsappExpanded, setWhatsappExpanded] = useState(false);
  const [paymentExpanded, setPaymentExpanded] = useState(false);
  const [formData, setFormData] = useState({
    name: '', slug: '',
    email_enabled: 0, email_subject: '', email_body: '',
    whatsapp_enabled: 0, whatsapp_mode: 'text', whatsapp_body: '',
    whatsapp_template_name: '', whatsapp_language_code: 'en_US',
    smtp_host: '', smtp_port: '', smtp_user: '', smtp_pass: '', smtp_from_name: '',
    whatsapp_token: '', whatsapp_phone_number_id: '',
    payment_enabled: 0, payment_amount: 0.0, payment_currency: 'INR',
    razorpay_enabled: 0, paypal_enabled: 0, upi_enabled: 0
  });

  // Send Payment Modal State
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payTarget, setPayTarget] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payCurrency, setPayCurrency] = useState('INR');
  const [paySending, setPaySending] = useState(false);

  // Filter Submissions State
  const [submissionFilter, setSubmissionFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');

  // Initial data loading
  useEffect(() => {
    fetchForms(); fetchSubmissions(); fetchSettings(); fetchLogs(); fetchPayments();
  }, []);

  const fetchForms = () => {
    fetch(`${API_BASE}/forms`).then(r => r.json()).then(setForms).catch(console.error);
  };
  const fetchSubmissions = () => {
    fetch(`${API_BASE}/submissions`).then(r => r.json()).then(setSubmissions).catch(console.error);
  };
  const fetchSettings = () => {
    fetch(`${API_BASE}/settings`).then(r => r.json()).then(d => {
      if (d) setSettings(prev => ({ ...prev, ...d }));
    }).catch(console.error);
  };
  const fetchLogs = () => {
    fetch(`${API_BASE}/logs`).then(r => r.json()).then(setLogs).catch(console.error);
  };
  const fetchPayments = () => {
    fetch(`${API_BASE}/payments`).then(r => r.json()).then(setPayments).catch(console.error);
    fetch(`${API_BASE}/payments/stats`).then(r => r.json()).then(setPaymentStats).catch(console.error);
  };

  const handleSaveSettings = (e) => {
    e.preventDefault();
    setLoading(true);
    fetch(`${API_BASE}/settings`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings })
    })
      .then(r => r.json())
      .then(() => { alert('Settings saved successfully!'); fetchLogs(); })
      .catch(err => alert('Failed to save settings: ' + err.message))
      .finally(() => setLoading(false));
  };

  const openFormModal = (form = null) => {
    if (form) {
      setEditingForm(form.id);
      setEmailExpanded(form.email_enabled === 1);
      setWhatsappExpanded(form.whatsapp_enabled === 1);
      setPaymentExpanded(form.payment_enabled === 1);
      setFormData({
        name: form.name || '', slug: form.slug || '',
        email_enabled: form.email_enabled || 0, email_subject: form.email_subject || '', email_body: form.email_body || '',
        whatsapp_enabled: form.whatsapp_enabled || 0, whatsapp_mode: form.whatsapp_mode || 'text',
        whatsapp_body: form.whatsapp_body || '', whatsapp_template_name: form.whatsapp_template_name || '',
        whatsapp_language_code: form.whatsapp_language_code || 'en_US',
        smtp_host: form.smtp_host || '', smtp_port: form.smtp_port || '',
        smtp_user: form.smtp_user || '', smtp_pass: form.smtp_pass || '', smtp_from_name: form.smtp_from_name || '',
        whatsapp_token: form.whatsapp_token || '', whatsapp_phone_number_id: form.whatsapp_phone_number_id || '',
        payment_enabled: form.payment_enabled || 0, payment_amount: form.payment_amount || 0.0, payment_currency: form.payment_currency || 'INR',
        razorpay_enabled: form.razorpay_enabled || 0, paypal_enabled: form.paypal_enabled || 0, upi_enabled: form.upi_enabled || 0
      });
    } else {
      setEditingForm(null);
      setEmailExpanded(false); setWhatsappExpanded(false); setPaymentExpanded(false);
      setFormData({
        name: '', slug: '',
        email_enabled: 0, email_subject: '', email_body: '',
        whatsapp_enabled: 0, whatsapp_mode: 'text', whatsapp_body: '',
        whatsapp_template_name: '', whatsapp_language_code: 'en_US',
        smtp_host: '', smtp_port: '', smtp_user: '', smtp_pass: '', smtp_from_name: '',
        whatsapp_token: '', whatsapp_phone_number_id: '',
        payment_enabled: 0, payment_amount: 0.0, payment_currency: 'INR',
        razorpay_enabled: 0, paypal_enabled: 0, upi_enabled: 0
      });
    }
    setModalOpen(true);
  };

  const handleSaveForm = (e) => {
    e.preventDefault();
    const method = editingForm ? 'PUT' : 'POST';
    const url = editingForm ? `${API_BASE}/forms/${editingForm}` : `${API_BASE}/forms`;
    fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) })
      .then(r => { if (!r.ok) throw new Error('Action failed'); return r.json(); })
      .then(() => { setModalOpen(false); fetchForms(); fetchLogs(); })
      .catch(err => alert('Failed to save form: ' + err.message));
  };

  const handleDeleteForm = (id) => {
    if (confirm('Delete this form? Submissions will remain.')) {
      fetch(`${API_BASE}/forms/${id}`, { method: 'DELETE' }).then(() => { fetchForms(); fetchLogs(); });
    }
  };

  const handleNameChange = (name) => {
    const newSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    setFormData(prev => {
      const oldSlug = prev.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const auto = !editingForm && (!prev.slug || prev.slug === oldSlug);
      return { ...prev, name, slug: auto ? newSlug : prev.slug };
    });
  };

  const copyToClipboard = (text) => { navigator.clipboard.writeText(text); alert('Copied!'); };

  // ── Send Payment Link ──
  const openPayModal = (sub) => {
    const form = forms.find(f => f.slug === sub.form_slug);
    setPayTarget(sub);
    setPayAmount('');
    setPayCurrency(form?.payment_currency || 'INR');
    setPayModalOpen(true);
  };

  const handleSendPayment = async () => {
    if (!payAmount || parseFloat(payAmount) <= 0) { alert('Enter a valid amount'); return; }
    setPaySending(true);
    try {
      const res = await fetch(`${API_BASE}/payments/send`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submission_id: payTarget.id, amount: parseFloat(payAmount), currency: payCurrency })
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Failed'); }
      const data = await res.json();
      const fullLink = `${window.location.origin}${data.payment_link}`;
      alert(`Payment link sent!\n\nLink: ${fullLink}\n\nNotifications dispatched to ${payTarget.email}`);
      setPayModalOpen(false);
      fetchPayments(); fetchLogs();
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setPaySending(false);
    }
  };

  // Metrics
  const successEmailCount = submissions.filter(s => s.email_status === 'SUCCESS').length;
  const failedEmailCount = submissions.filter(s => s.email_status === 'FAILED').length;
  const successWaCount = submissions.filter(s => s.whatsapp_status === 'SUCCESS').length;
  const failedWaCount = submissions.filter(s => s.whatsapp_status === 'FAILED').length;
  const totalAlertsSent = successEmailCount + successWaCount;

  const fmtCurrency = (val, cur) => {
    const sym = cur === 'USD' ? '$' : '₹';
    return `${sym}${Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          <span>CMS LeadFlow</span>
        </div>
        <ul className="nav-links">
          <li className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => { setActiveTab('overview'); fetchSubmissions(); fetchLogs(); fetchPayments(); }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>
            Overview
          </li>
          <li className={`nav-item ${activeTab === 'forms' ? 'active' : ''}`} onClick={() => { setActiveTab('forms'); fetchForms(); }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            Forms Manager
          </li>
          <li className={`nav-item ${activeTab === 'submissions' ? 'active' : ''}`} onClick={() => { setActiveTab('submissions'); fetchSubmissions(); }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Submissions
          </li>
          <li className={`nav-item ${activeTab === 'payments' ? 'active' : ''}`} onClick={() => { setActiveTab('payments'); fetchPayments(); }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            Payments
          </li>
          <li className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => { setActiveTab('settings'); fetchSettings(); }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            Settings
          </li>
          <li className={`nav-item ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => { setActiveTab('logs'); fetchLogs(); }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 17 10 11 15 16 22 9"/><polyline points="16 9 22 9 22 15"/></svg>
            System Logs
          </li>
        </ul>
      </aside>

      {/* Main Content */}
      <main className="main-content">

        {/* ═══════ OVERVIEW ═══════ */}
        {activeTab === 'overview' && (
          <div>
            <header>
              <div>
                <h1>Dashboard Overview</h1>
                <p className="subtitle">Real-time stats on forms, messaging & payments</p>
              </div>
              <button className="btn btn-primary" onClick={() => openFormModal()}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Create New Form
              </button>
            </header>

            <div className="metrics-grid">
              <div className="glass-card metric-card">
                <span className="metric-title">Active Forms</span>
                <span className="metric-value">{forms.length}</span>
              </div>
              <div className="glass-card metric-card">
                <span className="metric-title">Total Submissions</span>
                <span className="metric-value">{submissions.length}</span>
              </div>
              <div className="glass-card metric-card">
                <span className="metric-title">Alerts Dispatched</span>
                <span className="metric-value">{totalAlertsSent}</span>
              </div>
              <div className="glass-card metric-card">
                <span className="metric-title">Payments Received</span>
                <span className="metric-value" style={{ color: 'var(--success)' }}>{paymentStats.paid_count || 0}</span>
              </div>
              <div className="glass-card metric-card">
                <span className="metric-title">Revenue (INR)</span>
                <span className="metric-value">{fmtCurrency(paymentStats.revenue_inr, 'INR')}</span>
              </div>
              <div className="glass-card metric-card">
                <span className="metric-title">Revenue (USD)</span>
                <span className="metric-value">{fmtCurrency(paymentStats.revenue_usd, 'USD')}</span>
              </div>
            </div>

            <div className="glass-card">
              <h3>Recent Submissions</h3>
              <div className="table-container">
                <table>
                  <thead><tr><th>Date</th><th>Form</th><th>Name</th><th>Email</th><th>Mobile</th><th>Email</th><th>WhatsApp</th></tr></thead>
                  <tbody>
                    {submissions.slice(0, 10).map(sub => (
                      <tr key={sub.id}>
                        <td>{new Date(sub.created_at).toLocaleString()}</td>
                        <td><span className="form-meta-tag">{sub.form_slug}</span></td>
                        <td style={{ fontWeight: '600' }}>{sub.full_name}</td>
                        <td>{sub.email}</td>
                        <td>{sub.mobile}</td>
                        <td><span className={`badge badge-${sub.email_status.toLowerCase()}`}>{sub.email_status}</span></td>
                        <td><span className={`badge badge-${sub.whatsapp_status.toLowerCase()}`}>{sub.whatsapp_status}</span></td>
                      </tr>
                    ))}
                    {submissions.length === 0 && (
                      <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>No submissions received yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ═══════ FORMS MANAGER ═══════ */}
        {activeTab === 'forms' && (
          <div>
            <header>
              <div>
                <h1>Form Manager</h1>
                <p className="subtitle">Configure forms and link-level messaging templates</p>
              </div>
              <button className="btn btn-primary" onClick={() => openFormModal()}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Create New Form
              </button>
            </header>

            <div className="forms-list-grid">
              {forms.map(form => {
                const formUrl = `${window.location.origin}/form/${form.slug}`;
                return (
                  <div key={form.id} className="glass-card form-item-card">
                    <div className="form-header">
                      <div>
                        <h3 style={{ fontSize: '1.2rem', marginBottom: '0.25rem' }}>{form.name}</h3>
                        <span className="form-meta-tag">slug: {form.slug}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span className={`badge ${form.email_enabled ? 'badge-success' : 'badge-skipped'}`}>Email</span>
                        <span className={`badge ${form.whatsapp_enabled ? 'badge-success' : 'badge-skipped'}`}>WA</span>
                        <span className={`badge ${form.payment_enabled ? 'badge-paid' : 'badge-skipped'}`}>Pay</span>
                      </div>
                    </div>

                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <strong>Active URL:</strong>
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', alignItems: 'center' }}>
                        <input readOnly value={formUrl} className="form-control" style={{ flex: 1, padding: '0.35rem 0.5rem', fontSize: '0.75rem', height: 'auto', background: 'rgba(0,0,0,0.15)' }} />
                        <button className="btn btn-secondary btn-sm" onClick={() => copyToClipboard(formUrl)} title="Copy URL">Copy</button>
                      </div>
                    </div>

                    <div className="form-actions-row">
                      <button className="btn btn-secondary btn-sm" onClick={() => window.open(formUrl, '_blank')}>Open Live</button>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openFormModal(form)}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDeleteForm(form.id)}>Delete</button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {forms.length === 0 && (
                <div className="glass-card" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem' }}>
                  <h3>No forms generated yet</h3>
                  <p style={{ color: 'var(--text-secondary)', margin: '0.5rem 0 1.5rem 0' }}>Create your first dynamic form.</p>
                  <button className="btn btn-primary" onClick={() => openFormModal()}>Create Your First Form</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════ SUBMISSIONS ═══════ */}
        {activeTab === 'submissions' && (
          <div>
            <header>
              <div>
                <h1>Submissions Grid</h1>
                <p className="subtitle">Customer profiles with payment link actions</p>
              </div>
              <div style={{ display: 'flex', gap: '1rem', width: '300px' }}>
                <input type="text" placeholder="Filter by Form Slug..." className="form-control" value={submissionFilter} onChange={e => setSubmissionFilter(e.target.value)} style={{ width: '100%', padding: '0.5rem 1rem' }} />
              </div>
            </header>

            <div className="glass-card">
              <div className="table-container">
                <table>
                  <thead><tr><th>Date</th><th>Form</th><th>Name</th><th>Email</th><th>Mobile</th><th>Email</th><th>WA</th><th>Action</th></tr></thead>
                  <tbody>
                    {submissions
                      .filter(s => s.form_slug.toLowerCase().includes(submissionFilter.toLowerCase()))
                      .map(sub => {
                        const form = forms.find(f => f.slug === sub.form_slug);
                        const paymentEnabled = form?.payment_enabled === 1;
                        const existingPayments = payments.filter(p => p.submission_id === sub.id);
                        const hasPaid = existingPayments.some(p => p.status === 'PAID');
                        const hasPending = existingPayments.some(p => p.status === 'PENDING' || p.status === 'PROCESSING');
                        return (
                          <tr key={sub.id}>
                            <td>{new Date(sub.created_at).toLocaleString()}</td>
                            <td><span className="form-meta-tag">{sub.form_slug}</span></td>
                            <td style={{ fontWeight: '600' }}>{sub.full_name}</td>
                            <td>{sub.email}</td>
                            <td>{sub.mobile}</td>
                            <td><span className={`badge badge-${sub.email_status.toLowerCase()}`}>{sub.email_status}</span></td>
                            <td><span className={`badge badge-${sub.whatsapp_status.toLowerCase()}`}>{sub.whatsapp_status}</span></td>
                            <td>
                              {paymentEnabled ? (
                                hasPaid ? (
                                  <span className="badge badge-paid">PAID</span>
                                ) : hasPending ? (
                                  <span className="badge badge-pending">PENDING</span>
                                ) : (
                                  <button className="btn btn-payment btn-sm" onClick={() => openPayModal(sub)}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                                    Send Payment
                                  </button>
                                )
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    {submissions.length === 0 && (
                      <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2rem' }}>No data records.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ═══════ PAYMENTS ═══════ */}
        {activeTab === 'payments' && (
          <div>
            <header>
              <div>
                <h1>Payment Tracker</h1>
                <p className="subtitle">Real-time payment status and revenue analytics</p>
              </div>
              <button className="btn btn-secondary" onClick={fetchPayments}>Refresh</button>
            </header>

            <div className="metrics-grid">
              <div className="glass-card metric-card">
                <span className="metric-title">Total Payments</span>
                <span className="metric-value">{paymentStats.total || 0}</span>
              </div>
              <div className="glass-card metric-card">
                <span className="metric-title">Paid</span>
                <span className="metric-value" style={{ color: 'var(--success)' }}>{paymentStats.paid_count || 0}</span>
              </div>
              <div className="glass-card metric-card">
                <span className="metric-title">Pending</span>
                <span className="metric-value" style={{ color: '#f59e0b' }}>{paymentStats.pending_count || 0}</span>
              </div>
              <div className="glass-card metric-card">
                <span className="metric-title">Failed</span>
                <span className="metric-value" style={{ color: 'var(--error)' }}>{paymentStats.failed_count || 0}</span>
              </div>
              <div className="glass-card metric-card">
                <span className="metric-title">Revenue (INR)</span>
                <span className="metric-value">{fmtCurrency(paymentStats.revenue_inr, 'INR')}</span>
              </div>
              <div className="glass-card metric-card">
                <span className="metric-title">Revenue (USD)</span>
                <span className="metric-value">{fmtCurrency(paymentStats.revenue_usd, 'USD')}</span>
              </div>
            </div>

            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3>Payment Records</h3>
                <input type="text" placeholder="Filter..." className="form-control" style={{ width: '200px', padding: '0.4rem 0.8rem' }} value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)} />
              </div>
              <div className="table-container">
                <table>
                  <thead><tr><th>Date</th><th>Form</th><th>Name</th><th>Amount</th><th>Gateway</th><th>Status</th><th>Payment ID</th></tr></thead>
                  <tbody>
                    {payments
                      .filter(p => (p.form_slug + (p.full_name || '') + (p.gateway || '')).toLowerCase().includes(paymentFilter.toLowerCase()))
                      .map(p => (
                        <tr key={p.id}>
                          <td>{new Date(p.created_at).toLocaleString()}</td>
                          <td><span className="form-meta-tag">{p.form_slug}</span></td>
                          <td style={{ fontWeight: '600' }}>{p.full_name || '—'}</td>
                          <td style={{ fontWeight: '600' }}>{fmtCurrency(p.amount, p.currency)}</td>
                          <td>
                            {p.gateway ? (
                              <span className={`badge badge-gateway-${p.gateway}`}>{p.gateway.toUpperCase()}</span>
                            ) : '—'}
                          </td>
                          <td><span className={`badge badge-${p.status.toLowerCase()}`}>{p.status}</span></td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            {p.gateway_payment_id ? p.gateway_payment_id.slice(0, 20) + '...' : '—'}
                          </td>
                        </tr>
                      ))}
                    {payments.length === 0 && (
                      <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>No payments recorded yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ═══════ SETTINGS ═══════ */}
        {activeTab === 'settings' && (
          <div>
            <header>
              <div>
                <h1>Global Settings</h1>
                <p className="subtitle">SMTP, WhatsApp, Razorpay & PayPal credentials</p>
              </div>
            </header>

            <form onSubmit={handleSaveSettings} className="settings-section">
              <div className="settings-grid">
                {/* SMTP */}
                <div className="glass-card">
                  <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.25rem', color: 'var(--accent-purple)' }}>Gmail SMTP</h3>
                  <div className="form-group">
                    <label>SMTP Host</label>
                    <input type="text" placeholder="smtp.gmail.com" required className="form-control" value={settings.smtp_host} onChange={e => setSettings({...settings, smtp_host: e.target.value})} />
                  </div>
                  <div className="form-row">
                    <div className="form-group"><label>SMTP Port</label><input type="text" placeholder="465" required className="form-control" value={settings.smtp_port} onChange={e => setSettings({...settings, smtp_port: e.target.value})} /></div>
                    <div className="form-group"><label>Sender Name</label><input type="text" placeholder="Acme CMS" className="form-control" value={settings.smtp_from_name} onChange={e => setSettings({...settings, smtp_from_name: e.target.value})} /></div>
                  </div>
                  <div className="form-group"><label>SMTP User</label><input type="email" placeholder="example@gmail.com" required className="form-control" value={settings.smtp_user} onChange={e => setSettings({...settings, smtp_user: e.target.value})} /></div>
                  <div className="form-group"><label>App Password</label><input type="password" placeholder="••••••••" required className="form-control" value={settings.smtp_pass} onChange={e => setSettings({...settings, smtp_pass: e.target.value})} /></div>
                </div>

                {/* WhatsApp */}
                <div className="glass-card">
                  <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.25rem', color: 'var(--accent-cyan)' }}>Meta WhatsApp API</h3>
                  <div className="form-group"><label>Access Token</label><input type="password" placeholder="EAABw..." required className="form-control" value={settings.whatsapp_token} onChange={e => setSettings({...settings, whatsapp_token: e.target.value})} /></div>
                  <div className="form-group"><label>Phone Number ID</label><input type="text" placeholder="102573..." required className="form-control" value={settings.whatsapp_phone_number_id} onChange={e => setSettings({...settings, whatsapp_phone_number_id: e.target.value})} /></div>
                </div>

                {/* Razorpay */}
                <div className="glass-card">
                  <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.25rem', color: '#3b82f6' }}>Razorpay Gateway</h3>
                  <div className="form-group"><label>Key ID</label><input type="text" placeholder="rzp_live_..." className="form-control" value={settings.razorpay_key_id} onChange={e => setSettings({...settings, razorpay_key_id: e.target.value})} /></div>
                  <div className="form-group"><label>Key Secret</label><input type="password" placeholder="••••••••" className="form-control" value={settings.razorpay_key_secret} onChange={e => setSettings({...settings, razorpay_key_secret: e.target.value})} /></div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                    <p>UPI payments are processed through Razorpay. Enable UPI on individual forms.</p>
                  </div>
                </div>

                {/* PayPal */}
                <div className="glass-card">
                  <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.25rem', color: '#0070ba' }}>PayPal Gateway</h3>
                  <div className="form-group"><label>Client ID</label><input type="text" placeholder="AW..." className="form-control" value={settings.paypal_client_id} onChange={e => setSettings({...settings, paypal_client_id: e.target.value})} /></div>
                  <div className="form-group"><label>Client Secret</label><input type="password" placeholder="••••••••" className="form-control" value={settings.paypal_client_secret} onChange={e => setSettings({...settings, paypal_client_secret: e.target.value})} /></div>
                  <div className="form-group">
                    <label>Mode</label>
                    <select className="form-control" value={settings.paypal_mode} onChange={e => setSettings({...settings, paypal_mode: e.target.value})}>
                      <option value="sandbox">Sandbox (Testing)</option>
                      <option value="live">Live (Production)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Saving...' : 'Save All Settings'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ═══════ LOGS ═══════ */}
        {activeTab === 'logs' && (
          <div>
            <header>
              <div>
                <h1>Audit System Logs</h1>
                <p className="subtitle">Backend event tracking for mail, WhatsApp & payments</p>
              </div>
              <button className="btn btn-secondary" onClick={fetchLogs}>Refresh</button>
            </header>

            <div className="glass-card" style={{ fontFamily: 'monospace', background: '#03050a', border: '1px solid rgba(255,255,255,0.05)', color: '#38bdf8' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '500px', overflowY: 'auto', padding: '0.5rem' }}>
                {logs.map(log => (
                  <div key={log.id} style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '0.4rem', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span className="form-meta-tag" style={{ border: 'none', background: 'rgba(255,255,255,0.05)' }}>{log.form_slug}</span>
                    <span style={{ color: log.event_type === 'EMAIL' ? 'var(--accent-purple)' : log.event_type === 'WHATSAPP' ? 'var(--accent-cyan)' : log.event_type === 'PAYMENT' ? '#f59e0b' : 'var(--text-primary)', fontWeight: '600' }}>
                      {log.event_type}
                    </span>
                    <span className={`badge badge-${log.status.toLowerCase()}`} style={{ padding: '0.1rem 0.4rem', borderRadius: '4px' }}>{log.status}</span>
                    <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{log.message}</span>
                  </div>
                ))}
                {logs.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No logs yet.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ═══════ FORM EDITOR MODAL ═══════ */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-content glass-card" onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              {editingForm ? 'Edit Form' : 'Design New Lead Form'}
            </h2>

            <form onSubmit={handleSaveForm}>
              <div className="form-group">
                <label>Form Title</label>
                <input type="text" placeholder="E.g. Webinar RSVP" required className="form-control" value={formData.name} onChange={e => handleNameChange(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Form Slug</label>
                <input type="text" placeholder="e.g. webinar-rsvp" required className="form-control" value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value})} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Link: <code>/form/{formData.slug || '[slug]'}</code></span>
              </div>

              {/* Email Alerts */}
              <div className="toggle-panel">
                <div className="toggle-header" onClick={() => setEmailExpanded(!emailExpanded)} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  <div>
                    <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span>Email Alert</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', transition: 'transform 0.2s', transform: emailExpanded ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-block' }}>▼</span>
                    </h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Send email after form submission</span>
                  </div>
                  <label className="switch" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={formData.email_enabled === 1} onChange={e => { setFormData({...formData, email_enabled: e.target.checked ? 1 : 0}); if (e.target.checked) setEmailExpanded(true); }} />
                    <span className="slider"></span>
                  </label>
                </div>
                {emailExpanded && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Email Subject</label>
                      <input type="text" placeholder="Welcome!" required className="form-control" value={formData.email_subject} onChange={e => setFormData({...formData, email_subject: e.target.value})} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Email Body</label>
                      <textarea placeholder="Hi {name}, thank you for registering! Payment link: {payment_link}" required className="form-control" value={formData.email_body} onChange={e => setFormData({...formData, email_body: e.target.value})} />
                      <div className="variables-helper">
                        Placeholders: <span className="var-tag">&#123;name&#125;</span> <span className="var-tag">&#123;email&#125;</span> <span className="var-tag">&#123;mobile&#125;</span> <span className="var-tag">&#123;form_name&#125;</span> <span className="var-tag">&#123;payment_link&#125;</span>
                      </div>
                    </div>
                    <div style={{ marginTop: '0.75rem', borderTop: '1px dashed var(--border-color)', paddingTop: '0.75rem' }}>
                      <h5 style={{ marginBottom: '0.75rem', color: 'var(--accent-purple)', fontSize: '0.9rem', fontWeight: '600' }}>SMTP Override (Optional)</h5>
                      <div className="form-row">
                        <div className="form-group" style={{ marginBottom: 0 }}><label>Sender Name</label><input type="text" placeholder="Sales Team" className="form-control" value={formData.smtp_from_name} onChange={e => setFormData({...formData, smtp_from_name: e.target.value})} /></div>
                        <div className="form-group" style={{ marginBottom: 0 }}><label>Sender Email</label><input type="email" placeholder="sales@co.com" className="form-control" value={formData.smtp_user} onChange={e => setFormData({...formData, smtp_user: e.target.value})} /></div>
                      </div>
                      <div className="form-group" style={{ marginTop: '0.75rem', marginBottom: 0 }}><label>SMTP Password</label><input type="password" placeholder="Leave empty for global" className="form-control" value={formData.smtp_pass} onChange={e => setFormData({...formData, smtp_pass: e.target.value})} /></div>
                    </div>
                  </div>
                )}
              </div>

              {/* WhatsApp Alerts */}
              <div className="toggle-panel">
                <div className="toggle-header" onClick={() => setWhatsappExpanded(!whatsappExpanded)} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  <div>
                    <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span>WhatsApp Alert</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', transition: 'transform 0.2s', transform: whatsappExpanded ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-block' }}>▼</span>
                    </h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Send WhatsApp notification</span>
                  </div>
                  <label className="switch" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={formData.whatsapp_enabled === 1} onChange={e => { setFormData({...formData, whatsapp_enabled: e.target.checked ? 1 : 0}); if (e.target.checked) setWhatsappExpanded(true); }} />
                    <span className="slider"></span>
                  </label>
                </div>
                {whatsappExpanded && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                    <div className="form-row">
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Sending Mode</label>
                        <select className="form-control" value={formData.whatsapp_mode} onChange={e => setFormData({...formData, whatsapp_mode: e.target.value})}>
                          <option value="text">Free-form Text</option>
                          <option value="template">Approved Template</option>
                        </select>
                      </div>
                      {formData.whatsapp_mode === 'template' && (
                        <div className="form-group" style={{ marginBottom: 0 }}><label>Language Code</label><input type="text" placeholder="en_US" className="form-control" value={formData.whatsapp_language_code} onChange={e => setFormData({...formData, whatsapp_language_code: e.target.value})} /></div>
                      )}
                    </div>
                    {formData.whatsapp_mode === 'template' && (
                      <div className="form-group" style={{ marginBottom: 0 }}><label>Template Name</label><input type="text" placeholder="welcome_leads" required className="form-control" value={formData.whatsapp_template_name} onChange={e => setFormData({...formData, whatsapp_template_name: e.target.value})} /></div>
                    )}
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>{formData.whatsapp_mode === 'template' ? 'Template Body Preview' : 'Message Body'}</label>
                      <textarea placeholder="Hi {name}! Payment: {payment_link}" required className="form-control" value={formData.whatsapp_body} onChange={e => setFormData({...formData, whatsapp_body: e.target.value})} />
                      <div className="variables-helper">
                        Placeholders: <span className="var-tag">&#123;name&#125;</span> <span className="var-tag">&#123;email&#125;</span> <span className="var-tag">&#123;mobile&#125;</span> <span className="var-tag">&#123;form_name&#125;</span> <span className="var-tag">&#123;payment_link&#125;</span>
                      </div>
                    </div>
                    <div style={{ marginTop: '0.75rem', borderTop: '1px dashed var(--border-color)', paddingTop: '0.75rem' }}>
                      <h5 style={{ marginBottom: '0.75rem', color: 'var(--accent-cyan)', fontSize: '0.9rem', fontWeight: '600' }}>WhatsApp Override (Optional)</h5>
                      <div className="form-group" style={{ marginBottom: 0 }}><label>Access Token</label><input type="password" placeholder="Global token" className="form-control" value={formData.whatsapp_token} onChange={e => setFormData({...formData, whatsapp_token: e.target.value})} /></div>
                      <div className="form-group" style={{ marginTop: '0.75rem', marginBottom: 0 }}><label>Phone Number ID</label><input type="text" placeholder="102573..." className="form-control" value={formData.whatsapp_phone_number_id} onChange={e => setFormData({...formData, whatsapp_phone_number_id: e.target.value})} /></div>
                    </div>
                  </div>
                )}
              </div>

              {/* ═══ Payment Configuration ═══ */}
              <div className="toggle-panel" style={{ borderColor: formData.payment_enabled ? 'rgba(59,130,246,0.3)' : 'var(--border-color)' }}>
                <div className="toggle-header" onClick={() => setPaymentExpanded(!paymentExpanded)} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  <div>
                    <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span>💳 Payment Collection</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', transition: 'transform 0.2s', transform: paymentExpanded ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-block' }}>▼</span>
                    </h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Enable sending payment links to submissions</span>
                  </div>
                  <label className="switch" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={formData.payment_enabled === 1} onChange={e => { setFormData({...formData, payment_enabled: e.target.checked ? 1 : 0}); if (e.target.checked) setPaymentExpanded(true); }} />
                    <span className="slider"></span>
                  </label>
                </div>
                {paymentExpanded && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Payment Amount</label>
                      <input type="number" step="0.01" min="0" placeholder="0.00" className="form-control" value={formData.payment_amount} onChange={e => setFormData({...formData, payment_amount: parseFloat(e.target.value) || 0})} />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Default Currency</label>
                      <select className="form-control" value={formData.payment_currency} onChange={e => setFormData({...formData, payment_currency: e.target.value})}>
                        <option value="INR">INR (₹ Indian Rupee)</option>
                        <option value="USD">USD ($ US Dollar)</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.75rem', display: 'block' }}>Payment Gateways</label>
                      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        <label className="gateway-checkbox">
                          <input type="checkbox" checked={formData.razorpay_enabled === 1} onChange={e => setFormData({...formData, razorpay_enabled: e.target.checked ? 1 : 0})} />
                          <span className="gateway-check-label">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                            Razorpay <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(INR + USD)</span>
                          </span>
                        </label>
                        <label className="gateway-checkbox">
                          <input type="checkbox" checked={formData.upi_enabled === 1} onChange={e => setFormData({...formData, upi_enabled: e.target.checked ? 1 : 0})} />
                          <span className="gateway-check-label">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/></svg>
                            UPI <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(INR only)</span>
                          </span>
                        </label>
                        <label className="gateway-checkbox">
                          <input type="checkbox" checked={formData.paypal_enabled === 1} onChange={e => setFormData({...formData, paypal_enabled: e.target.checked ? 1 : 0})} />
                          <span className="gateway-check-label">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 11l5-9h5c3.3 0 6 2.7 6 6s-2.7 6-6 6h-3l-2 8H5"/></svg>
                            PayPal <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(USD only)</span>
                          </span>
                        </label>
                      </div>
                    </div>

                    <div style={{ padding: '0.75rem', background: 'rgba(59,130,246,0.05)', borderRadius: '8px', border: '1px solid rgba(59,130,246,0.15)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>How it works:</strong> After a form is submitted, go to <em>Submissions</em> tab → click <em>"Send Payment"</em> → enter amount → payment link is sent via email/WhatsApp using the <code>&#123;payment_link&#125;</code> placeholder.
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Form</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════ SEND PAYMENT MODAL ═══════ */}
      {payModalOpen && payTarget && (
        <div className="modal-overlay" onClick={() => setPayModalOpen(false)}>
          <div className="modal-content glass-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <h2 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              💳 Send Payment Link
            </h2>

            <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '10px', padding: '1rem', marginBottom: '1.25rem', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Recipient</div>
              <div style={{ fontWeight: '600', fontSize: '1.1rem', marginTop: '0.25rem' }}>{payTarget.full_name}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.15rem' }}>{payTarget.email} · {payTarget.mobile}</div>
            </div>

            <div className="form-group">
              <label>Payment Amount</label>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <select className="form-control" style={{ width: '100px' }} value={payCurrency} onChange={e => setPayCurrency(e.target.value)}>
                  <option value="INR">₹ INR</option>
                  <option value="USD">$ USD</option>
                </select>
                <input type="number" step="0.01" min="1" placeholder="Enter amount" required className="form-control" style={{ flex: 1, fontSize: '1.2rem', fontWeight: '600' }} value={payAmount} onChange={e => setPayAmount(e.target.value)} autoFocus />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setPayModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSendPayment} disabled={paySending}>
                {paySending ? 'Sending...' : 'Send Payment Link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
