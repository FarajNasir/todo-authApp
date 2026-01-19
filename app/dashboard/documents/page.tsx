"use client";

import { useEffect, useMemo, useState } from "react";
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

type DocumentRow = {
  id: string;
  user_id: string;
  file_name: string;
  file_type: string;
  file_path: string;
  extracted_text: string;
  created_at: string;
};

export default function DocumentsPage() {
  const router = useRouter();

  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(false);

  // selected doc viewer
  const [selectedDoc, setSelectedDoc] = useState<DocumentRow | null>(null);

  // view mode toggle
  const [viewMode, setViewMode] = useState<ViewMode>("html");

  // edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");

  // -------------------- Fetch Documents --------------------
  const fetchDocuments = async () => {
    setLoading(true);

    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      const user = userData?.user;

      if (userErr || !user) {
        alert("Login required ❌");
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        alert(error.message);
        return;
      }

      setDocs((data as DocumentRow[]) || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  // -------------------- Delete Document --------------------
  const deleteDocument = async (doc: DocumentRow) => {
    const ok = confirm(`Delete "${doc.file_name}" ?`);
    if (!ok) return;

    try {
      // delete from DB
      const { error: dbError } = await supabase
        .from("documents")
        .delete()
        .eq("id", doc.id);

      if (dbError) {
        alert(dbError.message);
        return;
      }

      // delete from Storage (optional)
      await supabase.storage.from("documents").remove([doc.file_path]);

      // refresh list
      await fetchDocuments();

      if (selectedDoc?.id === doc.id) {
        setSelectedDoc(null);
        setIsEditing(false);
        setEditText("");
      }

      alert("Deleted ✅");
    } catch (e) {
      alert("Delete failed ❌");
    }
  };

  // -------------------- Start Edit --------------------
  const startEdit = () => {
    if (!selectedDoc) return;
    setIsEditing(true);
    setEditText(selectedDoc.extracted_text || "");
  };

  // -------------------- Cancel Edit --------------------
  const cancelEdit = () => {
    setIsEditing(false);
    setEditText("");
  };

  // -------------------- Save Edit --------------------
  const saveEdit = async () => {
    if (!selectedDoc) return;

    try {
      const { error } = await supabase
        .from("documents")
        .update({
          extracted_text: editText,
        })
        .eq("id", selectedDoc.id);

      if (error) {
        alert(error.message);
        return;
      }

      alert("Updated ✅");

      // update selectedDoc + list state
      const updatedDoc = { ...selectedDoc, extracted_text: editText };
      setSelectedDoc(updatedDoc);

      setDocs((prev) =>
        prev.map((d) => (d.id === selectedDoc.id ? updatedDoc : d))
      );

      setIsEditing(false);
    } catch (e) {
      alert("Update failed ❌");
    }
  };

  // -------------------- Extracted HTML (document-like) --------------------
  const extractedHtml = useMemo(() => {
    const safe = (selectedDoc?.extracted_text || "").trim();

    if (!safe) {
      return `<p style="color:#888;">No extracted text found.</p>`;
    }

    // keep empty lines for spacing like document
    const rawLines = safe.split("\n");

    const htmlChunks = rawLines.map((line) => {
      const trimmed = line.trim();

      // blank line => paragraph gap
      if (!trimmed) return `<div style="height:10px;"></div>`;

      const upper = trimmed.toUpperCase();
      const isHeading =
        upper === trimmed &&
        trimmed.length <= 35 &&
        !trimmed.includes("@") &&
        !trimmed.includes("|");

      if (isHeading) {
        return `<h2 style="margin:14px 0 6px;font-size:16px;font-weight:700;">${escapeHtml(
          trimmed
        )}</h2>`;
      }

      // bullet points
      if (trimmed.startsWith("•") || trimmed.startsWith("-")) {
        return `<li style="margin:6px 0; line-height:1.6;">${escapeHtml(
          trimmed.replace(/^[-•]\s*/, "")
        )}</li>`;
      }

      return `<p style="margin:6px 0; line-height:1.7;">${escapeHtml(
        trimmed
      )}</p>`;
    });

    // wrap li into ul
    let finalHtml = "";
    let inList = false;

    for (const chunk of htmlChunks) {
      if (chunk.startsWith("<li")) {
        if (!inList) {
          inList = true;
          finalHtml += `<ul style="margin:6px 0 6px 18px; padding:0;">`;
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
  }, [selectedDoc]);

  return (
    <div className="min-h-screen bg-muted/40 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Your Documents</h1>
            <p className="text-sm text-muted-foreground">
              View / Edit / Delete your extracted documents.
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/dashboard")}>
              Back
            </Button>

            <Button onClick={() => router.push("/dashboard/upload")}>
              Upload New
            </Button>
          </div>
        </div>

        {/* Documents List */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>Uploaded Documents</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : docs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No documents found...
              </p>
            ) : (
              docs.map((doc) => (
                <div
                  key={doc.id}
                  className="border rounded-xl p-4 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{doc.file_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {doc.file_type}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {doc.file_path}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedDoc(doc);
                        setIsEditing(false);
                        setEditText("");
                        setViewMode("html");
                      }}
                    >
                      View
                    </Button>

                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteDocument(doc)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Viewer */}
        {selectedDoc && (
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="space-y-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>Document Viewer</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedDoc.file_name} ({selectedDoc.file_type})
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
                    onClick={() => {
                      navigator.clipboard.writeText(
                        selectedDoc.extracted_text || ""
                      );
                      alert("Copied ✅");
                    }}
                  >
                    Copy
                  </Button>

                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setSelectedDoc(null);
                      setIsEditing(false);
                      setEditText("");
                    }}
                  >
                    Close
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!isEditing ? (
                  <>
                    <Button size="sm" onClick={startEdit}>
                      Edit
                    </Button>

                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteDocument(selectedDoc)}
                    >
                      Delete
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" onClick={saveEdit}>
                      Save
                    </Button>

                    <Button size="sm" variant="outline" onClick={cancelEdit}>
                      Cancel
                    </Button>
                  </>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Extracted Length: {selectedDoc.extracted_text?.length || 0}
              </p>
            </CardHeader>

            <CardContent>
              <div className="rounded-2xl border bg-white p-6 shadow-sm">
                {/* EDIT MODE */}
                {isEditing ? (
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full min-h-[420px] text-sm text-black outline-none resize-y"
                    style={{
                      fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                      whiteSpace: "pre-wrap",
                    }}
                  />
                ) : (
                  <>
                    {/* VIEW MODE */}
                    {viewMode === "plain" ? (
                      <pre className="text-sm whitespace-pre-wrap text-black">
                        {selectedDoc.extracted_text?.trim()
                          ? selectedDoc.extracted_text
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
                  </>
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
