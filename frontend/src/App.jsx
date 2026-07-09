import React, { useState, useEffect } from 'react';
import Dashboard from './pages/Dashboard';
import PublicForm from './pages/PublicForm';
import PaymentPage from './pages/PaymentPage';
import './App.css';

// Sync SHA-256 function for browser-side hashing
function sha256(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }
  
  var mathPow = Math.pow;
  var maxWord = mathPow(2, 32);
  var lengthProperty = 'length';
  var i, j;

  var result = '';

  var words = [];
  var asciiLength = ascii[lengthProperty];
  var hash = [];
  var k = [];
  var primeCounter = 0;

  var isComposite = {};
  for (var candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) {
        isComposite[i] = 1;
      }
      hash[primeCounter] = (mathPow(candidate, .5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  
  ascii += '\x80';
  while (ascii[lengthProperty] % 64 - 56) ascii += '\x00';
  for (i = 0; i < ascii[lengthProperty]; i++) {
    j = ascii.charCodeAt(i);
    if (j >> 8) return '';
    words[i >> 2] |= j << ((3 - i % 4) * 8);
  }
  words[words[lengthProperty]] = ((asciiLength * 8) / maxWord) | 0;
  words[words[lengthProperty]] = (asciiLength * 8) | 0;
  
  for (j = 0; j < words[lengthProperty]; j += 16) {
    var w = words.slice(j, j + 16);
    var oldHash = hash.slice(0);
    for (i = 0; i < 64; i++) {
      var wItem = w[i];
      if (i >= 16) {
        var s0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        var s1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        wItem = w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      
      var ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      var temp1 = (hash[7] + (rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25)) + ch + k[i] + wItem) | 0;
      var maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      var temp2 = ((rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22)) + maj) | 0;
      
      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
      hash.length = 8;
    }
    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }
  
  for (i = 0; i < 8; i++) {
    for (j = 3; j + 1; j--) {
      var b = (hash[i] >> (j * 8)) & 255;
      result += ((b < 16) ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

function App() {
  const [path, setPath] = useState(window.location.pathname);

  // Helper to change path smoothly without full page reloads
  const navigateTo = (newPath) => {
    window.history.replaceState(null, '', newPath);
    setPath(newPath);
  };

  useEffect(() => {
    const handleLocationChange = () => {
      setPath(window.location.pathname);
    };
    // Intercept standard state pops
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  // Developer / Admin backdoor to clear lock: access via ?unlock=true or ?admin=true
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has('unlock') || searchParams.has('admin')) {
      localStorage.removeItem('locked_form_slug');
      localStorage.removeItem('locked_form_hash');
      const cleanPath = window.location.pathname;
      window.history.replaceState(null, '', cleanPath);
      setPath(cleanPath);
    }
  }, [path]);

  const lockedFormSlug = localStorage.getItem('locked_form_slug');
  const lockedFormHash = localStorage.getItem('locked_form_hash');

  const isFormRoute = path.startsWith('/form/');
  const isPayRoute = path.startsWith('/pay/');

  if (lockedFormSlug) {
    const expectedHash = lockedFormHash || sha256(lockedFormSlug);
    const expectedPath = `/form/${expectedHash}`;

    if (isFormRoute) {
      const slugOrHash = path.split('/form/')[1] || '';
      
      // If slug was removed or altered to a different slug/hash, redirect back to the locked hash
      if (slugOrHash !== expectedHash && slugOrHash !== lockedFormSlug) {
        if (path !== expectedPath) {
          navigateTo(expectedPath);
          return null;
        }
      } else if (slugOrHash === lockedFormSlug) {
        // If they hit /form/soumya directly but are already locked, hash it immediately
        localStorage.setItem(`form_hash_${expectedHash}`, lockedFormSlug);
        navigateTo(expectedPath);
        return null;
      }
    } else if (!isPayRoute) {
      // If they completely removed /form/ and tried going to / or any other admin pages, redirect back
      if (path !== expectedPath) {
        navigateTo(expectedPath);
        return null;
      }
    }
  } else {
    // If no form is currently locked, check if we are entering a public form route
    if (isFormRoute) {
      const slugOrHash = path.split('/form/')[1] || '';
      if (slugOrHash) {
        const isHash = /^[a-f0-9]{64}$/i.test(slugOrHash);
        if (isHash) {
          const resolvedSlug = localStorage.getItem(`form_hash_${slugOrHash}`);
          if (resolvedSlug) {
            localStorage.setItem('locked_form_slug', resolvedSlug);
            localStorage.setItem('locked_form_hash', slugOrHash);
          }
        } else {
          // Visited raw slug like /form/soumya for the first time
          const computedHash = sha256(slugOrHash);
          localStorage.setItem(`form_hash_${computedHash}`, slugOrHash);
          localStorage.setItem('locked_form_slug', slugOrHash);
          localStorage.setItem('locked_form_hash', computedHash);
          
          navigateTo(`/form/${computedHash}`);
          return null;
        }
      }
    }
  }

  // Payment page: /pay/{token}
  if (path.startsWith('/pay/')) {
    const token = path.split('/pay/')[1];
    return <PaymentPage token={token} />;
  }

  // Public form: /form/{slug}
  if (path.startsWith('/form/')) {
    const slugOrHash = path.split('/form/')[1];
    const isHash = /^[a-f0-9]{64}$/i.test(slugOrHash);
    const slug = isHash ? (localStorage.getItem(`form_hash_${slugOrHash}`) || slugOrHash) : slugOrHash;
    return <PublicForm slug={slug} />;
  }

  // Fallback to Admin Dashboard
  return <Dashboard />;
}

export default App;

