ALTER TABLE "orders" ADD COLUMN "payment_provider" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "mp_preference_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "mp_payment_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_mp_payment_id_unique" UNIQUE("mp_payment_id");