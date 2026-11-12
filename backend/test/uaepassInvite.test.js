const test = require('node:test');
const assert = require('node:assert/strict');
const { inviteStateOf, inviterFor } = require('../utils/uaepassInvite');

test('inviteStateOf: a valid ?ref= goes into the signed UAE PASS state, uppercased; junk is dropped', () => {
  assert.deepEqual(inviteStateOf({ ref: ' ab12cd34 ' }), { ref: 'AB12CD34' });
  assert.deepEqual(inviteStateOf({ ref: 'xyz!!' }), {});
  assert.deepEqual(inviteStateOf({}), {});
  assert.deepEqual(inviteStateOf(undefined), {});
});

test('inviterFor: the active agent whose code is in the state, else null', async () => {
  const queries = [];
  const User = {
    findOne: (q) => {
      queries.push(q);
      return { select: () => ({ lean: async () => (q.referralCode === 'AB12CD34' ? { _id: 'inv1' } : null) }) };
    },
  };
  assert.equal(await inviterFor({ ref: 'AB12CD34' }, User), 'inv1');
  assert.deepEqual(queries[0], { referralCode: 'AB12CD34', role: 'agent', isActive: true });
  assert.equal(await inviterFor({ ref: 'ZZZZ9999' }, User), null);
  assert.equal(await inviterFor({}, User), null);
  assert.equal(await inviterFor(null, User), null);
  assert.equal(queries.length, 2); // no lookup without a code
});
