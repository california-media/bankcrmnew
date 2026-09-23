const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function threeDigitsToWords(n) {
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  const parts = [];
  if (hundred) parts.push(`${ONES[hundred]} Hundred`);
  if (rest) {
    if (rest < 20) parts.push(ONES[rest]);
    else {
      const tensPart = TENS[Math.floor(rest / 10)];
      const onesPart = ONES[rest % 10];
      parts.push(onesPart ? `${tensPart}-${onesPart}` : tensPart);
    }
  }
  return parts.join(hundred && rest ? ' and ' : '');
}

function integerToWords(n) {
  if (n === 0) return 'Zero';
  const groups = [
    [1_000_000_000, 'Billion'],
    [1_000_000, 'Million'],
    [1_000, 'Thousand'],
    [1, ''],
  ];
  const parts = [];
  let remaining = n;
  for (const [value, label] of groups) {
    const count = Math.floor(remaining / value);
    if (count > 0) {
      parts.push(label ? `${threeDigitsToWords(count)} ${label}` : threeDigitsToWords(count));
      remaining %= value;
    }
  }
  return parts.join(' ');
}

// e.g. 1435 -> "One Thousand Four Hundred and Thirty-Five Dirhams Only."
function amountToWordsAed(amount) {
  const value = Number(amount) || 0;
  const wholePart = Math.floor(value);
  const fils = Math.round((value - wholePart) * 100);
  const wholeWords = integerToWords(wholePart);
  if (fils > 0) {
    return `${wholeWords} Dirhams and ${integerToWords(fils)} Fils Only.`;
  }
  return `${wholeWords} Dirhams Only.`;
}

module.exports = { amountToWordsAed };
