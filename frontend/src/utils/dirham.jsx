// UAE Dirham currency symbol helpers.
// The symbol is drawn as a CSS mask over currentColor so it picks up the
// surrounding text colour and scales with the font size.

const symbolStyle = {
  display: 'inline-block',
  width: '1em',
  height: '1em',
  marginRight: '0.2em',
  verticalAlign: '-0.12em',
  flexShrink: 0,
  backgroundColor: 'currentColor',
  WebkitMask: 'url(/uae-dirham.svg) no-repeat center / contain',
  mask: 'url(/uae-dirham.svg) no-repeat center / contain',
};

// Bare symbol, e.g. for an InputNumber / Statistic prefix.
export const aedSymbol = (style) => <span role="img" aria-label="AED" style={{ ...symbolStyle, ...style }} />;

// Formatted amount with the symbol in front.
export const aed = (n) => (
  <span style={{ whiteSpace: 'nowrap' }}>{aedSymbol()}{Number(n || 0).toLocaleString()}</span>
);

// Plain-text amount for places that can't hold markup (search labels, toasts, placeholders).
export const aedText = (n) => `AED ${Number(n || 0).toLocaleString()}`;

// Swaps "AED 1,234" inside free text (e.g. notification bodies) for the symbol.
export const withDirham = (text) => {
  if (typeof text !== 'string' || !/\bAED\s*\d/.test(text)) return text;
  return text.split(/\bAED\s*(?=\d)/).map((part, i) => {
    if (i === 0) return part;
    const [, num, rest] = part.match(/^([\d,.]+)([\s\S]*)$/);
    return <span key={i}><span style={{ whiteSpace: 'nowrap' }}>{aedSymbol()}{num}</span>{rest}</span>;
  });
};
