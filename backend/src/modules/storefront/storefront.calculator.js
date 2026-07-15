// Port server-side dari public/pixelso-calculator-core.js milik landing page (pixelso_nodejs).
// Dipakai untuk menghitung ulang harga secara otoritatif saat checkout - JANGAN PERNAH percaya
// total yang dikirim client. Formula harus tetap sinkron manual dengan versi frontend storefront
// di ~/pixelso-storefront/src/lib/calculator.js (dua codebase terpisah, tidak ada monorepo).

function number(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// config: { designFee, products } - products[].optionGroups dari pricing.service.js#getPublicPricing()
// input.selections: { [groupId]: choiceId } - satu pilihan per grup opsi produk.
function calculatePrintPrice(config, input) {
  const products = Array.isArray(config?.products) ? config.products : [];
  const product = products.find((p) => p.active !== false && p.key === input.productKey);
  if (!product) {
    return { valid: false, total: 0, message: 'Produk tidak aktif atau tidak ditemukan.' };
  }

  const width = Math.max(0, number(input.width));
  const height = Math.max(0, number(input.height));
  const quantity = Math.max(1, Math.ceil(number(input.quantity, 1)));
  const setup = Math.max(0, number(product.setup));

  const optionGroups = Array.isArray(product.optionGroups) ? product.optionGroups : [];
  const selections = input.selections && typeof input.selections === 'object' ? input.selections : {};

  const selectedChoicesByGroup = [];
  for (const group of optionGroups) {
    const choiceId = selections[group.id];
    const choice = choiceId != null ? (group.choices || []).find((c) => c.id === choiceId) : null;
    if (group.required && !choice) {
      return { valid: false, total: 0, message: `Pilih dulu: ${group.label}` };
    }
    if (choice) selectedChoicesByGroup.push(choice);
  }

  let effectiveBaseRate = Math.max(0, number(product.baseRate));
  const replaceChoice = selectedChoicesByGroup.find((c) => c.priceMode === 'replace_base');
  if (replaceChoice) effectiveBaseRate = Math.max(0, number(replaceChoice.priceValue));

  let base = 0;
  let billedArea = 0;
  if (product.mode === 'area') {
    const actualArea = (width / 100) * (height / 100);
    billedArea = Math.max(Math.max(0, number(product.minArea)), actualArea);
    base = billedArea * effectiveBaseRate * quantity + setup;
  } else {
    base = effectiveBaseRate * quantity + setup;
  }

  let optionAdd = 0;
  for (const choice of selectedChoicesByGroup) {
    if (choice.priceMode === 'multiplier') {
      base *= Math.max(0, number(choice.priceValue));
    } else if (choice.priceMode === 'add') {
      const value = Math.max(0, number(choice.priceValue));
      optionAdd += choice.perUnit ? value * quantity : value;
    }
  }

  const designAdd = input.needDesign ? Math.max(0, number(config?.designFee)) : 0;
  const total = base + optionAdd + designAdd;

  // Snapshot label pilihan (bukan cuma id) - dipakai checkout untuk disimpan di PoDetail
  // supaya riwayat order tetap terbaca walau opsi diedit/dihapus manager belakangan.
  const selectedOptionsSnapshot = optionGroups
    .map((group) => {
      const choiceId = selections[group.id];
      const choice = choiceId != null ? (group.choices || []).find((c) => c.id === choiceId) : null;
      return choice ? { groupId: group.id, groupLabel: group.label, choiceId: choice.id, choiceLabel: choice.label } : null;
    })
    .filter(Boolean);

  return { valid: true, product, width, height, quantity, billedArea, base, optionAdd, designAdd, total, selectedOptionsSnapshot };
}

module.exports = { calculatePrintPrice };
