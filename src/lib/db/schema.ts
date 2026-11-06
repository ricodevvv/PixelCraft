import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const orderStatus = pgEnum("order_status", ["pending", "paid", "refunded", "cancelled"]);
export const execution = pgEnum("execution", ["BUY", "RECOVER", "REFUND"]);
export const couponType = pgEnum("coupon_type", ["percent", "fixed"]);
export const productKind = pgEnum("product_kind", ["item", "subscription", "giftcard"]);
export const billingInterval = pgEnum("billing_interval", ["month", "year"]);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  image: text("image"),
  sort: integer("sort").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    tagline: text("tagline").notNull().default(""),
    description: text("description").notNull().default(""),
    image: text("image"),
    kind: productKind("kind").notNull().default("item"),
    interval: billingInterval("interval"),
    price: integer("price").notNull(),
    comparePrice: integer("compare_price"),
    categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
    group: text("group").notNull(),
    itemId: text("item_id").notNull(),
    maxQuantity: integer("max_quantity").notNull().default(1),
    featured: boolean("featured").notNull().default(false),
    active: boolean("active").notNull().default(true),
    sort: integer("sort").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("products_category_idx").on(t.categoryId)],
);

export const coupons = pgTable("coupons", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  type: couponType("type").notNull().default("percent"),
  value: integer("value").notNull(),
  maxUses: integer("max_uses"),
  uses: integer("uses").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orders = pgTable(
  "orders",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity({ startWith: 1001 }),
    playerName: text("player_name").notNull(),
    playerUuid: text("player_uuid"),
    giftFrom: text("gift_from"),
    email: text("email"),
    status: orderStatus("status").notNull().default("pending"),
    currency: text("currency").notNull(),
    subtotal: integer("subtotal").notNull(),
    discount: integer("discount").notNull().default(0),
    total: integer("total").notNull(),
    giftCardAmount: integer("gift_card_amount").notNull().default(0),
    couponCode: text("coupon_code"),
    stripeSessionId: text("stripe_session_id").unique(),
    stripePaymentIntent: text("stripe_payment_intent"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    stripeInvoiceId: text("stripe_invoice_id").unique(),
    paymentProvider: text("payment_provider"),
    mpPreferenceId: text("mp_preference_id"),
    mpPaymentId: text("mp_payment_id").unique(),
    renewalOf: integer("renewal_of"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (t) => [index("orders_status_idx").on(t.status), index("orders_paid_at_idx").on(t.paidAt)],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    kind: productKind("kind").notNull().default("item"),
    group: text("group").notNull(),
    itemId: text("item_id").notNull(),
    quantity: integer("quantity").notNull(),
    unitPrice: integer("unit_price").notNull(),
    total: integer("total").notNull(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

export const deliveries = pgTable(
  "deliveries",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    group: text("group").notNull(),
    execution: execution("execution").notNull().default("BUY"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  },
  (t) => [
    index("deliveries_pending_idx").on(t.group, t.deliveredAt),
    index("deliveries_order_idx").on(t.orderId),
  ],
);

export const servers = pgTable(
  "servers",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    group: text("group").notNull(),
    secret: text("secret").notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("servers_secret_idx").on(t.secret)],
);

export const giftCards = pgTable("gift_cards", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  initialBalance: integer("initial_balance").notNull(),
  balance: integer("balance").notNull(),
  currency: text("currency").notNull(),
  orderId: integer("order_id").references(() => orders.id, { onDelete: "set null" }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const giftCardRedemptions = pgTable(
  "gift_card_redemptions",
  {
    id: serial("id").primaryKey(),
    giftCardId: integer("gift_card_id")
      .notNull()
      .references(() => giftCards.id, { onDelete: "cascade" }),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    restoredAt: timestamp("restored_at", { withTimezone: true }),
  },
  (t) => [index("gift_card_redemptions_order_idx").on(t.orderId)],
);

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  stripeSubscriptionId: text("stripe_subscription_id").notNull().unique(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sales = pgTable(
  "sales",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    percent: integer("percent").notNull(),
    categoryId: integer("category_id").references(() => categories.id, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sales_window_idx").on(t.startsAt, t.endsAt)],
);

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
});

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
}));

export const ordersRelations = relations(orders, ({ many }) => ({
  items: many(orderItems),
  deliveries: many(deliveries),
  giftCards: many(giftCards),
  redemptions: many(giftCardRedemptions),
  subscriptions: many(subscriptions),
}));

export const giftCardsRelations = relations(giftCards, ({ one }) => ({
  order: one(orders, { fields: [giftCards.orderId], references: [orders.id] }),
}));

export const giftCardRedemptionsRelations = relations(giftCardRedemptions, ({ one }) => ({
  order: one(orders, { fields: [giftCardRedemptions.orderId], references: [orders.id] }),
  giftCard: one(giftCards, { fields: [giftCardRedemptions.giftCardId], references: [giftCards.id] }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  order: one(orders, { fields: [subscriptions.orderId], references: [orders.id] }),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
}));

export const deliveriesRelations = relations(deliveries, ({ one }) => ({
  order: one(orders, { fields: [deliveries.orderId], references: [orders.id] }),
}));

export type Category = typeof categories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Coupon = typeof coupons.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Delivery = typeof deliveries.$inferSelect;
export type Server = typeof servers.$inferSelect;
export type Sale = typeof sales.$inferSelect;
export type GiftCard = typeof giftCards.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type ProductKind = (typeof productKind.enumValues)[number];
