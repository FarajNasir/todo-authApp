import { NextResponse } from "next/server";
import mammoth from "mammoth";
import PDFParser from "pdf2json";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// ✅ Safe decode for pdf2json
function safeDecode(str: string) {
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}

// ✅ Extract PDF text (better spacing + lines)
function extractPdfText(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on("pdfParser_dataError", (err: any) => reject(err));

    pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
      try {
        let finalText = "";

        for (const page of pdfData?.Pages || []) {
          const lines: Record<string, any[]> = {};

          for (const item of page?.Texts || []) {
            const y = item?.y?.toFixed(2) || "0.00";

            const str = (item?.R || [])
              .map((r: any) => safeDecode(r?.T || ""))
              .join("")
              .trim();

            if (!str) continue;

            if (!lines[y]) lines[y] = [];
            lines[y].push({
              text: str,
              x: item?.x || 0,
            });
          }

          const sortedYs = Object.keys(lines)
            .map((y) => Number(y))
            .sort((a, b) => a - b);

          for (const yNum of sortedYs) {
            const yKey = yNum.toFixed(2);

            const words = (lines[yKey] || []).sort((a, b) => a.x - b.x);

            let lineText = "";
            let prevX: number | null = null;

            for (const w of words) {
              const currentText = (w.text || "").trim();
              if (!currentText) continue;

              if (prevX !== null) {
                const gap = w.x - prevX;

                // ✅ gap check => add space
                if (gap > 1.0) lineText += " ";
              }

              lineText += currentText;

              // approx width
              prevX = w.x + currentText.length * 0.6;
            }

            lineText = lineText.replace(/\s+/g, " ").trim();

            if (lineText) finalText += lineText + "\n";
          }

          finalText += "\n";
        }

        resolve(finalText.trim());
      } catch (err) {
        reject(err);
      }
    });

    pdfParser.parseBuffer(buffer);
  });
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const file = formData.get("file") as File | null;
    const userId = formData.get("user_id") as string | null;

    if (!file) {
      return NextResponse.json({ error: "File required" }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json(
        { error: "user_id required (send from frontend)" },
        { status: 400 }
      );
    }

    // ✅ allow only pdf/docx/txt
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Unsupported file type ❌ (Only PDF, DOCX, TXT supported)" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const BUCKET_NAME = "documents";
    const filePath = `uploads/${Date.now()}-${file.name}`;

    // ✅ Upload to Supabase Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 400 });
    }

    // ✅ Extract + HTML Preview
    let extractedText = "";
    let previewHtml = "";
    const fileType = file.type;

    if (file.type === "application/pdf") {
      extractedText = await extractPdfText(buffer);

      // pdf preview iframe se hoga
      previewHtml = "";
    } else if (
      file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value || "";

      const htmlResult = await mammoth.convertToHtml({ buffer });
      previewHtml = htmlResult.value || "";
    } else if (file.type === "text/plain") {
      extractedText = buffer.toString("utf-8");

      previewHtml = `<pre style="white-space: pre-wrap; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">${extractedText}</pre>`;
    }

    // ✅ Save record in DB (for list/edit/delete)
    const { data: docData, error: dbError } = await supabaseAdmin
      .from("documents")
      .insert({
        user_id: userId,
        file_name: file.name,
        file_type: fileType,
        file_path: filePath,
        extracted_text: extractedText,
      })
      .select()
      .single();

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 400 });
    }

    return NextResponse.json({
      message: "Uploaded & extracted successfully ✅",
      filePath,
      extractedText,
      previewHtml,
      fileType,
      fileName: file.name,
      document: docData, // ✅ DB saved doc
    });
  } catch (err: any) {
    console.error("Server error:", err);
    return NextResponse.json(
      { error: "Server error", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
