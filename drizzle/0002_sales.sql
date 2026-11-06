CREATE TABLE "sales" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"percent" integer NOT NULL,
	"category_id" integer,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sales_window_idx" ON "sales" USING btree ("starts_at","ends_at");