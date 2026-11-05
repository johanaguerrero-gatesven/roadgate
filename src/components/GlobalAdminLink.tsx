import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { getGlobalAdminAccess } from "@/lib/admin.functions";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

export function GlobalAdminLink({ userId }: { userId: string }) {
  const { t } = useI18n();
  const { data } = useQuery({ queryKey: ["global-admin-access", userId], queryFn: () => getGlobalAdminAccess(), retry: false });
  if (!data) return null;
  return <Button asChild variant="ghost" size="sm"><Link to="/admin"><ShieldCheck />{t("admin.title")}</Link></Button>;
}