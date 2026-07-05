import React, { useState, useEffect } from 'react';

const API_BASE = '/api';

export default function PublicForm({ slug }) {
  const [formConfig, setFormConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Submit state
  const [inputs, setInputs] = useState({ fullName: '', email: '' });
  const [countryCode, setCountryCode] = useState('+1');
  const [mobileNumber, setMobileNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Fetch form configuration by slug
    fetch(`${API_BASE}/forms/${slug}`)
      .then(res => {
        if (!res.ok) {
          throw new Error('Form not found or has been disabled by administrators.');
        }
        return res.json();
      })
      .then(data => {
        setFormConfig(data);
      })
      .catch(err => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [slug]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputs.fullName || !inputs.email || !mobileNumber) {
      alert('Please fill out all fields.');
      return;
    }

    setSubmitting(true);

    fetch(`${API_BASE}/public/form/${slug}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: inputs.fullName,
        email: inputs.email,
        mobile: `${countryCode}${mobileNumber}`
      })
    })
      .then(res => {
        if (!res.ok) throw new Error('Submission server error');
        return res.json();
      })
      .then(() => {
        setSuccess(true);
      })
      .catch(err => {
        alert('Failed to submit form: ' + err.message);
      })
      .finally(() => {
        setSubmitting(false);
      });
  };

  if (loading) {
    return (
      <div className="public-form-container">
        <div className="glass-card public-card" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--accent-purple)', borderRadius: '50%', animation: 'pulseCheck 1s linear infinite', margin: '0 auto 1rem auto' }}></div>
            <p style={{ color: 'var(--text-secondary)' }}>Retrieving form configuration...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="public-form-container">
        <div className="glass-card public-card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="1.5" style={{ marginBottom: '1.5rem', background: 'rgba(239,68,68,0.1)', padding: '0.75rem', borderRadius: '50%' }}><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <h2 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Link Unavailable</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="public-form-container">
      <div className="glass-card public-card">
        {success ? (
          <div className="success-wrapper">
            <div className="checkmark-circle">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h2>Submission Complete!</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.75rem', fontSize: '0.95rem' }}>
              Thank you, <strong>{inputs.fullName}</strong>. Your response was logged in our system. Notifications are active and processing.
            </p>
          </div>
        ) : (
          <div>
            <div className="public-header">
              <h2>{formConfig.name}</h2>
              <p>Please enter your contact details below to proceed.</p>
            </div>

             <form onSubmit={handleSubmit}>
              <div className="form-field-group">
                <label className="field-label">Full Name</label>
                <input 
                  type="text" 
                  placeholder="John Doe" 
                  required 
                  className="field-control" 
                  value={inputs.fullName} 
                  onChange={e => setInputs({ ...inputs, fullName: e.target.value })} 
                />
              </div>

              <div className="form-field-group" style={{ marginTop: '1.25rem' }}>
                <label className="field-label">Email Address</label>
                <input 
                  type="email" 
                  placeholder="john@example.com" 
                  required 
                  className="field-control" 
                  value={inputs.email} 
                  onChange={e => setInputs({ ...inputs, email: e.target.value })} 
                />
              </div>

              <div className="form-field-group" style={{ marginTop: '1.25rem', marginBottom: '1.5rem' }}>
                <label className="field-label">Mobile Number</label>
                <div className="phone-input-wrapper">
                  <div className="phone-select-container">
                    <select 
                      value={countryCode} 
                      onChange={e => setCountryCode(e.target.value)}
                      className="phone-select"
                    >
                      <option value="+1">US +1</option>
                      <option value="+91">IN +91</option>
                      <option value="+44">UK +44</option>
                      <option value="+61">AU +61</option>
                      <option value="+49">DE +49</option>
                      <option value="+33">FR +33</option>
                      <option value="+971">AE +971</option>
                      <option value="+55">BR +55</option>
                      <option value="+52">MX +52</option>
                      <option value="+27">ZA +27</option>
                      <option value="+65">SG +65</option>
                      <option value="+81">JP +81</option>
                      <option value="+86">CN +86</option>
                      <option value="+34">ES +34</option>
                      <option value="+39">IT +39</option>
                      <option value="+7">RU +7</option>
                      <option value="+54">AR +54</option>
                      <option value="+966">SA +966</option>
                      <option value="+82">KR +82</option>
                      <option value="+90">TR +90</option>
                    </select>
                    <div className="phone-select-arrow">▼</div>
                  </div>
                  <input 
                    type="tel" 
                    placeholder="201 555 0123" 
                    required 
                    className="phone-control" 
                    value={mobileNumber} 
                    onChange={e => setMobileNumber(e.target.value)} 
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '1rem', marginTop: '1rem', fontSize: '1rem' }} disabled={submitting}>
                {submitting ? 'Sending Form Data...' : 'Submit Profile'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
