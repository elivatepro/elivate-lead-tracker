"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, X, AlertTriangle } from "lucide-react";
import * as XLSX from "xlsx";

const LEAD_FIELDS: readonly { key: string; label: string; required?: boolean }[] = [
  { key: "name", label: "Name", required: true },
  { key: "company", label: "Company" },
  { key: "email", label: "Emails" },
  { key: "phone", label: "Phones" },
  { key: "source", label: "Source" },
  { key: "value", label: "Deal value" },
  { key: "notes", label: "Notes" },
];

// Try to auto-map CSV columns to lead fields
function autoMap(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim());

  const patterns: Record<string, RegExp> = {
    name: /^(name|full.?name|contact.?name|lead.?name|client)$/,
    company: /^(company|organization|org|business|company.?name)$/,
    email: /^(email|e.?mail|email.?address)$/,
    phone: /^(phone|telephone|tel|mobile|cell|phone.?number)$/,
    source: /^(source|lead.?source|referral|channel|origin)$/,
    value: /^(value|deal.?value|amount|revenue|price|worth|budget)$/,
    notes: /^(notes|note|comments|comment|description|details)$/,
  };

  for (const [field, pattern] of Object.entries(patterns)) {
    const idx = lowerHeaders.findIndex((h) => pattern.test(h));
    if (idx !== -1) {
      mapping[field] = headers[idx];
    }
  }

  return mapping;
}

export function ImportLeadsDialog() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [preview, setPreview] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [totalRows, setTotalRows] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  function reset() {
    setFile(null);
    setHeaders([]);
    setPreview([]);
    setMapping({});
    setTotalRows(0);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;

    const validTypes = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    const validExtensions = [".csv", ".xls", ".xlsx"];
    const ext = f.name.toLowerCase().slice(f.name.lastIndexOf("."));

    if (!validTypes.includes(f.type) && !validExtensions.includes(ext)) {
      toast.error("Please upload a CSV or Excel file (.csv, .xls, .xlsx)");
      return;
    }

    const buffer = await f.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet);

    if (rows.length === 0) {
      toast.error("File is empty or has no data rows");
      return;
    }

    const cols = Object.keys(rows[0]);
    setFile(f);
    setHeaders(cols);
    setPreview(rows.slice(0, 5));
    setTotalRows(rows.length);
    setMapping(autoMap(cols));
  }

  async function handleImport() {
    if (!file || !mapping.name) {
      toast.error("Please map at least the Name column");
      return;
    }

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mapping", JSON.stringify(mapping));

      const res = await fetch("/api/leads/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Import failed");
        return;
      }

      toast.success(
        `Imported ${data.imported} lead${data.imported !== 1 ? "s" : ""}${data.skipped > 0 ? ` (${data.skipped} skipped)` : ""}`
      );

      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      reset();
      setOpen(false);
    } catch {
      toast.error("Import failed. Please try again.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger className="inline-flex shrink-0 items-center justify-center rounded-lg border border-border bg-white text-foreground shadow-sm hover:bg-secondary h-9 gap-1.5 px-2.5 sm:px-4 text-[13px] font-medium transition-all">
        <Upload className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Import</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[560px] max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Import leads
          </DialogTitle>
        </DialogHeader>

        {!file ? (
          /* File upload step */
          <div className="mt-2">
            <div
              className="border-2 border-dashed border-border rounded-lg p-6 sm:p-8 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/[0.02] transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <FileSpreadsheet className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">
                Drop your file here or click to browse
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                CSV, XLS, or XLSX — up to 500 rows
              </p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xls,.xlsx"
              className="hidden"
              onChange={handleFile}
            />
          </div>
        ) : (
          /* Column mapping step */
          <div className="mt-2 space-y-4">
            {/* File info */}
            <div className="flex items-center justify-between bg-secondary/50 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm truncate">{file.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {totalRows} row{totalRows !== 1 ? "s" : ""}
                </span>
              </div>
              <button
                onClick={reset}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Column mapping */}
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-3 block">
                Map columns
              </Label>
              <div className="space-y-2">
                {LEAD_FIELDS.map((field) => (
                  <div
                    key={field.key}
                    className="grid grid-cols-[100px_1fr] sm:grid-cols-[120px_1fr] gap-2 sm:gap-3 items-center"
                  >
                    <span className="text-sm text-foreground">
                      {field.label}
                      {field.required && (
                        <span className="text-destructive ml-0.5">*</span>
                      )}
                    </span>
                    <select
                      className="h-9 w-full rounded-lg border border-input bg-white px-3 text-sm"
                      value={mapping[field.key] || ""}
                      onChange={(e) =>
                        setMapping((prev) => ({
                          ...prev,
                          [field.key]: e.target.value,
                        }))
                      }
                    >
                      <option value="">— skip —</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview — hidden on very small screens */}
            {preview.length > 0 && mapping.name && (
              <div className="hidden sm:block">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">
                  Preview (first {preview.length} rows)
                </Label>
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs whitespace-nowrap">
                      <thead>
                        <tr className="bg-secondary/50">
                          {LEAD_FIELDS.filter((f) => mapping[f.key]).map(
                            (f) => (
                              <th
                                key={f.key}
                                className="text-left px-3 py-2 font-medium text-muted-foreground"
                              >
                                {f.label}
                              </th>
                            )
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map((row, i) => (
                          <tr key={i} className="border-t border-border/60">
                            {LEAD_FIELDS.filter((f) => mapping[f.key]).map(
                              (f) => (
                                <td
                                  key={f.key}
                                  className="px-3 py-1.5 truncate max-w-[150px]"
                                >
                                  {String(row[mapping[f.key]] ?? "")}
                                </td>
                              )
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {!mapping.name && (
              <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Map at least the Name column to continue
              </div>
            )}

            {totalRows > 500 && (
              <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Only the first 500 rows will be imported
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  reset();
                  setOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={importing || !mapping.name}
              >
                {importing
                  ? "Importing..."
                  : `Import ${Math.min(totalRows, 500)} lead${totalRows !== 1 ? "s" : ""}`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
