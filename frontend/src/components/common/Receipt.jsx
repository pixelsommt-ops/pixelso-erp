import { formatCurrency, formatDateTime } from '../../utils/format';

// Layout khusus cetak (thermal printer kecil, 58mm) - disembunyikan di layar normal, cuma
// dimunculkan lewat CSS @media print (lihat index.css) saat window.print() dipanggil.
// Printer thermal tersambung sebagai printer biasa di OS, jadi cukup lewat dialog print browser.
export default function Receipt({ sale, settings, remaining }) {
  if (!sale) return null;

  const items = sale.items || [];
  const subtotal = items.reduce((sum, item) => sum + Number(item.lineTotal), 0);
  const discount = Math.max(subtotal - Number(sale.total), 0);
  // Pakai "remaining" yang sudah dihitung dari payment confirmed (bukan sale.dp mentah) - dp
  // itu cuma DP awal saat invoice dibuat, sudah basi kalau ada pelunasan/pembayaran susulan.
  const paid = Math.max(Number(sale.total) - Number(remaining || 0), 0);

  return (
    <div className="receipt-print-only">
      <div style={{ textAlign: 'center', marginBottom: 6 }}>
        <strong>{settings?.name || 'Pixelso'}</strong>
        {settings?.address && <div>{settings.address}</div>}
        {settings?.whatsapp && <div>WA: {settings.whatsapp}</div>}
      </div>
      <div className="receipt-divider" />
      <div>No. PO: {sale.productionOrder?.poNumber}</div>
      <div>Tanggal: {formatDateTime(sale.createdAt)}</div>
      <div>Customer: {sale.productionOrder?.customer?.name}</div>
      <div>Kasir: {sale.cashier?.name}</div>
      <div className="receipt-divider" />
      {items.map((item) => (
        <div key={item.poDetailId} style={{ marginBottom: 2 }}>
          <div>{item.productName}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>
              {item.calcType === 'area' ? `${item.size || ''} x${item.qty}` : `x${item.qty}`}
              {item.minAreaApplied ? ' (min. 1m²)' : ''}
            </span>
            <span>{formatCurrency(item.lineTotal)}</span>
          </div>
        </div>
      ))}
      <div className="receipt-divider" />
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Subtotal</span>
        <span>{formatCurrency(subtotal)}</span>
      </div>
      {discount > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Diskon</span>
          <span>-{formatCurrency(discount)}</span>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
        <span>Total</span>
        <span>{formatCurrency(sale.total)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Dibayar</span>
        <span>{formatCurrency(paid)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Sisa</span>
        <span>{formatCurrency(remaining)}</span>
      </div>
      <div className="receipt-divider" />
      <div style={{ textAlign: 'center' }}>Terima kasih!</div>
    </div>
  );
}
