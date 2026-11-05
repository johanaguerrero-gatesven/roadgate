import { queryOptions } from "@tanstack/react-query";
import { getAdminRegistrations } from "./admin.functions";

export const adminRegistrationsOptions = (page: number, userId: string) => queryOptions({
  queryKey: ["admin-registrations", userId, page],
  queryFn: () => getAdminRegistrations({ data: { page } }),
  staleTime: 0,
});