const TENURE_TYPE_OPTIONS = [
  'A1 temporal permit',
  'Offer letter',
  'Old resettlement permit',
  'A1 villagized',
  'A2 villagized',
];

function normalizeTenureType(value) {
  if (typeof value !== 'string') return null;

  const text = value.trim();
  if (!text) return null;

  const normalized = text.toLowerCase();

  const map = {
    'a1 temporal permit': 'A1 temporal permit',
    'offer letter': 'Offer letter',
    'old resettlement permit': 'Old resettlement permit',
    'a1 villagized': 'A1 villagized',
    'a2 villagized': 'A2 villagized',
  };

  return map[normalized] || text;
}

module.exports = {
  TENURE_TYPE_OPTIONS,
  normalizeTenureType,
};
