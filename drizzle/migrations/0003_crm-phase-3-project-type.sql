CREATE TYPE "public"."project_type" AS ENUM('CLIENT', 'PERSONAL', 'INTERNAL');--> statement-breakpoint
ALTER TABLE "projects" DROP CONSTRAINT "projects_personal_internal_client_check";--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "type" "project_type" DEFAULT 'CLIENT' NOT NULL;--> statement-breakpoint
UPDATE "projects" SET "type" = 'PERSONAL' WHERE is_personal = true;--> statement-breakpoint
UPDATE "projects" SET "type" = 'INTERNAL' WHERE is_internal = true;--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "is_personal";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "is_internal";--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_type_client_check" CHECK ((
        (type = 'CLIENT' AND client_id IS NOT NULL)
        OR (
          type IN ('PERSONAL', 'INTERNAL')
          AND client_id IS NULL
        )
      ));
