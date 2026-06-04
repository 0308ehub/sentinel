"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Upload, FileText, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const pasteSchema = z.object({
  title: z.string().min(1, "Title required"),
  text: z.string().min(1, "Content required"),
  sourceType: z.string(),
  customer: z.string().optional(),
  segment: z.string().optional(),
  date: z.string().optional(),
  notes: z.string().optional(),
});

type PasteForm = z.infer<typeof pasteSchema>;

const SOURCE_TYPES = [
  { value: "INTERVIEW", label: "Customer Interview" },
  { value: "SUPPORT_TICKET", label: "Support Ticket" },
  { value: "SALES_CALL", label: "Sales Call" },
  { value: "USER_FEEDBACK", label: "User Feedback" },
  { value: "ANALYTICS_EXPORT", label: "Analytics Export" },
  { value: "SLACK_EXPORT", label: "Slack Export" },
  { value: "INTERNAL_DOC", label: "Internal Document" },
  { value: "MARKET_RESEARCH", label: "Market Research" },
  { value: "PASTE", label: "Pasted Text" },
  { value: "UPLOAD", label: "File Upload" },
];

type FileStatus = "pending" | "uploading" | "done" | "error";

interface FileEntry {
  file: File;
  status: FileStatus;
  error?: string;
}

export default function UploadPage() {
  const router = useRouter();
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = params.workspaceId;

  const [tab, setTab] = useState<"paste" | "upload">("upload");
  const [pasteLoading, setPasteLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [uploadSourceType, setUploadSourceType] = useState("UPLOAD");
  const [uploading, setUploading] = useState(false);
  const filesRef = useRef<FileEntry[]>([]);
  const uploadSourceTypeRef = useRef("UPLOAD");
  useEffect(() => { filesRef.current = files; }, [files]);
  useEffect(() => { uploadSourceTypeRef.current = uploadSourceType; }, [uploadSourceType]);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<PasteForm>({
    resolver: zodResolver(pasteSchema),
    defaultValues: { sourceType: "PASTE" },
  });

  const onPasteSubmit = async (data: PasteForm) => {
    setPasteLoading(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/documents/paste`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.title,
          text: data.text,
          sourceType: data.sourceType,
          metadata: { customer: data.customer, segment: data.segment, date: data.date, notes: data.notes },
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message);
      toast.success("Document uploaded and processing started");
      router.push(`/workspaces/${workspaceId}/documents`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setPasteLoading(false);
    }
  };

  const addAndUpload = useCallback(async (incoming: File[]) => {
    const valid = incoming.filter((f) => /\.(txt|md|pdf|csv)$/i.test(f.name));
    if (valid.length < incoming.length) {
      toast.error("Some files skipped — only .txt, .md, .pdf, .csv are supported");
    }
    if (valid.length === 0) return;

    const fresh = valid.filter((f) => {
      const key = f.name + f.size;
      return !filesRef.current.some((e) => e.file.name + e.file.size === key);
    });
    if (fresh.length === 0) return;

    const newEntries: FileEntry[] = fresh.map((f) => ({ file: f, status: "uploading" as FileStatus }));
    setFiles((prev) => [...prev, ...newEntries]);
    setUploading(true);

    let anyFailed = false;
    for (const file of fresh) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("title", file.name.replace(/\.[^.]+$/, ""));
        formData.append("sourceType", uploadSourceTypeRef.current);

        const res = await fetch(`/api/workspaces/${workspaceId}/documents/upload`, {
          method: "POST",
          body: formData,
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error?.message ?? "Upload failed");

        setFiles((prev) => prev.map((e) => e.file === file ? { ...e, status: "done" } : e));
      } catch (err) {
        anyFailed = true;
        setFiles((prev) => prev.map((e) => e.file === file ? { ...e, status: "error", error: err instanceof Error ? err.message : "Failed" } : e));
      }
    }

    setUploading(false);
    if (!anyFailed) {
      toast.success(`${fresh.length} file${fresh.length > 1 ? "s" : ""} uploaded successfully`);
      router.push(`/workspaces/${workspaceId}/documents`);
    } else {
      toast.error("Some files failed to upload — check the list");
    }
  }, [workspaceId, router]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    addAndUpload(Array.from(e.dataTransfer.files));
  }, [addAndUpload]);


  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Upload Evidence</h1>
        <p className="text-gray-500 text-sm mt-1">Add customer interviews, support tickets, feedback, or any product signal.</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "paste" | "upload")}>
        <TabsList className="mb-6">
          <TabsTrigger value="paste" className="gap-2"><FileText className="h-4 w-4" /> Paste Text</TabsTrigger>
          <TabsTrigger value="upload" className="gap-2"><Upload className="h-4 w-4" /> Upload Files</TabsTrigger>
        </TabsList>

        {/* Paste Tab */}
        <TabsContent value="paste">
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit(onPasteSubmit)} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Title</label>
                  <Input {...register("title")} placeholder="Customer interview — Acme Inc. — May 2026" />
                  {errors.title && <p className="text-xs text-red-500">{errors.title.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Source type</label>
                  <Select onValueChange={(v) => { setValue("sourceType", v ?? "PASTE"); }} defaultValue="PASTE">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SOURCE_TYPES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Content</label>
                  <Textarea
                    {...register("text")}
                    placeholder="Paste the interview transcript, support ticket, or feedback here…"
                    rows={12}
                    className="font-mono text-sm"
                  />
                  {errors.text && <p className="text-xs text-red-500">{errors.text.message}</p>}
                </div>

                <details className="space-y-4">
                  <summary className="text-sm font-medium text-gray-500 cursor-pointer hover:text-gray-700">
                    + Metadata (optional)
                  </summary>
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-gray-500">Customer</label>
                      <Input {...register("customer")} placeholder="Acme Inc." />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-gray-500">Segment</label>
                      <Input {...register("segment")} placeholder="Enterprise" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-gray-500">Date</label>
                      <Input {...register("date")} type="date" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-gray-500">Notes</label>
                      <Input {...register("notes")} placeholder="Follow-up call scheduled" />
                    </div>
                  </div>
                </details>

                <Button type="submit" disabled={pasteLoading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                  {pasteLoading ? "Uploading…" : "Upload & Process"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* File Upload Tab */}
        <TabsContent value="upload">
          <Card>
            <CardContent className="pt-6 space-y-5">
              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => document.getElementById("file-input")?.click()}
                className={cn(
                  "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors",
                  dragOver ? "border-indigo-400 bg-indigo-50" : "border-gray-200 hover:border-indigo-300"
                )}
              >
                <input
                  id="file-input"
                  type="file"
                  className="hidden"
                  accept=".txt,.md,.pdf,.csv"
                  multiple
                  onChange={(e) => {
                    if (e.target.files) addAndUpload(Array.from(e.target.files));
                    e.target.value = "";
                  }}
                />
                <Upload className="h-9 w-9 text-gray-300 mx-auto mb-3" />
                <p className="font-medium text-gray-600">Drop files or click to browse</p>
                <p className="text-xs text-gray-400 mt-1">.txt, .md, .pdf, .csv — select multiple at once — max 20MB each</p>
              </div>

              {/* File list */}
              {files.length > 0 && (
                <div className="space-y-2">
                  {files.map((entry, i) => (
                    <div
                      key={`${entry.file.name}-${entry.file.size}-${i}`}
                      className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5"
                    >
                      <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 truncate">{entry.file.name}</p>
                        <p className="text-xs text-gray-400">{(entry.file.size / 1024).toFixed(0)} KB</p>
                      </div>
                      {entry.status === "uploading" && <Loader2 className="h-4 w-4 text-indigo-500 animate-spin shrink-0" />}
                      {entry.status === "done" && <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />}
                      {entry.status === "error" && (
                        <div className="flex items-center gap-1">
                          <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                          <span className="text-xs text-red-500 truncate max-w-[100px]">{entry.error}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Source type — always visible so it can be set before choosing files */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Source type</label>
                <Select
                  value={uploadSourceType}
                  onValueChange={(v) => setUploadSourceType(v ?? "UPLOAD")}
                  disabled={uploading}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOURCE_TYPES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
