"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ViewMode = "plain" | "html";

export default function UploadExtractPage() {
  const router = useRouter();

  const [docFile, setDocFile] = useState<File | null>(null);
  const [docLoading, setDocLoading] = useState(false);

  const [docText, setDocText] = useState("");
  const [docPath, setDocPath] = useState("");

  const [docName, setDocName] = useState("");
  const [docType, setDocType] = useState("");

  // Toggle view
  const [viewMode, setViewMode] = useState<ViewMode>("html");

  const uploadDocument = async () => {
    if (!docFile) return alert("Please select a document");

    // ✅ Only allow PDF/DOCX/TXT
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];

    if (!allowedTypes.includes(docFile.type)) {
      alert("Only PDF, DOCX, TXT allowed ❌");
      return;
    }

    setDocLoading(true);
    setDocText("");
    setDocPath("");
    setDocName(docFile.name);
    setDocType(docFile.type);

    try {
      // ✅ Get logged-in user
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      const user = userData?.user;

      if (userErr || !user) {
        alert("Login required ❌");
        return;
      }

      const formData = new FormData();
      formData.append("file", docFile);

      // ✅ IMPORTANT: send user_id also
      formData.append("user_id", user.id);

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Upload failed");
        return;
      }

      setDocPath(data.filePath || "");
      setDocText(data.extractedText || "");
    } catch (err) {
      alert("Something went wrong");
    } finally {
      setDocLoading(false);
    }
  };

  // ✅ Convert extracted text into HTML document-like layout
  const extractedHtml = useMemo(() => {
    const safe = (docText || "").trim();

    if (!safe) {
      return `<p style="color:#888;">No extracted text found.</p>`;
    }

    // Basic cleanup
    const lines = safe
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    // Simple resume/document styling
    const htmlLines = lines.map((line) => {
      // headings detection (optional)
      const upper = line.toUpperCase();
      const isHeading =
        upper === line &&
        line.length <= 30 &&
        !line.includes("@") &&
        !line.includes("|");

      if (isHeading) {
        return `<h2 style="margin:18px 0 8px;font-size:16px;font-weight:700;">${escapeHtml(
          line
        )}</h2>`;
      }

      // bullet points
      if (line.startsWith("•") || line.startsWith("-")) {
        return `<li style="margin:6px 0;">${escapeHtml(
          line.replace(/^[-•]\s*/, "")
        )}</li>`;
      }

      return `<p style="margin:8px 0; line-height:1.6;">${escapeHtml(
        line
      )}</p>`;
    });

    // Wrap list items into UL (basic)
    let finalHtml = "";
    let inList = false;

    for (const chunk of htmlLines) {
      if (chunk.startsWith("<li")) {
        if (!inList) {
          inList = true;
          finalHtml += `<ul style="margin:8px 0 8px 18px; padding:0;">`;
        }
        finalHtml += chunk;
      } else {
        if (inList) {
          inList = false;
          finalHtml += `</ul>`;
        }
        finalHtml += chunk;
      }
    }

    if (inList) finalHtml += `</ul>`;

    return finalHtml;
  }, [docText]);

  return (
    <div className="min-h-screen bg-muted/40 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Upload & Extract</h1>
            <p className="text-sm text-muted-foreground">
              Upload PDF / DOCX / TXT and view extracted content like a document.
            </p>
          </div>

          <Button variant="outline" onClick={() => router.push("/dashboard")}>
            Back to Dashboard
          </Button>
        </div>

        {/* Upload Card */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>Upload Document</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={(e) => setDocFile(e.target.files?.[0] || null)}
            />

            <Button
              className="w-full rounded-xl"
              onClick={uploadDocument}
              disabled={docLoading}
            >
              {docLoading ? "Uploading..." : "Upload & Extract"}
            </Button>

            {docPath && (
              <p className="text-sm text-muted-foreground">
                ✅ Saved in Storage:{" "}
                <span className="font-semibold">{docPath}</span>
              </p>
            )}
          </CardContent>
        </Card>

        {/* Extracted Output */}
        {docPath && (
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="space-y-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>Extracted Document</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    {docName} ({docType})
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Select
                    value={viewMode}
                    onValueChange={(v) => setViewMode(v as ViewMode)}
                  >
                    <SelectTrigger className="w-[170px] rounded-xl">
                      <SelectValue placeholder="View mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="html">HTML Text</SelectItem>
                      <SelectItem value="plain">Plain Text</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!docText?.trim()}
                    onClick={() => {
                      navigator.clipboard.writeText(docText);
                      alert("Copied ✅");
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Extracted Length: {docText.length}
              </p>
            </CardHeader>

            <CardContent>
              {/* Document Look */}
              <div className="rounded-2xl border bg-white p-6 shadow-sm">
                {viewMode === "plain" ? (
                  <pre className="text-sm whitespace-pre-wrap text-black">
                    {docText?.trim()
                      ? docText
                      : "❌ Extracted text empty (Scanned PDF ho sakta hai)"}
                  </pre>
                ) : (
                  <div
                    className="text-black"
                    style={{
                      fontFamily:
                        "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
                      fontSize: "14px",
                    }}
                    dangerouslySetInnerHTML={{ __html: extractedHtml }}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ✅ simple html escape
function escapeHtml(str: string) {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
