CREATE TYPE "public"."billing_interval" AS ENUM('month', 'year');--> statement-breakpoint
CREATE TYPE "public"."product_kind" AS ENUM('item', 'subscription', 'giftcard');--> statement-breakpoint
CREATE TABLE "gift_card_redemptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"gift_card_id" integer NOT NULL,
	"order_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"restored_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "gift_cards" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"initial_balance" integer NOT NULL,
	"balance" integer NOT NULL,
	"currency" text NOT NULL,
	"order_id" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gift_cards_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"stripe_subscription_id" text NOT NULL,
	"order_id" integer NOT NULL,
	"status" text NOT NULL,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "kind" "product_kind" DEFAULT 'item' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "gift_from" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "gift_card_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "stripe_subscription_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "stripe_invoice_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "renewal_of" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "kind" "product_kind" DEFAULT 'item' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "interval" "billing_interval";--> statement-breakpoint
ALTER TABLE "gift_card_redemptions" ADD CONSTRAINT "gift_card_redemptions_gift_card_id_gift_cards_id_fk" FOREIGN KEY ("gift_card_id") REFERENCES "public"."gift_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_card_redemptions" ADD CONSTRAINT "gift_card_redemptions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_cards" ADD CONSTRAINT "gift_cards_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gift_card_redemptions_order_idx" ON "gift_card_redemptions" USING btree ("order_id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_stripe_invoice_id_unique" UNIQUE("stripe_invoice_id");