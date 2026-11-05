const BadgeIcon = require('../models/BadgeIcon');
const CardProduct = require('../models/CardProduct');
const { clearPublicCardCache, notifyWebsiteProductsChanged } = require('../utils/publicCardCache');

// Names for emojis already on cards when the list is first built (admin can rename).
// Keys without the U+FE0F emoji-style marker; any other emoji found on a card is
// named after its most used badge label.
const DEFAULT_NAMES = {
  '🎁': 'Gift', '🛋': 'Lounge', '✈': 'Travel', '🎬': 'Cinema', '🍽': 'Dining',
  '🛒': 'Groceries', '💳': 'Card', '⛽': 'Fuel', '💰': 'Cashback', '🌍': 'International',
  '🛍': 'Shopping', '🏠': 'Home', '🚗': 'Car', '🚘': 'Car', '🛬': 'Airport',
  '🏅': 'Points', '🛎': 'Concierge', '🧳': 'Travel Insurance', '📈': 'Bonus Points',
  '📺': 'Streaming', '💎': 'Luxury', '🌴': 'Beach & Gym', '🛣': 'Salik', '☪': 'Islamic',
};
const defaultName = (emoji) => DEFAULT_NAMES[emoji.replace(/\uFE0F/g, '')];

const MAX_EMOJI_LEN = 16; // code units: room for flags / joined emojis
const MAX_NAME_LEN = 40;

function cleanInput(body) {
  const emoji = String(body?.emoji ?? '').trim();
  const name = String(body?.name ?? '').trim();
  if (!emoji) return { error: 'Emoji required' };
  if (emoji.length > MAX_EMOJI_LEN) return { error: 'Enter one emoji only' };
  if (!name) return { error: 'Name required' };
  if (name.length > MAX_NAME_LEN) return { error: `Name must be ${MAX_NAME_LEN} characters or less` };
  return { emoji, name };
}

function cardsChanged() {
  clearPublicCardCache();
  notifyWebsiteProductsChanged();
}

// Some imported badge icons lost the top of their code (🎁 U+1F381 saved as U+F381),
// and some have stray spaces ("🛍️ "). Both show wrong / count as a different emoji.
// Built from the real characters: MongoDB's regex engine doesn't read \uXXXX escapes
const BROKEN_EMOJI = new RegExp(`[${String.fromCharCode(0xF000)}-${String.fromCharCode(0xFAFF)}]`);
const fixIcon = (icon) => [...String(icon || '').trim()]
  .map((ch) => {
    const cp = ch.codePointAt(0);
    return cp >= 0xF000 && cp <= 0xFAFF ? String.fromCodePoint(cp + 0x10000) : ch;
  })
  .join('');

async function cleanCardBadgeIcons() {
  const cards = await CardProduct.find(
    { $or: [{ 'rewardBadges.icon': /^\s|\s$/ }, { 'rewardBadges.icon': BROKEN_EMOJI }] },
    { rewardBadges: 1 }
  ).lean();
  for (const card of cards) {
    const rewardBadges = card.rewardBadges.map((b) => ({ ...b, icon: fixIcon(b.icon) }));
    await CardProduct.updateOne({ _id: card._id }, { $set: { rewardBadges } });
  }
  return cards.length;
}

// emoji -> { cards: number of cards using it, label: its most used badge label }
async function badgeIconUsage() {
  const rows = await CardProduct.aggregate([
    { $unwind: '$rewardBadges' },
    { $match: { 'rewardBadges.icon': { $nin: [null, ''] } } },
    { $group: { _id: '$rewardBadges.icon', cards: { $addToSet: '$_id' }, labels: { $push: '$rewardBadges.labelOrText' } } },
  ]);
  const usage = new Map();
  for (const r of rows) {
    const counts = {};
    for (const l of r.labels) if (l) counts[l] = (counts[l] || 0) + 1;
    const label = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || '';
    usage.set(r._id, { cards: r.cards.length, label });
  }
  return usage;
}

// The list always holds every emoji that is on a card, so the dropdown never shows an unknown value.
// First call fills it from the cards; later calls only add emojis that came in another way (imports).
async function addMissingFromCards(icons, usage) {
  const known = new Set(icons.map((i) => i.emoji));
  const missing = [...usage.keys()].filter((e) => !known.has(e));
  if (!missing.length) return false;
  const docs = missing.map((emoji) => ({
    emoji,
    name: (defaultName(emoji) || usage.get(emoji).label || 'Icon').slice(0, MAX_NAME_LEN),
  }));
  try {
    await BadgeIcon.insertMany(docs, { ordered: false });
  } catch (err) {
    if (err.code !== 11000 && !err.writeErrors?.every((e) => e.code === 11000)) throw err; // another request added them first
  }
  return true;
}

exports.list = async (req, res) => {
  try {
    if (await cleanCardBadgeIcons()) cardsChanged();
    const usage = await badgeIconUsage();
    let icons = await BadgeIcon.find().sort({ name: 1 }).lean();
    if (await addMissingFromCards(icons, usage)) icons = await BadgeIcon.find().sort({ name: 1 }).lean();
    res.json(icons.map((i) => ({ ...i, cards: usage.get(i.emoji)?.cards || 0 })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const input = cleanInput(req.body);
    if (input.error) return res.status(400).json({ message: input.error });
    if (await BadgeIcon.exists({ emoji: input.emoji })) return res.status(400).json({ message: 'This emoji is already in the list' });
    const icon = await BadgeIcon.create({ emoji: input.emoji, name: input.name });
    res.status(201).json({ ...icon.toObject(), cards: 0 });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'This emoji is already in the list' });
    res.status(400).json({ message: err.message });
  }
};

// Changing the emoji also changes it on every card that uses it.
exports.update = async (req, res) => {
  try {
    const input = cleanInput(req.body);
    if (input.error) return res.status(400).json({ message: input.error });
    const icon = await BadgeIcon.findById(req.params.id);
    if (!icon) return res.status(404).json({ message: 'Emoji not found' });
    // Two list entries with one emoji would make a later delete wipe both from cards
    if (await BadgeIcon.exists({ emoji: input.emoji, _id: { $ne: icon._id } })) {
      return res.status(400).json({ message: 'This emoji is already in the list' });
    }

    const oldEmoji = icon.emoji;
    icon.emoji = input.emoji;
    icon.name = input.name;
    await icon.save();

    let updatedCards = 0;
    if (oldEmoji !== input.emoji) {
      const r = await CardProduct.updateMany(
        { 'rewardBadges.icon': oldEmoji },
        { $set: { 'rewardBadges.$[b].icon': input.emoji } },
        { arrayFilters: [{ 'b.icon': oldEmoji }] }
      );
      updatedCards = r.modifiedCount;
      if (updatedCards) cardsChanged();
    }
    const cards = await CardProduct.countDocuments({ 'rewardBadges.icon': input.emoji });
    res.json({ ...icon.toObject(), cards, updatedCards, oldEmoji });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'This emoji is already in the list' });
    res.status(400).json({ message: err.message });
  }
};

// Deleting removes the emoji from every card using it (the badge text and % stay).
exports.remove = async (req, res) => {
  try {
    const icon = await BadgeIcon.findById(req.params.id);
    if (!icon) return res.status(404).json({ message: 'Emoji not found' });
    const r = await CardProduct.updateMany(
      { 'rewardBadges.icon': icon.emoji },
      { $set: { 'rewardBadges.$[b].icon': '' } },
      { arrayFilters: [{ 'b.icon': icon.emoji }] }
    );
    await icon.deleteOne();
    if (r.modifiedCount) cardsChanged();
    res.json({ message: 'Deleted', emoji: icon.emoji, updatedCards: r.modifiedCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
