# 🎀 Lil Charm E-Commerce - Setup & Deployment Guide

This guide details how to set up, configure, run, and deploy the upgraded **Lil Charm** handmade clay charm e-commerce platform with **Supabase Database, Supabase Storage, Razorpay Payments, Stock Validation, and Admin Dashboard**.

---

## 1. Supabase Database & Schema Setup

### Steps to set up your Supabase Database:
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard) and select your project.
2. Open the **SQL Editor** tab from the left sidebar.
3. Click **New Query**, paste the contents of `supabase_schema.sql` (found in your repository root), and click **Run**.

### Required Database Tables:

* **`products`**: Stores catalog items (`id`, `name`, `description`, `price`, `image_url`, `category`, `stock`, `is_available`, `created_at`, `updated_at`).
* **`orders`**: Stores customer checkout orders (`id`, `customer_name`, `email`, `phone`, `address`, `total_amount`, `payment_status`, `razorpay_order_id`, `razorpay_payment_id`, `order_status`, `created_at`).
* **`order_items`**: Stores individual line items per order (`id`, `order_id`, `product_id`, `quantity`, `price`).
* **`admin_users`**: Stores authorized admin emails and roles (`id`, `email`, `role`, `created_at`).

### Row Level Security (RLS) Policies (Included in `supabase_schema.sql`):
* `products`: Public `SELECT` allowed for store visitors; `INSERT/UPDATE/DELETE` allowed only for authenticated admins or service role.
* `orders`: Public `INSERT` allowed for customer checkouts; `SELECT/UPDATE` allowed only for authenticated admins or service role.
* `order_items`: Public `INSERT` allowed for line items; `SELECT` allowed for admins.
* `admin_users`: `SELECT` allowed for admins & service role.

---

## 2. Supabase Storage Bucket Setup

1. In your Supabase Dashboard, navigate to **Storage**.
2. Click **Create a new bucket**.
3. Set **Bucket Name**: `product-images`.
4. Turn ON **Public Bucket** so product images can be viewed publicly by store customers.
5. Click **Save**.

---

## 3. Required Environment Variables

Create a file named `.env` in the root of your project directory based on `.env.example`:

```env
PORT=3000

# Supabase Credentials (from Supabase Dashboard > Project Settings > API)
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_public_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Razorpay Credentials (from Razorpay Dashboard > Settings > API Keys)
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_razorpay_secret_key

# Admin Session JWT Key
JWT_SECRET=lil_charm_super_secret_jwt_key_2026!

# Default Local Admin Backup Credentials
ADMIN_EMAIL=admin@lilcharm.com
ADMIN_DEFAULT_PASSWORD=AdminPass123!
```

> [!CAUTION]
> **Never commit your `.env` file or `SUPABASE_SERVICE_ROLE_KEY` / `RAZORPAY_KEY_SECRET` to GitHub.**

---

## 4. Razorpay Setup Steps

1. Sign up / Log in to your [Razorpay Dashboard](https://dashboard.razorpay.com).
2. Switch to **Test Mode** (or Live Mode when ready for real transactions).
3. Navigate to **Account & Settings** > **API Keys**.
4. Click **Generate Key** to generate a `Key ID` and `Key Secret`.
5. Copy the `Key ID` into `RAZORPAY_KEY_ID` in `.env`.
6. Copy the `Key Secret` into `RAZORPAY_KEY_SECRET` in `.env`.

---

## 5. Admin Account Creation Steps

To grant a user access to the `/admin` portal:

1. Open your Supabase Dashboard > **Authentication** > **Users**.
2. Click **Add User** > **Create User** and enter your admin email (e.g. `admin@lilcharm.com`) and password.
3. Next, open the **SQL Editor** in Supabase and add the admin user email to `admin_users`:

```sql
INSERT INTO public.admin_users (email, role)
VALUES ('admin@lilcharm.com', 'admin')
ON CONFLICT (email) DO NOTHING;
```

Now you can log into `http://localhost:3000/admin.html` with your admin email and password.

---

## 6. Local Development Instructions

1. Open a terminal in the `lil-charm` directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the application:
   ```bash
   npm run dev
   ```
4. Access the applications:
   - **Customer Website**: `http://localhost:3000`
   - **Admin Dashboard**: `http://localhost:3000/admin.html` (or `http://localhost:3000/admin`)

---

## 7. Production Deployment Instructions

### Deploying the Backend & Frontend (Render / Railway / Vercel / Node Server)

1. Push your repository to GitHub (ensure `.env` is listed in `.gitignore`).
2. Log in to [Render](https://render.com) or [Railway](https://railway.app).
3. Click **New Web Service** and connect your GitHub repository.
4. Set Build Command: `npm install`
5. Set Start Command: `npm start`
6. Under **Environment Variables**, add all keys from your `.env` file:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `RAZORPAY_KEY_ID`
   - `RAZORPAY_KEY_SECRET`
   - `JWT_SECRET`
7. Deploy the service!

### Live Mode Checklist for Razorpay:
- In Razorpay Dashboard, complete KYC verification.
- Switch Razorpay mode from Test to Live.
- Generate Live API keys (`Key ID` and `Key Secret`).
- Update your production Environment Variables with the Live Razorpay keys.
