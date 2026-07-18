import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import * as dashboardService from '../../services/dashboardService';
import useFetch from '../../hooks/useFetch';
import useAuth from '../../hooks/useAuth';
import StatusBadge from '../../components/common/StatusBadge';
import NotificationsFeed from '../../components/common/NotificationsFeed';
import WorkLinksWidget from '../../components/common/WorkLinksWidget';
import { formatCurrency, formatDate, firstDayOfMonthISO, todayISODate } from '../../utils/format';

export default function DashboardPage() {
  const { hasRole, user } = useAuth();

  return (
    <div>
      {hasRole('manager') ? (
        <ManagerDashboard />
      ) : (
        <div>
          <h1>Selamat datang, {user?.name}</h1>
          <p className="text-muted">Berikut hal-hal yang mungkin butuh perhatian Anda.</p>
          <div className="card" style={{ marginTop: '1rem' }}>
            <NotificationsFeed />
          </div>
        </div>
      )}

      <DashboardMarketingSection />
      <WorkLinksWidget />
    </div>
  );
}

// Ringkasan Dashboard Marketing - terbuka untuk semua role login (lihat dashboard.routes.js),
// bukan cuma manager. "Selengkapnya" mengarah ke halaman Marketing Analytics penuh, yang tetap
// dibatasi role marketing/manager di sana - role lain akan lihat halaman kosong/error kalau klik,
// sama seperti pola akses modul lain di sidebar yang disembunyikan tapi tidak diblokir di router.
function DashboardMarketingSection() {
  const fetcher = useCallback(() => dashboardService.getMarketingSummary(), []);
  const { data, loading, error } = useFetch(fetcher, [fetcher]);

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Dashboard Marketing</h2>

      {loading && <div className="empty-state">Memuat...</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {data && (
        <div className="grid grid-cols-2">
          <div className="card">
            <div className="page-header" style={{ marginBottom: '0.5rem' }}>
              <h3 style={{ fontSize: '0.95rem', margin: 0 }}>10 Produk Terlaris (bulan ini)</h3>
              <Link to="/marketing" className="text-sm">
                Selengkapnya
              </Link>
            </div>
            {data.topProducts.length === 0 ? (
              <div className="empty-state">Belum ada data</div>
            ) : (
              <ol style={{ margin: 0, paddingLeft: '1.1rem' }}>
                {data.topProducts.map((p) => (
                  <li key={p.productId} className="text-sm" style={{ padding: '0.25rem 0' }}>
                    {p.name} <span className="text-muted">({p.totalQty} qty, {p.orderCount} order)</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="card">
            <div className="page-header" style={{ marginBottom: '0.5rem' }}>
              <h3 style={{ fontSize: '0.95rem', margin: 0 }}>10 Besar Repeat Customer (bulan ini)</h3>
              <Link to="/marketing" className="text-sm">
                Selengkapnya
              </Link>
            </div>
            {data.repeatCustomers.length === 0 ? (
              <div className="empty-state">Belum ada data</div>
            ) : (
              <ol style={{ margin: 0, paddingLeft: '1.1rem' }}>
                {data.repeatCustomers.map((c) => (
                  <li key={c.customerId} className="text-sm" style={{ padding: '0.25rem 0' }}>
                    {c.name} <span className="text-muted">({c.orderCount} order)</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="page-header" style={{ marginBottom: '0.5rem' }}>
              <h3 style={{ fontSize: '0.95rem', margin: 0 }}>Campaign Sedang Berjalan</h3>
              <Link to="/marketing" className="text-sm">
                Selengkapnya
              </Link>
            </div>
            {data.activeCampaigns.length === 0 ? (
              <div className="empty-state">Tidak ada campaign aktif</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Nama Campaign</th>
                      <th>Channel</th>
                      <th>Mulai</th>
                      <th>Selesai</th>
                      <th>Budget</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.activeCampaigns.map((c) => (
                      <tr key={c.campaignId}>
                        <td>{c.name}</td>
                        <td>{c.channel || '-'}</td>
                        <td>{formatDate(c.startDate)}</td>
                        <td>{formatDate(c.endDate)}</td>
                        <td>{formatCurrency(c.budget)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ManagerDashboard() {
  const [from, setFrom] = useState(firstDayOfMonthISO());
  const [to, setTo] = useState(todayISODate());

  const fetcher = useCallback(() => dashboardService.getSummary({ from, to }), [from, to]);
  const { data, loading, error } = useFetch(fetcher, [fetcher]);

  return (
    <div>
      <div className="page-header">
        <h1>Manager Dashboard</h1>
      </div>

      <div className="filters">
        <div className="form-group">
          <label>Dari</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Sampai</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {loading && <div className="empty-state">Memuat dashboard...</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {data && (
        <>
          <div className="grid grid-cols-4" style={{ marginBottom: '1.25rem' }}>
            <div className="stat-tile">
              <div className="label">Order Masuk (periode)</div>
              <div className="value">{data.orderMasuk.total}</div>
            </div>
            <div className="stat-tile">
              <div className="label">Order Hari Ini</div>
              <div className="value">{data.orderMasuk.today}</div>
            </div>
            <div className="stat-tile">
              <div className="label">Omzet</div>
              <div className="value">{formatCurrency(data.keuangan.omzet)}</div>
            </div>
            <div className="stat-tile">
              <div className="label">Laba Kotor</div>
              <div className="value">{formatCurrency(data.keuangan.margin)}</div>
            </div>
            <div className="stat-tile">
              <div className="label">Pengeluaran</div>
              <div className="value">{formatCurrency(data.keuangan.pengeluaran)}</div>
            </div>
          </div>

          <div className="grid grid-cols-2">
            <div className="card">
              <h3 style={{ fontSize: '0.95rem' }}>Antrean PO per Status</h3>
              <BreakdownList data={data.antrean.poByStatus} />
            </div>
            <div className="card">
              <h3 style={{ fontSize: '0.95rem' }}>Antrean Task Produksi</h3>
              <BreakdownList data={data.antrean.taskByStatus} />
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: '0.95rem' }}>Stok Kritis</h3>
            {data.stokKritis.length === 0 ? (
              <div className="empty-state">Tidak ada stok kritis</div>
            ) : (
              <ul>
                {data.stokKritis.map((m) => (
                  <li key={m.materialId} className="text-sm">
                    {m.name}: {m.stockQty} {m.unit} (min {m.minStock})
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <h3 style={{ fontSize: '0.95rem' }}>Keterlambatan</h3>
            {data.keterlambatan.length === 0 ? (
              <div className="empty-state">Tidak ada PO terlambat</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>No. PO</th>
                      <th>Customer</th>
                      <th>Status</th>
                      <th>Deadline</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.keterlambatan.map((o) => (
                      <tr key={o.poId}>
                        <td>{o.poNumber}</td>
                        <td>{o.customer?.name}</td>
                        <td>
                          <StatusBadge status={o.status} />
                        </td>
                        <td>{formatDate(o.dueAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card">
            <h3 style={{ fontSize: '0.95rem' }}>Komplain</h3>
            {data.komplain.length === 0 ? (
              <div className="empty-state">Tidak ada komplain</div>
            ) : (
              <ul>
                {data.komplain.map((o) => (
                  <li key={o.poId} className="text-sm">
                    {o.poNumber} - {o.customer?.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function BreakdownList({ data }) {
  const entries = Object.entries(data || {});
  if (entries.length === 0) return <div className="empty-state">Tidak ada data</div>;
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {entries.map(([status, count]) => (
        <li
          key={status}
          style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid var(--color-border)' }}
        >
          <StatusBadge status={status} />
          <span>{count}</span>
        </li>
      ))}
    </ul>
  );
}
