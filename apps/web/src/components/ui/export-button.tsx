"use client";

import { Download } from "lucide-react";
import { Button } from "./button";

type ExportFormat = "csv" | "json";

interface ExportButtonProps {
  data: Record<string, unknown>[];
  filename: string;
  format?: ExportFormat;
  label?: string;
  disabledTitle?: string;
}

function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]!);
  const escape = (val: unknown) => {
    const s = val === null || val === undefined ? "" : typeof val === "object" ? JSON.stringify(val) : String(val);
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(","), ...rows.map((row) => headers.map((h) => escape(row[h])).join(","))];
  return lines.join("\n");
}

function download(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function ExportButton({ data, filename, format = "csv", label, disabledTitle }: ExportButtonProps) {
  const isEmpty = data.length === 0;

  const handleExport = () => {
    if (format === "json") {
      download(JSON.stringify(data, null, 2), `${filename}.json`, "application/json");
    } else {
      download(toCSV(data), `${filename}.csv`, "text/csv");
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={isEmpty}
      title={isEmpty ? (disabledTitle ?? "No data to export") : undefined}
    >
      <Download className="h-3.5 w-3.5" />
      {label ?? `Export ${format.toUpperCase()}`}
    </Button>
  );
}
