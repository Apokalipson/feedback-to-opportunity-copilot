import { createAnalysisPostHandler } from "@/lib/analysis/route-handler";
import { analyzeCurrentImport } from "@/lib/analysis/service";
import { getImportActor } from "@/lib/data/imports";

export const runtime = "nodejs";

export const POST = createAnalysisPostHandler({
  getActor: getImportActor,
  analyze: analyzeCurrentImport,
});
