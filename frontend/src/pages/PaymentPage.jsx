import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = '/api';
const USD_TO_INR_RATE = 83.0;

export default function PaymentPage({ token }) {
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [selectedGateway, setSelectedGateway] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/payments/${token}`)
      .then(res => {
        if (!res.ok) throw new Error('Payment link not found or has expired.');
        return res.json();
      })
      .then(data => {
        setPayment(data);
        if (data.status === 'PAID') setSuccess(true);
        // Auto-select first available gateway
        if (data.currency === 'USD') {
          setSelectedGateway('upi');
        } else {
          if (data.razorpay_enabled) setSelectedGateway('razorpay');
          else if (data.upi_enabled) setSelectedGateway('upi');
          else if (data.paypal_enabled) setSelectedGateway('paypal');
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  const formatAmount = useCallback((amount, currency) => {
    const symbol = currency === 'INR' ? '₹' : '$';
    return `${symbol}${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, []);

  // ── Razorpay Checkout Handler ──
  const handleRazorpay = async (method) => {
    setProcessing(true);
    try {
      const gateway = method === 'upi' ? 'upi' : 'razorpay';
      const orderRes = await fetch(`${API_BASE}/payments/${token}/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gateway })
      });
      if (!orderRes.ok) throw new Error('Failed to create order');
      const orderData = await orderRes.json();

      const options = {
        key: payment.razorpay_key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: payment.form_name,
        description: payment.description,
        order_id: orderData.order_id,
        handler: async function (response) {
          try {
            const verifyRes = await fetch(`${API_BASE}/payments/${token}/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                gateway,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });
            if (verifyRes.ok) {
              setSuccess(true);
            } else {
              const err = await verifyRes.json();
              alert('Payment verification failed: ' + (err.detail || 'Unknown error'));
            }
          } catch (e) {
            alert('Verification error: ' + e.message);
          }
          setProcessing(false);
        },
        modal: { ondismiss: () => setProcessing(false) },
        theme: { color: '#8b5cf6' }
      };

      // Force UPI method if selected
      if (method === 'upi') {
        options.config = {
          display: {
            blocks: {
              upi: { name: "Pay via UPI", instruments: [{ method: "upi" }] }
            },
            sequence: ["block.upi"],
            preferences: { show_default_blocks: false }
          }
        };
      }

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (resp) {
        alert('Payment failed: ' + resp.error.description);
        setProcessing(false);
      });
      rzp.open();
    } catch (e) {
      alert('Error: ' + e.message);
      setProcessing(false);
    }
  };

  // ── PayPal Handler ──
  const handlePayPal = async () => {
    setProcessing(true);
    try {
      const orderRes = await fetch(`${API_BASE}/payments/${token}/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gateway: 'paypal' })
      });
      if (!orderRes.ok) throw new Error('Failed to create PayPal order');
      const orderData = await orderRes.json();

      // Redirect to PayPal approval URL
      const paypalBase = payment.paypal_mode === 'live'
        ? 'https://www.paypal.com'
        : 'https://www.sandbox.paypal.com';
      
      const approvalUrl = `${paypalBase}/checkoutnow?token=${orderData.order_id}`;
      
      // Store token for callback verification
      sessionStorage.setItem('paypal_payment_token', token);
      sessionStorage.setItem('paypal_order_id', orderData.order_id);
      
      window.location.href = approvalUrl;
    } catch (e) {
      alert('PayPal Error: ' + e.message);
      setProcessing(false);
    }
  };

  // ── Handle PayPal return ──
  useEffect(() => {
    const storedToken = sessionStorage.getItem('paypal_payment_token');
    const storedOrderId = sessionStorage.getItem('paypal_order_id');
    
    if (storedToken === token && storedOrderId && !success) {
      // User returned from PayPal — verify payment
      sessionStorage.removeItem('paypal_payment_token');
      sessionStorage.removeItem('paypal_order_id');
      
      setProcessing(true);
      fetch(`${API_BASE}/payments/${token}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gateway: 'paypal', paypal_order_id: storedOrderId })
      })
        .then(res => {
          if (res.ok) {
            setSuccess(true);
          } else {
            return res.json().then(d => { throw new Error(d.detail || 'Verification failed'); });
          }
        })
        .catch(e => alert('PayPal verification error: ' + e.message))
        .finally(() => setProcessing(false));
    }
  }, [token, success]);

  // ── Loading State ──
  if (loading) {
    return (
      <div className="payment-container">
        <div className="payment-card glass-card">
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
            <div className="payment-spinner"></div>
          </div>
        </div>
      </div>
    );
  }

  // ── Error State ──
  if (error) {
    return (
      <div className="payment-container">
        <div className="payment-card glass-card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <div className="payment-error-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          </div>
          <h2 style={{ marginTop: '1rem', color: '#f8fafc' }}>Link Unavailable</h2>
          <p style={{ color: '#94a3b8', marginTop: '0.5rem' }}>{error}</p>
        </div>
      </div>
    );
  }

  // ── Success State ──
  if (success) {
    return (
      <div className="payment-container">
        <div className="payment-card glass-card payment-success-card">
          <div className="payment-success-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h2 style={{ color: '#f8fafc', marginTop: '1.25rem', fontSize: '1.6rem' }}>Payment Successful!</h2>
          <p style={{ color: '#94a3b8', marginTop: '0.75rem', lineHeight: '1.6' }}>
            Your payment of <strong style={{ color: '#10b981' }}>{formatAmount(payment.amount, payment.currency)}</strong> has been confirmed.
          </p>
          <div className="payment-receipt-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <span>Transaction verified & recorded</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Payment Page ──
  const isUSD = payment.currency === 'USD';

  return (
    <div className="payment-container">
      <div className="payment-card glass-card">
        {/* Header */}
        <div className="payment-header">
          {isUSD ? (
            <>
              <span className="payment-label">Original Amount Due</span>
              <div className="payment-original-amount" style={{ textDecoration: 'line-through', color: '#64748b', fontSize: '1.5rem', marginBottom: '0.25rem' }}>
                {formatAmount(payment.amount, 'USD')}
              </div>
              <span className="payment-label">Converted Amount (UPI Only)</span>
              <div className="payment-amount" style={{ color: '#10b981' }}>
                {formatAmount(payment.amount * USD_TO_INR_RATE, 'INR')}
              </div>
              <div className="payment-currency-badge" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>INR</div>
            </>
          ) : (
            <>
              <span className="payment-label">Amount Due</span>
              <div className="payment-amount">{formatAmount(payment.amount, payment.currency)}</div>
              <div className="payment-currency-badge">{payment.currency}</div>
            </>
          )}
          <p className="payment-description">{payment.form_name}</p>
        </div>

        {/* Divider */}
        <div className="payment-divider"></div>

        {/* User warning notice box if payment is USD-converted */}
        {isUSD && (
          <div className="payment-notice-box" style={{
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: '12px',
            padding: '1rem',
            color: '#f59e0b',
            fontSize: '0.85rem',
            lineHeight: '1.5',
            marginBottom: '1.5rem',
            textAlign: 'center',
            fontWeight: '500'
          }}>
            Sorry, at this moment of time we can't provide PayPal and Razorpay services. So could you please pay through the UPI in the INR only?
          </div>
        )}

        {/* Gateway Selection */}
        <div className="payment-methods">
          <span className="payment-methods-label">
            {isUSD ? "Authorized Payment Method" : "Select Payment Method"}
          </span>

          <div className="payment-gateway-grid">
            {(payment.upi_enabled || isUSD) && (
              <button
                className="payment-gateway-btn active"
                onClick={() => setSelectedGateway('upi')}
                disabled={processing}
                style={isUSD ? { borderColor: '#10b981', background: 'rgba(16, 185, 129, 0.06)' } : {}}
              >
                <div className="gateway-icon upi-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                </div>
                <span>UPI</span>
                <span className="gateway-subtitle">GPay · PhonePe · Paytm</span>
              </button>
            )}

            {payment.razorpay_enabled && !isUSD && (
              <button
                className={`payment-gateway-btn ${selectedGateway === 'razorpay' ? 'active' : ''}`}
                onClick={() => setSelectedGateway('razorpay')}
                disabled={processing}
              >
                <div className="gateway-icon razorpay-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                </div>
                <span>Razorpay</span>
                <span className="gateway-subtitle">Cards · Net Banking · Wallets</span>
              </button>
            )}

            {payment.paypal_enabled && payment.currency === 'USD' && !isUSD && (
              <button
                className={`payment-gateway-btn ${selectedGateway === 'paypal' ? 'active' : ''}`}
                onClick={() => setSelectedGateway('paypal')}
                disabled={processing}
              >
                <div className="gateway-icon paypal-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 11l5-9h5c3.3 0 6 2.7 6 6s-2.7 6-6 6h-3l-2 8H5"/></svg>
                </div>
                <span>PayPal</span>
                <span className="gateway-subtitle">PayPal Balance · Cards</span>
              </button>
            )}
          </div>
        </div>

        {/* Pay Button */}
        <button
          className="payment-pay-btn"
          disabled={!selectedGateway || processing}
          onClick={() => {
            if (selectedGateway === 'razorpay') handleRazorpay('razorpay');
            else if (selectedGateway === 'upi') handleRazorpay('upi');
            else if (selectedGateway === 'paypal') handlePayPal();
          }}
          style={isUSD ? { background: 'linear-gradient(135deg, #10b981, #059669)' } : {}}
        >
          {processing ? (
            <span className="payment-btn-loading">
              <div className="payment-spinner-small"></div>
              Processing...
            </span>
          ) : (
            isUSD ? "Proceed to Pay" : `Pay ${formatAmount(payment.amount, payment.currency)}`
          )}
        </button>

        {/* Security Badge */}
        <div className="payment-security">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <span>Secured with 256-bit SSL encryption</span>
        </div>
      </div>
    </div>
  );
}
