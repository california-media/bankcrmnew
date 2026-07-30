const normalizeUAE = (v) => {
  const c = String(v).replace(/[\s\-\+\(\)\.]/g, '');
  return /^0/.test(c) ? '971' + c.slice(1) : c;
};

// For inputs that include country code (971XXXXXXXXX or 05XXXXXXXXX)
export const validateUAEPhone = (_, value) => {
  if (!value || !String(value).trim()) return Promise.resolve();
  if (!/^9715\d{8}$/.test(normalizeUAE(value))) {
    return Promise.reject('Invalid UAE mobile number (e.g. 971501234567 or 0501234567)');
  }
  return Promise.resolve();
};

// For split inputs where user enters local part only (5XXXXXXXX, 9 digits)
export const validateUAELocalPhone = (_, value) => {
  if (!value || !String(value).trim()) return Promise.resolve();
  const clean = String(value).replace(/[\s\-]/g, '');
  if (!/^5\d{8}$/.test(clean)) {
    return Promise.reject('Enter 9 digits starting with 5 (e.g. 501234567)');
  }
  return Promise.resolve();
};

// Prepend 971 to local part, strip formatting
export const toFullUAEPhone = (localPart) =>
  '971' + String(localPart || '').replace(/[\s\-]/g, '');
