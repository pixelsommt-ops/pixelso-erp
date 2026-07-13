# Pixelso ERP

Boilerplate ERP untuk operasional digital printing Pixelso (PO desain → POS → produksi → inventory → finance → marketing → HRD → dashboard manajer), berdasarkan dokumen `ERP_Digital_Printing_Pixelso_BRD_PRD_ERD_Versi_Sempurna`.

## Stack

- Backend: Node.js + Express, Prisma ORM, MySQL
- Frontend: React + Vite, React Router, Zustand
- Struktur: monorepo (`backend/`, `frontend/`)

## Struktur Folder

```
pixelso-erp/
├── backend/
│   ├── prisma/schema.prisma   # 15 entitas ERD (PRD 4.1 Kamus Data)
│   ├── src/
│   │   ├── modules/           # 1 folder per modul M01-M12
│   │   ├── common/            # middleware, errors, utils, constants
│   │   ├── config/
│   │   ├── db/                # prisma client
│   │   ├── app.js
│   │   └── server.js
├── frontend/
│   ├── src/
│   │   ├── pages/              # 1 folder per modul
│   │   ├── components/layout/  # Sidebar, Topbar
│   │   ├── layouts/
│   │   ├── routes/
│   │   ├── services/           # axios client per modul
│   │   └── store/              # zustand (auth)
└── docs/                       # simpan salinan PRD/ERD sumber di sini
```

## Mapping Modul PRD -> Folder

| Kode | Modul (PRD 3.2)              | backend/src/modules   | frontend/src/pages    |
|------|-------------------------------|------------------------|------------------------|
| M01  | User & Role Management        | `auth/`, `users/`      | `auth/`, `users/`      |
| M02  | Customer & CRM Ringkas         | `customers/`           | `customers/`           |
| M03  | Production Order / PO          | `production-orders/`   | `production-orders/`   |
| M04  | POS & Pembayaran               | `pos/`                 | `pos/`                 |
| M05  | Inventory                      | `inventory/`           | `inventory/`           |
| M06  | Produksi                       | `production/`          | `production/`          |
| M07  | QC & Delivery                  | `qc-delivery/`         | `qc-delivery/`         |
| M08  | Finance & Bonus                | `finance/`              | `finance/`             |
| M09  | Marketing Analytics            | `marketing/`            | `marketing/`           |
| M10  | HRD Productivity               | `hrd/`                  | `hrd/`                 |
| M11  | Manager Dashboard              | `dashboard/`            | `dashboard/`           |
| M12  | Notification & Approval        | `notifications/`        | (terintegrasi di Topbar/alerts) |

Setiap modul backend mengikuti pola `*.routes.js` -> `*.controller.js` -> `*.service.js` -> Prisma. Endpoint dan logika masih berupa stub (`TODO`) dan perlu diimplementasikan sesuai Functional Requirements di PRD 3.3.

## Setup

```bash
# 1. install dependencies
npm install --workspaces

# 2. backend env
cp backend/.env.example backend/.env
# isi DATABASE_URL (MySQL) dan JWT_SECRET

# 3. migrate & seed database
cd backend
npm run prisma:migrate
npm run prisma:seed

# 4. jalankan backend (port 4000) dan frontend (port 5173)
npm run dev:backend
npm run dev:frontend

# frontend env
cp frontend/.env.example frontend/.env
```

## Referensi

Status lifecycle PO, aturan RBAC per role, dan rumus bonus mengikuti PRD section 3.1, 3.5, dan 3.6. Lihat `backend/src/common/constants/index.js` untuk konstanta `PO_STATUS` dan `ROLES`.
