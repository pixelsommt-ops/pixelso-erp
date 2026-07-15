require('dotenv').config();

module.exports = {
  port: process.env.PORT || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  corsOrigin: (process.env.CORS_ORIGIN || '*')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  landingPageApiKey: process.env.LANDING_PAGE_API_KEY,
  customerJwtSecret: process.env.CUSTOMER_JWT_SECRET,
  customerJwtExpiresIn: process.env.CUSTOMER_JWT_EXPIRES_IN || '30d',
  storefrontUploadMaxDesignBytes: Number(process.env.STOREFRONT_UPLOAD_MAX_DESIGN_BYTES || 50 * 1024 * 1024),
  storefrontUploadMaxProofBytes: Number(process.env.STOREFRONT_UPLOAD_MAX_PROOF_BYTES || 3 * 1024 * 1024),
  pricingUploadMaxPhotoBytes: Number(process.env.PRICING_UPLOAD_MAX_PHOTO_BYTES || 5 * 1024 * 1024),
};
