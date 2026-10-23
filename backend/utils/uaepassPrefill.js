const jwt = require('jsonwebtoken');

const EXPIRED = 'UAE PASS session expired, please sign in with UAE PASS again';

// Resolves uaepassSub/emiratesId for agent registration.
// With a prefill JWT (issued by the UAE PASS callback) the sub is taken from the
// verified token; otherwise the raw body values pass through (website path).
function resolveUaepassFields(body, secret) {
  if (body.uaepassPrefill) {
    try {
      const decoded = jwt.verify(body.uaepassPrefill, secret);
      if (!decoded || decoded._uaepass !== true) return { error: EXPIRED };
      return { uaepassSub: decoded.sub, emiratesId: body.emiratesId || decoded.emiratesId };
    } catch (e) {
      return { error: EXPIRED };
    }
  }
  return { uaepassSub: body.uaepassSub, emiratesId: body.emiratesId };
}

module.exports = { resolveUaepassFields };
