import fs from "node:fs/promises";
import path from "node:path";
import * as XLSX from "xlsx";
import pdfParse from "pdf-parse";
import type {
  CellSnapshot,
  DocumentKind,
  DocumentSnapshot,
  PageSnapshot,
  RowSnapshot,
  SheetSnapshot,
} from "@/lib/domain/types";

function detectKind(filePath: string): DocumentKind {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".pdf") {
    return "pdf";
  }

  if (ext === ".docx") {
    return "docx";
  }

  return "excel";
}

function normalizeCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

async function readExcelSnapshot(filePath: string): Promise<DocumentSnapshot> {
  const workbook = XLSX.readFile(filePath, { dense: true });
  return readExcelWorkbookSnapshot(workbook, path.basename(filePath));
}

function readExcelWorkbookSnapshot(workbook: XLSX.WorkBook, fileName: string): DocumentSnapshot {
  const sheets: SheetSnapshot[] = workbook.SheetNames.map((name) => {
    const worksheet = workbook.Sheets[name];
    const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(worksheet, {
      header: 1,
      raw: false,
      blankrows: true,
    });

    const maxColumns = matrix.reduce((max, row) => Math.max(max, row.length), 0);

    const rows: RowSnapshot[] = matrix.map((rawRow, rowIndex) => {
      const cells: CellSnapshot[] = Array.from({ length: maxColumns }, (_, columnIndex) => ({
        row: rowIndex + 1,
        col: columnIndex + 1,
        value: normalizeCell(rawRow[columnIndex]),
      }));

      return {
        row: rowIndex + 1,
        cells,
      };
    });

    return {
      name,
      rows,
    };
  });

  return {
    kind: "excel",
    fileName,
    sheets,
    pages: [],
  };
}

async function readPdfSnapshot(filePath: string): Promise<DocumentSnapshot> {
  const buffer = await fs.readFile(filePath);
  return readPdfBufferSnapshot(buffer, path.basename(filePath));
}

async function readPdfBufferSnapshot(buffer: Buffer, fileName: string): Promise<DocumentSnapshot> {
  const result = await pdfParse(buffer);
  const rawPages = result.text
    .split(/\f+/)
    .map((text) => text.trim())
    .filter(Boolean);

  const pages: PageSnapshot[] = rawPages.map((pageText, index) => ({
    index,
    text: pageText,
    lines: pageText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
  }));

  return {
    kind: "pdf",
    fileName,
    sheets: [],
    pages,
  };
}

export async function createDocumentSnapshot(filePath: string): Promise<DocumentSnapshot> {
  const kind = detectKind(filePath);

  if (kind === "pdf") {
    return readPdfSnapshot(filePath);
  }

  if (kind === "docx") {
    return {
      kind: "docx",
      fileName: path.basename(filePath),
      sheets: [],
      pages: [],
    };
  }

  return readExcelSnapshot(filePath);
}

export async function createDocumentSnapshotFromBuffer(fileName: string, buffer: Buffer): Promise<DocumentSnapshot> {
  const kind = detectKind(fileName);

  if (kind === "pdf") {
    return readPdfBufferSnapshot(buffer, fileName);
  }

  if (kind === "docx") {
    return {
      kind: "docx",
      fileName,
      sheets: [],
      pages: [],
    };
  }

  const workbook = XLSX.read(buffer, { type: "buffer", dense: true });
  return readExcelWorkbookSnapshot(workbook, fileName);
}

export function summarizeDocumentSnapshot(snapshot: DocumentSnapshot) {
  return {
    kind: snapshot.kind,
    fileName: snapshot.fileName,
    sheetNames: snapshot.sheets.map((sheet) => sheet.name),
    pageCount: snapshot.pages.length,
    previewLines:
      snapshot.kind === "pdf"
        ? snapshot.pages.flatMap((page) => page.lines).slice(0, 12)
        : snapshot.sheets.flatMap((sheet) => sheet.rows.map((row) => row.cells.map((cell) => cell.value).join(" | "))).slice(0, 12),
  };
}
