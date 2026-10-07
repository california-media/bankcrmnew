const sanitizeHtml = require('sanitize-html');

// Rich-text email bodies (from the admin's Quill editor) are cleaned to a
// small allow-list before they go into an email or the DB, and get inline
// styles because most email clients ignore <style> blocks.
// No block margins, same as the Quill editor, so the email looks exactly as
// typed (blank lines are their own empty <p>).
const BLOCK_STYLE = {
  p: 'margin:0;',
  h1: 'margin:0;font-size:22px;',
  h2: 'margin:0;font-size:18px;',
  h3: 'margin:0;font-size:16px;',
  ul: 'margin:0;padding-left:24px;',
  ol: 'margin:0;padding-left:24px;',
  blockquote: 'margin:0;padding:2px 12px;border-left:3px solid #cbd5e1;color:#475569;',
  pre: 'margin:0;padding:10px 12px;background:#f1f5f9;border-radius:4px;white-space:pre-wrap;font-family:monospace;font-size:13px;',
};

// Quill marks alignment / indent with classes — turn them into inline styles.
const classStyles = (cls = '') => {
  const out = [];
  const align = cls.match(/ql-align-(center|right|justify)/);
  if (align) out.push(`text-align:${align[1]};`);
  const indent = cls.match(/ql-indent-(\d)/);
  if (indent) out.push(`padding-left:${Number(indent[1]) * 3}em;`);
  return out.join('');
};

const withBlockStyle = (tag) => (tagName, attribs) => ({
  tagName,
  attribs: {
    ...attribs,
    style: `${BLOCK_STYLE[tag] || ''}${classStyles(attribs.class)}${attribs.style || ''}`,
  },
});

const COLOR = [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s.,%]+\)$/i, /^[a-z]+$/i];

const sanitizeEmailHtml = (html = '') =>
  sanitizeHtml(String(html), {
    allowedTags: ['p', 'br', 'span', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'blockquote', 'pre', 'code', 'sub', 'sup'],
    allowedAttributes: {
      a: ['href', 'target', 'rel', 'style'],
      '*': ['style'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedStyles: {
      '*': {
        color: COLOR,
        'background-color': COLOR,
        'text-align': [/^(left|right|center|justify)$/],
        'padding-left': [/^\d+(\.\d+)?(px|em)$/],
        margin: [/^[\d\s.pxem]+$/],
        padding: [/^[\d\s.pxem]+$/],
        'font-size': [/^\d+px$/],
        'font-family': [/^[\w\s,-]+$/],
        'white-space': [/^pre-wrap$/],
        'text-decoration': [/^(underline|line-through|none)$/],
        border: [/^[\w\s#.]+$/],
        'border-left': [/^[\w\s#.]+$/],
        'border-radius': [/^\d+px$/],
        background: [/^#[0-9a-f]{3,8}$/i],
      },
    },
    transformTags: {
      ...Object.fromEntries(Object.keys(BLOCK_STYLE).map((t) => [t, withBlockStyle(t)])),
      li: (tagName, attribs) => ({ tagName, attribs: { ...attribs, style: `margin:0;${classStyles(attribs.class)}` } }),
      a: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer', style: 'color:#6d28d9;text-decoration:underline;' },
      }),
    },
  });

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };

// Plain-text alternative for the email (and a searchable copy in the DB).
const htmlToText = (html = '') =>
  String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/(p|h[1-6]|li|blockquote|pre)>/gi, '\n')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi, (_, href, label) => (label === href ? href : `${label} (${href})`))
    .replace(/<[^>]+>/g, '')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m])
    .replace(/\n{3,}/g, '\n\n')
    .trim();

module.exports = { sanitizeEmailHtml, htmlToText };
