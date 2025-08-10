import { NextRequest } from "next/server";
import JSZip from "jszip";
import { generatePythonA2AServer } from "@/lib/openai_action";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { agentDescription, services, model, reasoningEffort } = await req.json().catch(() => ({}));
  if (!agentDescription) return new Response("agentDescription required", { status: 400 });

  const result = await generatePythonA2AServer({ agentDescription, services, model, reasoningEffort });

  const wantZip = req.nextUrl.searchParams.get("zip");
  if (!wantZip) {
    return Response.json(result); // Should be { files: [...] }
  }

  const zip = new JSZip();
  for (const f of result.files) zip.file(f.path, f.content);

  // Generate a raw binary buffer (Uint8Array) and set explicit length
  const content = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 }
  });

  return new Response(content, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="a2a-python-server.zip"',
      "Content-Length": String(content.byteLength),
      "Cache-Control": "no-store",
      "Accept-Ranges": "bytes"
    }
  });
}   