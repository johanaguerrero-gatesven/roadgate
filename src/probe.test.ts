import { test, expect } from "vitest";
import { Route } from "@/routes/api/public/v1/roadmaps/index";
test("probe", () => {
  console.log(Object.keys(Route), JSON.stringify(Object.keys((Route as any).options ?? {})));
  console.log(!!(Route as any).options?.server?.handlers);
  expect(1).toBe(1);
});
