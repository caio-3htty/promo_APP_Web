import { promises as fs } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const distDir = path.resolve(process.cwd(), "dist");
const outputPath = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : path.join(distDir, "bundle-report.json");
const textOutputPath = path.join(path.dirname(outputPath), "bundle-report.txt");

const toKb = (bytes) => Number((bytes / 1024).toFixed(2));

async function collectFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const result = [];

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...(await collectFiles(entryPath)));
    } else if (entry.isFile()) {
      result.push(entryPath);
    }
  }

  return result;
}

function normalizeScriptPath(rawScriptPath) {
  if (!rawScriptPath) return null;
  if (rawScriptPath.startsWith("http://") || rawScriptPath.startsWith("https://")) {
    return new URL(rawScriptPath).pathname.replace(/^\/+/, "");
  }
  return rawScriptPath.replace(/^\/+/, "").replace(/^\.\//, "");
}

async function main() {
  const indexPath = path.join(distDir, "index.html");
  const indexHtml = await fs.readFile(indexPath, "utf8");
  const match = indexHtml.match(/<script[^>]*src="([^"]+\.js)"/i);

  if (!match) {
    throw new Error("Nao foi possivel localizar o chunk principal em dist/index.html");
  }

  const mainChunkRelative = normalizeScriptPath(match[1]);
  const mainChunkPath = path.join(distDir, mainChunkRelative.replace(/^dist\//, ""));

  const allFiles = await collectFiles(path.join(distDir, "assets"));
  const jsFiles = allFiles.filter((file) => file.endsWith(".js"));
  const cssFiles = allFiles.filter((file) => file.endsWith(".css"));

  const chunkDetails = await Promise.all(
    jsFiles.map(async (filePath) => {
      const content = await fs.readFile(filePath);
      const sizeBytes = content.length;
      const gzipBytes = gzipSync(content).length;
      return {
        file: path.relative(distDir, filePath).replace(/\\/g, "/"),
        sizeBytes,
        sizeKb: toKb(sizeBytes),
        gzipBytes,
        gzipKb: toKb(gzipBytes),
      };
    })
  );

  chunkDetails.sort((a, b) => b.sizeBytes - a.sizeBytes);

  const mainChunk = chunkDetails.find((chunk) => chunk.file === mainChunkRelative) ?? null;
  if (!mainChunk || !(await fs.stat(mainChunkPath).catch(() => null))) {
    throw new Error(`Chunk principal nao encontrado: ${mainChunkRelative}`);
  }

  const totalJsBytes = chunkDetails.reduce((acc, chunk) => acc + chunk.sizeBytes, 0);
  const totalJsGzipBytes = chunkDetails.reduce((acc, chunk) => acc + chunk.gzipBytes, 0);

  const report = {
    generatedAt: new Date().toISOString(),
    mainChunk: {
      file: mainChunk.file,
      sizeBytes: mainChunk.sizeBytes,
      sizeKb: mainChunk.sizeKb,
      gzipBytes: mainChunk.gzipBytes,
      gzipKb: mainChunk.gzipKb,
    },
    jsChunkCount: jsFiles.length,
    cssChunkCount: cssFiles.length,
    totalJsBytes,
    totalJsKb: toKb(totalJsBytes),
    totalJsGzipBytes,
    totalJsGzipKb: toKb(totalJsGzipBytes),
    chunks: chunkDetails,
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const summary = [
    `main_chunk=${report.mainChunk.file}`,
    `main_js_bytes=${report.mainChunk.sizeBytes}`,
    `main_js_gzip_bytes=${report.mainChunk.gzipBytes}`,
    `js_chunk_count=${report.jsChunkCount}`,
    `css_chunk_count=${report.cssChunkCount}`,
    `total_js_bytes=${report.totalJsBytes}`,
    `total_js_gzip_bytes=${report.totalJsGzipBytes}`,
  ].join("\n");

  await fs.writeFile(textOutputPath, `${summary}\n`, "utf8");
  console.log(summary);
  console.log(`bundle_report_path=${path.relative(process.cwd(), outputPath).replace(/\\/g, "/")}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
