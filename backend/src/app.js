const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const config = require('./config');
const { notFound, errorHandler } = require('./common/middlewares/errorHandler');

// Modul mengikuti PRD 3.2 (M01-M12)
const authRoutes = require('./modules/auth/auth.routes');
const usersRoutes = require('./modules/users/users.routes');
const customersRoutes = require('./modules/customers/customers.routes');
const productsRoutes = require('./modules/products/products.routes');
const productionOrdersRoutes = require('./modules/production-orders/production-orders.routes');
const posRoutes = require('./modules/pos/pos.routes');
const inventoryRoutes = require('./modules/inventory/inventory.routes');
const productionRoutes = require('./modules/production/production.routes');
const qcDeliveryRoutes = require('./modules/qc-delivery/qc-delivery.routes');
const financeRoutes = require('./modules/finance/finance.routes');
const marketingRoutes = require('./modules/marketing/marketing.routes');
const hrdRoutes = require('./modules/hrd/hrd.routes');
const dashboardRoutes = require('./modules/dashboard/dashboard.routes');
const notificationsRoutes = require('./modules/notifications/notifications.routes');
const pricingRoutes = require('./modules/pricing/pricing.routes');
const publicPricingRoutes = require('./modules/pricing/pricing.public.routes');
const storefrontRoutes = require('./modules/storefront/storefront.routes');
const settingsRoutes = require('./modules/settings/settings.routes');
const promoRoutes = require('./modules/promo/promo.routes');
const categoryRoutes = require('./modules/category/category.routes');
const pricingModeRoutes = require('./modules/pricingMode/pricingMode.routes');

const app = express();

app.use(helmet());
app.use(cors({
  origin: config.corsOrigin.includes('*')
    ? true
    : (origin, callback) => {
        if (!origin || config.corsOrigin.includes(origin)) return callback(null, true);
        callback(new Error('Not allowed by CORS'));
      },
}));
// Limit dinaikkan dari default 100kb - file diupload sebagai base64 di body JSON (bukan file
// mentah), base64 nambah ~33% ukuran. File desain (kind 'design') boleh sampai 50MB asli
// (lihat storefrontUploadMaxDesignBytes di common/utils/fileUpload.js) - butuh ~68MB base64,
// jadi limit body di sini dinaikkan ke 70mb supaya tidak ketolak duluan sebelum sampai saveUpload().
app.use(express.json({ limit: '70mb' }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
if (config.nodeEnv !== 'test') {
  app.use(morgan(config.nodeEnv === 'development' ? 'dev' : 'combined'));
}

app.get('/health', (req, res) => res.json({ success: true, status: 'ok' }));

// M01
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
// M02
app.use('/api/customers', customersRoutes);
// Master Produk (katalog item cetak, referensi poDetails)
app.use('/api/products', productsRoutes);
// M03
app.use('/api/production-orders', productionOrdersRoutes);
// M04
app.use('/api/pos', posRoutes);
// M05
app.use('/api/inventory', inventoryRoutes);
// M06
app.use('/api/production', productionRoutes);
// M07
app.use('/api/qc-delivery', qcDeliveryRoutes);
// M08
app.use('/api/finance', financeRoutes);
// M09
app.use('/api/marketing', marketingRoutes);
// M10
app.use('/api/hrd', hrdRoutes);
// M11
app.use('/api/dashboard', dashboardRoutes);
// M12
app.use('/api/notifications', notificationsRoutes);
// Harga website (kalkulator landing page) - satu-satunya sumber, lihat pixelso_nodejs/ERP_INTEGRATION.md
app.use('/api/pricing', pricingRoutes);
app.use('/api/public/pricing', publicPricingRoutes);
// Storefront pelanggan (register/login/katalog/checkout/order) - lihat ~/pixelso-storefront
app.use('/api/storefront', storefrontRoutes);
// Identitas & konten halaman depan storefront (alamat, sosmed, foto hero/pendukung)
app.use('/api/settings', settingsRoutes);
// Promo storefront (manager-only CRUD - endpoint publik lewat /api/storefront/promos)
app.use('/api/promos', promoRoutes);
// Master Kategori - dipakai bareng Master Produk (internal) dan katalog storefront (Pricing)
app.use('/api/categories', categoryRoutes);
// Master Mode Harga - dipakai dropdown "Mode Harga" di Pricing, dikelola dari Master Produk
app.use('/api/pricing-modes', pricingModeRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
