import { promises as fs } from "node:fs";
import path from "node:path";

const reportPath = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : path.resolve(process.cwd(), "dist", "bundle-report.json");
const budgetPath = path.resolve(process.cwd(), "docs", "performance", "bundle-budget.json");

async function main() {
  const [reportRaw, budgetRaw] = await Promise.all([
    fs.readFile(reportPath, "utf8"),
    fs.readFile(budgetPath, "utf8"),
  ]);

  const report = JSON.parse(reportRaw);
  const budget = JSON.parse(budgetRaw);

  const failures = [];

  if (budget.maxMainChunkBytes != null && report.mainChunk.sizeBytes > budget.maxMainChunkBytes) {
    failures.push(
      `mainChunk.sizeBytes ${report.mainChunk.sizeBytes} > limite ${budget.maxMainChunkBytes}`
    );
  }

  if (budget.maxMainChunkGzipBytes != null && report.mainChunk.gzipBytes > budget.maxMainChunkGzipBytes) {
    failures.push(
      `mainChunk.gzipBytes ${report.mainChunk.gzipBytes} > limite ${budget.maxMainChunkGzipBytes}`
    );
  }

  if (budget.maxTotalJsBytes != null && report.totalJsBytes > budget.maxTotalJsBytes) {
    failures.push(`totalJsBytes ${report.totalJsBytes} > limite ${budget.maxTotalJsBytes}`);
  }

  if (budget.maxJsChunkCount != null && report.jsChunkCount > budget.maxJsChunkCount) {
    failures.push(`jsChunkCount ${report.jsChunkCount} > limite ${budget.maxJsChunkCount}`);
  }

  if (failures.length > 0) {
    console.error("Bundle budget excedido:");
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
  }

  console.log("Bundle budget OK");
  console.log(`main_js_bytes=${report.mainChunk.sizeBytes}`);
  console.log(`main_js_gzip_bytes=${report.mainChunk.gzipBytes}`);
  console.log(`js_chunk_count=${report.jsChunkCount}`);
  console.log(`total_js_bytes=${report.totalJsBytes}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
