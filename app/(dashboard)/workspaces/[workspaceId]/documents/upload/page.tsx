"use client";

import { useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Upload, FileText } from "lucide-react";
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

export default function UploadPage() {
  const router = useRouter();
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = params.workspaceId;

  const [tab, setTab] = useState<"paste" | "upload">("paste");
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [sourceType, setSourceType] = useState("PASTE");

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<PasteForm>({
    resolver: zodResolver(pasteSchema),
    defaultValues: { sourceType: "PASTE" },
  });

  const onPasteSubmit = async (data: PasteForm) => {
    setLoading(true);
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
      setLoading(false);
    }
  };

  const handleFileUpload = async (title: string, uploadSourceType: string) => {
    if (!file) return toast.error("Please select a file");
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title || file.name);
      formData.append("sourceType", uploadSourceType);

      const res = await fetch(`/api/workspaces/${workspaceId}/documents/upload`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message);
      toast.success("File uploaded and processing started");
      router.push(`/workspaces/${workspaceId}/documents`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }, []);

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Upload Evidence</h1>
        <p className="text-gray-500 text-sm mt-1">Add customer interviews, support tickets, feedback, or any product signal.</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "paste" | "upload")}>
        <TabsList className="mb-6">
          <TabsTrigger value="paste" className="gap-2"><FileText className="h-4 w-4" /> Paste Text</TabsTrigger>
          <TabsTrigger value="upload" className="gap-2"><Upload className="h-4 w-4" /> Upload File</TabsTrigger>
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
                  <Select onValueChange={(v) => { setSourceType(v ?? "PASTE"); setValue("sourceType", v ?? "PASTE"); }} defaultValue="PASTE">
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

                <Button type="submit" disabled={loading} className="w-full bg-violet-600 hover:bg-violet-700 text-white">
                  {loading ? "Uploading…" : "Upload & Process"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* File Upload Tab */}
        <TabsContent value="upload">
          <Card>
            <CardContent className="pt-6 space-y-5">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => document.getElementById("file-input")?.click()}
                className={cn(
                  "border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors",
                  dragOver ? "border-violet-400 bg-violet-50" : "border-gray-200 hover:border-violet-300"
                )}
              >
                <input
                  id="file-input"
                  type="file"
                  className="hidden"
                  accept=".txt,.md,.pdf,.csv"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <Upload className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                {file ? (
                  <p className="font-medium text-gray-700">{file.name}</p>
                ) : (
                  <>
                    <p className="font-medium text-gray-600">Drop a file or click to browse</p>
                    <p className="text-xs text-gray-400 mt-1">.txt, .md, .pdf, .csv — max 20MB</p>
                  </>
                )}
              </div>

              {file && (
                <UploadFileForm
                  file={file}
                  sourceTypes={SOURCE_TYPES}
                  onSubmit={handleFileUpload}
                  loading={loading}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function UploadFileForm({
  file,
  sourceTypes,
  onSubmit,
  loading,
}: {
  file: File;
  sourceTypes: typeof SOURCE_TYPES;
  onSubmit: (title: string, sourceType: string) => void;
  loading: boolean;
}) {
  const [title, setTitle] = useState(file.name.replace(/\.[^.]+$/, ""));
  const [sourceType, setSourceType] = useState("UPLOAD");

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">Title</label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">Source type</label>
        <Select onValueChange={(v) => setSourceType(v ?? "UPLOAD")} defaultValue="UPLOAD">
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {sourceTypes.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        onClick={() => onSubmit(title, sourceType)}
        disabled={loading}
        className="w-full bg-violet-600 hover:bg-violet-700 text-white"
      >
        {loading ? "Uploading…" : "Upload & Process"}
      </Button>
    </div>
  );
}
