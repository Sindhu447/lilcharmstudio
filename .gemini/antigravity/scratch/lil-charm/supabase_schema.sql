-- =========================================================
-- LIL CHARM HANDMADE CHARMS - SUPABASE DATABASE SCHEMA & RLS
-- =========================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------
-- 1. PRODUCTS TABLE
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    image_url TEXT,
    category TEXT DEFAULT 'General',
    stock INTEGER NOT NULL DEFAULT 0,
    is_available BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger for auto updating updated_at on products
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_products_timestamp ON public.products;
CREATE TRIGGER trg_update_products_timestamp
    BEFORE UPDATE ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

-- ---------------------------------------------------------
-- 2. ORDERS TABLE
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    payment_status TEXT NOT NULL DEFAULT 'Pending',
    razorpay_order_id TEXT,
    razorpay_payment_id TEXT,
    order_status TEXT NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------
-- 3. ORDER_ITEMS TABLE
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0.00
);

-- ---------------------------------------------------------
-- 4. ADMIN_USERS TABLE
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ---------------------------------------------------------

-- Enable RLS on all tables
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- PRODUCTS POLICIES
-- Anyone can view products (for customer storefront)
DROP POLICY IF EXISTS "Public products view access" ON public.products;
CREATE POLICY "Public products view access"
    ON public.products FOR SELECT
    USING (true);

-- Only service role or authenticated admins can insert/update/delete products
DROP POLICY IF EXISTS "Admin products write access" ON public.products;
CREATE POLICY "Admin products write access"
    ON public.products FOR ALL
    USING (
        auth.role() = 'service_role' OR 
        auth.uid() IN (SELECT id FROM public.admin_users)
    );

-- ORDERS POLICIES
-- Anyone can insert orders (customers creating checkout)
DROP POLICY IF EXISTS "Public order creation" ON public.orders;
CREATE POLICY "Public order creation"
    ON public.orders FOR INSERT
    WITH CHECK (true);

-- Service role and Admins can view and update orders
DROP POLICY IF EXISTS "Admin orders full access" ON public.orders;
CREATE POLICY "Admin orders full access"
    ON public.orders FOR ALL
    USING (
        auth.role() = 'service_role' OR 
        auth.uid() IN (SELECT id FROM public.admin_users)
    );

-- ORDER ITEMS POLICIES
-- Anyone can insert order items
DROP POLICY IF EXISTS "Public order items creation" ON public.order_items;
CREATE POLICY "Public order items creation"
    ON public.order_items FOR INSERT
    WITH CHECK (true);

-- Service role and Admins can view order items
DROP POLICY IF EXISTS "Admin order items full access" ON public.order_items;
CREATE POLICY "Admin order items full access"
    ON public.order_items FOR ALL
    USING (
        auth.role() = 'service_role' OR 
        auth.uid() IN (SELECT id FROM public.admin_users)
    );

-- ADMIN USERS POLICIES
DROP POLICY IF EXISTS "Admin users select access" ON public.admin_users;
CREATE POLICY "Admin users select access"
    ON public.admin_users FOR SELECT
    USING (
        auth.role() = 'service_role' OR 
        auth.uid() = id
    );

-- ---------------------------------------------------------
-- 5. SUPABASE STORAGE BUCKET CONFIGURATION
-- ---------------------------------------------------------
-- Run this in SQL Editor to create the product-images storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policy: Public access to view product images
DROP POLICY IF EXISTS "Public Access for Product Images" ON storage.objects;
CREATE POLICY "Public Access for Product Images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'product-images');

-- Storage Policy: Admin/Service Role upload access
DROP POLICY IF EXISTS "Admin Upload Access for Product Images" ON storage.objects;
CREATE POLICY "Admin Upload Access for Product Images"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'product-images');

-- ---------------------------------------------------------
-- SEED INITIAL SAMPLE PRODUCTS
-- ---------------------------------------------------------
INSERT INTO public.products (name, description, price, image_url, category, stock, is_available)
VALUES 
('Strawberry Pastel Charm', 'Handcrafted polymer clay strawberry keychain with glossy resin coat.', 249.00, 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80', 'Keychains', 25, true),
('Matchy Donut Couple Charms', 'Set of two matching donut keychains personalized for besties and couples.', 399.00, 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=800&q=80', 'Couple Charms', 15, true),
('Cute Avocado Bag Charm', 'Adorable miniature avocado charm with custom initials tag.', 199.00, 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80', 'Bag Charms', 10, true),
('Pink Boba Milk Tea Charm', 'Miniature boba tea keychain with floating pearls detail.', 299.00, 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=800&q=80', 'Keychains', 18, true)
ON CONFLICT DO NOTHING;
