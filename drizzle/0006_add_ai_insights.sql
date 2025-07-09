CREATE TABLE "ai_insights" (
	"id" serial PRIMARY KEY NOT NULL,
	"restaurant_id" integer NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"recommendations" jsonb,
	"data_source" jsonb,
	"confidence" numeric(5, 2) NOT NULL,
	"priority" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"implementation_status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "ai_insights_restaurant_id_idx" ON "ai_insights" ("restaurant_id");
CREATE INDEX "ai_insights_type_idx" ON "ai_insights" ("type");
CREATE INDEX "ai_insights_priority_idx" ON "ai_insights" ("priority");
CREATE INDEX "ai_insights_is_read_idx" ON "ai_insights" ("is_read");
ALTER TABLE "ai_insights" ADD CONSTRAINT "ai_insights_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;