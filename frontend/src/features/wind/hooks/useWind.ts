
import { useQuery } from "@tanstack/react-query";

import windService, {
  type WindAnalysis,
  type WindQuery,
} from "../services/wind.service";

export const windQueryKeys = {
  all: ["wind"] as const,

  analysis: (query: WindQuery) =>
    [
      ...windQueryKeys.all,
      "analysis",
      query.startDate ?? "2026-01-01",
      query.endDate ?? "2026-02-01",
      query.cutoffHour ?? 9,
      query.cutoffMinute ?? 0,
    ] as const,
};

export function useWind(query: WindQuery) {
  const normalizedQuery: WindQuery = {
    startDate: query.startDate ?? "2026-01-01",
    endDate: query.endDate ?? "2026-02-01",
    cutoffHour: query.cutoffHour ?? 9,
    cutoffMinute: query.cutoffMinute ?? 0,
  };

  return useQuery<WindAnalysis, Error>({
    queryKey: windQueryKeys.analysis(normalizedQuery),
    queryFn: ({ signal }) =>
      windService.getAnalysis(normalizedQuery, signal),
    staleTime: 60_000,
    retry: 1,
  });
}

export default useWind;
