import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  createHarvestrRoadmap,
  type CreateHarvestrRoadmapInput,
  type CreateHarvestrRoadmapResult,
} from "@/lib/harvestr.functions";

/**
 * Crea un roadmap en Harvestr a través del adaptador server-side.
 * El token nunca llega al navegador.
 */
export function useCreateHarvestrRoadmap() {
  const call = useServerFn(createHarvestrRoadmap);

  return useMutation<CreateHarvestrRoadmapResult, Error, CreateHarvestrRoadmapInput>({
    mutationFn: (input) => call({ data: input }),
  });
}
