const test = require('node:test');
const assert = require('node:assert/strict');
const c = require('../utils/coins');

test('shiftDayKey crosses month and year boundaries', () => {
  assert.equal(c.shiftDayKey('2026-03-01', -1), '2026-02-28');
  assert.equal(c.shiftDayKey('2026-12-31', 1), '2027-01-01');
});

test('streakDays: ends today, or yesterday when not spun yet; gaps break it', () => {
  assert.equal(c.streakDays([], '2026-10-23'), 0);
  assert.equal(c.streakDays(['2026-10-23', '2026-10-22', '2026-10-21'], '2026-10-23'), 3);
  assert.equal(c.streakDays(['2026-10-22', '2026-10-21'], '2026-10-23'), 2); // not spun today yet
  assert.equal(c.streakDays(['2026-10-21', '2026-10-20'], '2026-10-23'), 0); // missed yesterday
  assert.equal(c.streakDays(['2026-10-23', '2026-10-21'], '2026-10-23'), 1);
  assert.equal(c.streakDays(['2026-11-01', '2026-10-31', '2026-10-30'], '2026-11-01'), 3);
});

test('nextBonus: smallest bonus strictly ahead, null when none left', () => {
  const b = [{ days: 30, coins: 3000 }, { days: 7, coins: 500 }];
  assert.deepEqual(c.nextBonus(b, 0), { days: 7, coins: 500 });
  assert.deepEqual(c.nextBonus(b, 7), { days: 30, coins: 3000 });
  assert.equal(c.nextBonus(b, 30), null);
  assert.equal(c.nextBonus([], 3), null);
  assert.equal(c.nextBonus(undefined, 3), null);
});

test('tierFor: highest tier reached and the next one', () => {
  const t = c.DEFAULT_TIERS;
  assert.deepEqual(c.tierFor(t, 0), { tier: t[0], nextTier: t[1] });
  assert.deepEqual(c.tierFor(t, 1999), { tier: t[0], nextTier: t[1] });
  assert.deepEqual(c.tierFor(t, 2000), { tier: t[1], nextTier: t[2] });
  assert.deepEqual(c.tierFor(t, 999999), { tier: t[2], nextTier: null });
  assert.deepEqual(c.tierFor([{ name: 'Only', minCoins: 0 }], 50), { tier: { name: 'Only', minCoins: 0 }, nextTier: null });
});

test('dubaiWeekKey: ISO weeks, Monday start on the Dubai calendar, ISO week-year', () => {
  assert.equal(c.dubaiWeekKey(new Date('2026-10-29T10:00:00Z')), '2026-W44');
  // Sunday 23:59 Dubai is still the old week; 00:00 Monday Dubai (Sunday 20:00Z) starts the next.
  assert.equal(c.dubaiWeekKey(new Date('2026-11-01T19:59:59Z')), '2026-W44');
  assert.equal(c.dubaiWeekKey(new Date('2026-11-01T20:00:00Z')), '2026-W45');
  assert.equal(c.dubaiWeekKey(new Date('2025-12-29T10:00:00Z')), '2026-W01');
  assert.equal(c.dubaiWeekKey(new Date('2027-01-01T10:00:00Z')), '2026-W53');
  assert.equal(c.dubaiWeekKey(new Date('2027-01-04T10:00:00Z')), '2027-W01');
});

test('dubaiWeekRange: Monday..Sunday dayKeys', () => {
  assert.deepEqual(c.dubaiWeekRange(new Date('2026-10-23T10:00:00Z')), { key: '2026-W43', startKey: '2026-10-19', endKey: '2026-10-25' });
  assert.deepEqual(c.dubaiWeekRange(new Date('2026-10-25T19:00:00Z')), { key: '2026-W43', startKey: '2026-10-19', endKey: '2026-10-25' });
  assert.deepEqual(c.dubaiWeekRange(new Date('2026-10-19T00:00:00Z')), { key: '2026-W43', startKey: '2026-10-19', endKey: '2026-10-25' });
});

test('dubaiMonthRange: Dubai calendar month as UTC instants', () => {
  assert.deepEqual(c.dubaiMonthRange(new Date('2026-10-23T10:00:00Z')), {
    key: '2026-10', start: new Date('2026-09-30T20:00:00Z'), end: new Date('2026-10-31T20:00:00Z'),
  });
  // 21:00Z on 31 Oct is already 1 Nov in Dubai.
  assert.equal(c.dubaiMonthRange(new Date('2026-10-31T21:00:00Z')).key, '2026-11');
  assert.deepEqual(c.dubaiMonthRange(new Date('2026-12-15T10:00:00Z')).end, new Date('2026-12-31T20:00:00Z'));
});

test('resolveMissions: catalogue order, stored overrides, target in the title', () => {
  const r = c.resolveMissions([{ key: 'consents', enabled: false, target: 5, coins: 10 }, { key: 'bogus', enabled: true, target: 1, coins: 1 }]);
  assert.deepEqual(r.map((m) => m.key), ['submit_leads', 'share_link', 'consents', 'approvals', 'watch_guide']);
  assert.deepEqual(r[2], { key: 'consents', title: 'Get 5 consents', subtitle: 'Clients reply YES', period: 'month', enabled: false, target: 5, coins: 10 });
  assert.equal(r[0].title, 'Submit 6 leads this month');
  assert.equal(r[3].title, '3 approvals this month');
  assert.equal(r[4].period, 'once');
  assert.deepEqual(c.resolveMissions(undefined).map((m) => m.enabled), [true, true, true, true, true]);
  // A stored target outside the per-challenge cap falls back to the default.
  assert.equal(c.resolveMissions([{ key: 'share_link', enabled: true, target: 9, coins: 5 }])[1].target, 1);
});

test('validateTiers', () => {
  assert.equal(c.validateTiers(c.DEFAULT_TIERS), null);
  assert.match(c.validateTiers([]), /1 to 10/);
  assert.match(c.validateTiers([{ name: 'A', minCoins: 5 }]), /start at 0/);
  assert.match(c.validateTiers([{ name: 'A', minCoins: 0 }, { name: 'B', minCoins: 0 }]), /more coins/);
  assert.match(c.validateTiers([{ name: 'A', minCoins: 0 }, { name: ' a ', minCoins: 5 }]), /unique/);
  assert.match(c.validateTiers([{ name: '  ', minCoins: 0 }]), /name/);
  assert.match(c.validateTiers([{ name: 'A', minCoins: 0 }, { name: 'B', minCoins: 1.5 }]), /whole/);
  assert.match(c.validateTiers([{ name: 'A', minCoins: 0 }, { name: 'B', minCoins: 1000001 }]), /1,000,000/);
});

test('validateStreakBonuses', () => {
  assert.equal(c.validateStreakBonuses(c.DEFAULT_STREAK_BONUSES), null);
  assert.equal(c.validateStreakBonuses([]), null);
  assert.match(c.validateStreakBonuses('x'), /list/);
  assert.match(c.validateStreakBonuses([{ days: 1, coins: 5 }]), /days/);
  assert.match(c.validateStreakBonuses([{ days: 7, coins: 5 }, { days: 7, coins: 6 }]), /different/);
  assert.match(c.validateStreakBonuses([{ days: 7, coins: 0 }]), /coins/);
  assert.match(c.validateStreakBonuses([{ days: 7, coins: 1000001 }]), /1,000,000/);
});

test('validatePromoText and validateMissions', () => {
  assert.equal(c.validatePromoText(''), null);
  assert.equal(c.validatePromoText(`  ${'x'.repeat(120)}  `), null);
  assert.match(c.validatePromoText('x'.repeat(121)), /120/);
  assert.match(c.validatePromoText(5), /text/);
  assert.equal(c.validateMissions(c.defaultMissions()), null);
  assert.equal(c.validateMissions([]), null);
  assert.match(c.validateMissions([{ key: 'nope', enabled: true, target: 1, coins: 1 }]), /Unknown/);
  assert.match(c.validateMissions([{ key: 'consents', enabled: true, target: 1, coins: 1 }, { key: 'consents', enabled: true, target: 1, coins: 1 }]), /once/);
  assert.match(c.validateMissions([{ key: 'consents', enabled: 'yes', target: 1, coins: 1 }]), /true or false/);
  assert.match(c.validateMissions([{ key: 'consents', enabled: true, target: 0, coins: 1 }]), /target/);
  assert.match(c.validateMissions([{ key: 'consents', enabled: true, target: 1001, coins: 1 }]), /target/);
  assert.equal(c.validateMissions([{ key: 'share_link', enabled: true, target: 7, coins: 1 }]), null);
  assert.match(c.validateMissions([{ key: 'share_link', enabled: true, target: 8, coins: 1 }]), /1 to 7/);
  assert.match(c.validateMissions([{ key: 'watch_guide', enabled: true, target: 2, coins: 1 }]), /must be 1/);
  assert.equal(c.validateMissions([{ key: 'submit_leads', enabled: true, target: 1000, coins: 1 }]), null);
  assert.match(c.validateMissions([{ key: 'consents', enabled: true, target: 1, coins: -1 }]), /coins/);
});

test('models: award key guard, new ledger types, activity guard, settings defaults on an old singleton', () => {
  const mongoose = require('mongoose');
  const CoinTransaction = require('../models/CoinTransaction');
  const idx = CoinTransaction.schema.indexes().find(([k]) => JSON.stringify(k) === '{"user":1,"awardKey":1}');
  assert.ok(idx, 'awardKey index missing');
  assert.equal(idx[1].unique, true);
  assert.deepEqual(idx[1].partialFilterExpression, { awardKey: { $type: 'string' } });
  assert.ok(['streak', 'mission'].every((t) => CoinTransaction.schema.path('type').enumValues.includes(t)));
  assert.equal(new CoinTransaction({ user: new mongoose.Types.ObjectId(), type: 'spin', amount: 1, balanceAfter: 1 }).toObject().awardKey, undefined);

  const act = require('../models/CoinActivity').schema.indexes().find(([k]) => JSON.stringify(k) === '{"user":1,"type":1,"dayKey":1}');
  assert.equal(act[1].unique, true);

  // A singleton saved before plan H has none of the new fields: the defaults fill in.
  const s = require('../models/CoinSettings').hydrate({ _id: new mongoose.Types.ObjectId(), spinEnabled: true });
  assert.deepEqual(s.toObject().tiers, c.DEFAULT_TIERS);
  assert.deepEqual(s.toObject().streakBonuses, c.DEFAULT_STREAK_BONUSES);
  assert.equal(s.promoText, '');
  assert.deepEqual(s.toObject().missions, c.defaultMissions());
});
