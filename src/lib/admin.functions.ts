import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isGlobalAdmin, listAdminRegistrations } from "@/core/services/admin-service";

export const getGlobalAdminAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) => isGlobalAdmin({ db: context.supabase, userId: context.userId }));

export const getAdminRegistrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ page: z.number().int().min(0).max(100000).default(0) }))
  .handler(({ context, data }) => listAdminRegistrations({ db: context.supabase, userId: context.userId }, data.page));