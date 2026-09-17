-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'SALES_USER');

-- CreateEnum
CREATE TYPE "EnquiryStatus" AS ENUM ('NEW', 'QUOTED', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SalesOrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DISPATCHED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" SERIAL NOT NULL,
    "company_name" VARCHAR(255) NOT NULL,
    "contact_person" VARCHAR(255) NOT NULL,
    "mobile" VARCHAR(50) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "city" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "product_code" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "category" VARCHAR(255) NOT NULL,
    "unit" VARCHAR(50) NOT NULL,
    "base_price" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "physical_quantity" INTEGER NOT NULL,
    "reserved_quantity" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enquiries" (
    "id" SERIAL NOT NULL,
    "enquiry_number" VARCHAR(255) NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "enquiry_date" TIMESTAMP(3) NOT NULL,
    "required_date" TIMESTAMP(3),
    "notes" TEXT,
    "status" "EnquiryStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enquiry_items" (
    "id" SERIAL NOT NULL,
    "enquiry_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enquiry_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotations" (
    "id" SERIAL NOT NULL,
    "quotation_number" VARCHAR(255) NOT NULL,
    "enquiry_id" INTEGER NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "valid_until" TIMESTAMP(3) NOT NULL,
    "status" "QuotationStatus" NOT NULL,
    "grand_total" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_items" (
    "id" SERIAL NOT NULL,
    "quotation_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "discount_pct" DECIMAL(5,2) NOT NULL,
    "gst_pct" DECIMAL(5,2) NOT NULL,
    "line_amount" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_orders" (
    "id" SERIAL NOT NULL,
    "order_number" VARCHAR(255) NOT NULL,
    "quotation_id" INTEGER,
    "customer_id" INTEGER NOT NULL,
    "order_date" TIMESTAMP(3) NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "status" "SalesOrderStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_order_items" (
    "id" SERIAL NOT NULL,
    "sales_order_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispatches" (
    "id" SERIAL NOT NULL,
    "dispatch_number" VARCHAR(255) NOT NULL,
    "sales_order_id" INTEGER NOT NULL,
    "dispatch_date" TIMESTAMP(3) NOT NULL,
    "vehicle_number" VARCHAR(255),
    "driver_name" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispatch_items" (
    "id" SERIAL NOT NULL,
    "dispatch_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispatch_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "customers_company_name_email_key" ON "customers"("company_name", "email");

-- CreateIndex
CREATE INDEX "customers_company_name_idx" ON "customers"("company_name");

-- CreateIndex
CREATE INDEX "customers_email_idx" ON "customers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "products_product_code_key" ON "products"("product_code");

-- CreateIndex
CREATE INDEX "products_category_idx" ON "products"("category");

-- CreateIndex
CREATE INDEX "products_name_idx" ON "products"("name");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_product_id_key" ON "inventory"("product_id");

-- CreateIndex
CREATE INDEX "inventory_product_id_idx" ON "inventory"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "enquiries_enquiry_number_key" ON "enquiries"("enquiry_number");

-- CreateIndex
CREATE INDEX "enquiries_customer_id_idx" ON "enquiries"("customer_id");

-- CreateIndex
CREATE INDEX "enquiries_status_idx" ON "enquiries"("status");

-- CreateIndex
CREATE UNIQUE INDEX "enquiry_items_enquiry_id_product_id_key" ON "enquiry_items"("enquiry_id", "product_id");

-- CreateIndex
CREATE INDEX "enquiry_items_enquiry_id_idx" ON "enquiry_items"("enquiry_id");

-- CreateIndex
CREATE INDEX "enquiry_items_product_id_idx" ON "enquiry_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_quotation_number_key" ON "quotations"("quotation_number");

-- CreateIndex
CREATE INDEX "quotations_enquiry_id_idx" ON "quotations"("enquiry_id");

-- CreateIndex
CREATE INDEX "quotations_customer_id_idx" ON "quotations"("customer_id");

-- CreateIndex
CREATE INDEX "quotations_status_idx" ON "quotations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "quotation_items_quotation_id_product_id_key" ON "quotation_items"("quotation_id", "product_id");

-- CreateIndex
CREATE INDEX "quotation_items_quotation_id_idx" ON "quotation_items"("quotation_id");

-- CreateIndex
CREATE INDEX "quotation_items_product_id_idx" ON "quotation_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_order_number_key" ON "sales_orders"("order_number");

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_quotation_id_key" ON "sales_orders"("quotation_id");

-- CreateIndex
CREATE INDEX "sales_orders_customer_id_idx" ON "sales_orders"("customer_id");

-- CreateIndex
CREATE INDEX "sales_orders_status_idx" ON "sales_orders"("status");

-- CreateIndex
CREATE INDEX "sales_orders_quotation_id_idx" ON "sales_orders"("quotation_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_order_items_sales_order_id_product_id_key" ON "sales_order_items"("sales_order_id", "product_id");

-- CreateIndex
CREATE INDEX "sales_order_items_sales_order_id_idx" ON "sales_order_items"("sales_order_id");

-- CreateIndex
CREATE INDEX "sales_order_items_product_id_idx" ON "sales_order_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "dispatches_dispatch_number_key" ON "dispatches"("dispatch_number");

-- CreateIndex
CREATE INDEX "dispatches_sales_order_id_idx" ON "dispatches"("sales_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "dispatch_items_dispatch_id_product_id_key" ON "dispatch_items"("dispatch_id", "product_id");

-- CreateIndex
CREATE INDEX "dispatch_items_dispatch_id_idx" ON "dispatch_items"("dispatch_id");

-- CreateIndex
CREATE INDEX "dispatch_items_product_id_idx" ON "dispatch_items"("product_id");

-- AddForeignKey
ALTER TABLE "inventory"
ADD CONSTRAINT "inventory_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiries"
ADD CONSTRAINT "enquiries_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiry_items"
ADD CONSTRAINT "enquiry_items_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "enquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiry_items"
ADD CONSTRAINT "enquiry_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations"
ADD CONSTRAINT "quotations_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "enquiries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations"
ADD CONSTRAINT "quotations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items"
ADD CONSTRAINT "quotation_items_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items"
ADD CONSTRAINT "quotation_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders"
ADD CONSTRAINT "sales_orders_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders"
ADD CONSTRAINT "sales_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_items"
ADD CONSTRAINT "sales_order_items_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_items"
ADD CONSTRAINT "sales_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatches"
ADD CONSTRAINT "dispatches_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_items"
ADD CONSTRAINT "dispatch_items_dispatch_id_fkey" FOREIGN KEY ("dispatch_id") REFERENCES "dispatches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_items"
ADD CONSTRAINT "dispatch_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Checks
ALTER TABLE "products"
ADD CONSTRAINT "products_base_price_check" CHECK ("base_price" >= 0);

ALTER TABLE "inventory"
ADD CONSTRAINT "inventory_physical_quantity_check" CHECK ("physical_quantity" >= 0),
ADD CONSTRAINT "inventory_reserved_quantity_check" CHECK ("reserved_quantity" >= 0),
ADD CONSTRAINT "inventory_reserved_quantity_lte_physical_quantity_check" CHECK ("reserved_quantity" <= "physical_quantity");

ALTER TABLE "enquiry_items"
ADD CONSTRAINT "enquiry_items_quantity_check" CHECK ("quantity" > 0);

ALTER TABLE "quotations"
ADD CONSTRAINT "quotations_grand_total_check" CHECK ("grand_total" >= 0);

ALTER TABLE "quotation_items"
ADD CONSTRAINT "quotation_items_quantity_check" CHECK ("quantity" > 0),
ADD CONSTRAINT "quotation_items_unit_price_check" CHECK ("unit_price" >= 0),
ADD CONSTRAINT "quotation_items_discount_pct_check" CHECK ("discount_pct" >= 0 AND "discount_pct" <= 100),
ADD CONSTRAINT "quotation_items_gst_pct_check" CHECK ("gst_pct" >= 0),
ADD CONSTRAINT "quotation_items_line_amount_check" CHECK ("line_amount" >= 0);

ALTER TABLE "sales_orders"
ADD CONSTRAINT "sales_orders_total_amount_check" CHECK ("total_amount" >= 0);

ALTER TABLE "sales_order_items"
ADD CONSTRAINT "sales_order_items_quantity_check" CHECK ("quantity" > 0),
ADD CONSTRAINT "sales_order_items_unit_price_check" CHECK ("unit_price" >= 0);

ALTER TABLE "dispatch_items"
ADD CONSTRAINT "dispatch_items_quantity_check" CHECK ("quantity" > 0);

