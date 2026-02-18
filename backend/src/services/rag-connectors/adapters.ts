import { ConnectorType } from "@prisma/client";
import { createConnection } from "mysql2/promise";
import { Client as PgClient } from "pg";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import JSZip from "jszip";
import WordExtractor from "word-extractor";
import { createCanvas } from "@napi-rs/canvas";
import { env } from "../../config.js";
import { ConnectorFetchResult, ConnectorFetchedDocument } from "./types.js";

function safeRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

async function fetchWithTimeout(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.CONNECTOR_HTTP_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";
const GOOGLE_SHEET_MIME = "application/vnd.google-apps.spreadsheet";
const GOOGLE_PRESENTATION_MIME = "application/vnd.google-apps.presentation";
const GOOGLE_FOLDER_MIME = "application/vnd.google-apps.folder";
const SHARED_WITH_ME_FOLDER_TOKEN = "__shared_with_me__";
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const DOC_MIME = "application/msword";
const DOCM_MIME =
  "application/vnd.ms-word.document.macroenabled.12";
const PDF_MIME = "application/pdf";

const wordExtractor = new WordExtractor();

const UTF8_SAFE_MIME_TYPES = new Set([
  "application/json",
  "application/xml",
  "application/javascript",
  "application/x-javascript",
  "application/csv",
  "application/ld+json",
]);

function sanitizeExtractedText(input: string) {
  return input
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F]/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .trim();
}

function shouldAttemptOcrFallback(currentText: string) {
  if (!env.OCR_FALLBACK_ENABLED) return false;
  return currentText.length < env.OCR_MIN_TEXT_LENGTH;
}

async function ocrImageBuffer(imageBuffer: Buffer) {
  const tesseract = await import("tesseract.js");
  const recognize =
    (tesseract as { recognize?: (data: Buffer, language: string) => Promise<{ data?: { text?: string } }> })
      .recognize ??
    ((tesseract as { default?: { recognize?: (data: Buffer, language: string) => Promise<{ data?: { text?: string } }> } })
      .default?.recognize);

  if (!recognize) {
    throw new Error("Tesseract recognizer is not available.");
  }

  const result = await recognize(imageBuffer, env.OCR_LANGUAGE);
  return sanitizeExtractedText(result.data?.text ?? "");
}

async function extractPdfTextFromBuffer(buffer: Buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return sanitizeExtractedText(result.text ?? "");
  } finally {
    await parser.destroy();
  }
}

async function ocrPdfBuffer(buffer: Buffer) {
  // Lazy-load PDF.js because this path is only used when OCR fallback is needed.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = (pdfjs as { getDocument: (source: { data: Uint8Array }) => { promise: Promise<any>; destroy?: () => void } })
    .getDocument({ data: new Uint8Array(buffer) });
  const document = await loadingTask.promise as {
    numPages: number;
    getPage: (pageNumber: number) => Promise<any>;
    cleanup?: () => void;
    destroy?: () => void;
  };

  try {
    const maxPages = Math.min(document.numPages, env.OCR_PDF_MAX_PAGES);
    const ocrTexts: string[] = [];

    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: env.OCR_PDF_RENDER_SCALE });

      const canvas = createCanvas(
        Math.max(1, Math.ceil(viewport.width)),
        Math.max(1, Math.ceil(viewport.height)),
      );
      const context = canvas.getContext("2d");

      await (page.render({
        canvasContext: context,
        viewport,
      }) as { promise: Promise<void> }).promise;

      const pngBuffer = canvas.toBuffer("image/png");
      const text = await ocrImageBuffer(Buffer.from(pngBuffer));
      if (text) {
        ocrTexts.push(text);
      }

      page.cleanup();
    }

    return sanitizeExtractedText(ocrTexts.join("\n\n"));
  } finally {
    if (typeof document.cleanup === "function") {
      document.cleanup();
    }
    if (typeof document.destroy === "function") {
      document.destroy();
    }
    if (typeof loadingTask.destroy === "function") {
      loadingTask.destroy();
    }
  }
}

async function ocrDocxImages(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const imageFiles = Object.values(zip.files).filter((entry) => {
    if (entry.dir) return false;
    const name = entry.name.toLowerCase();
    return (
      name.startsWith("word/media/") &&
      (name.endsWith(".png") ||
        name.endsWith(".jpg") ||
        name.endsWith(".jpeg") ||
        name.endsWith(".bmp") ||
        name.endsWith(".tif") ||
        name.endsWith(".tiff") ||
        name.endsWith(".webp"))
    );
  });

  const selected = imageFiles.slice(0, env.OCR_DOCX_MAX_IMAGES);
  const texts: string[] = [];
  for (const imageFile of selected) {
    const imageBuffer = await imageFile.async("nodebuffer");
    const text = await ocrImageBuffer(imageBuffer);
    if (text) {
      texts.push(text);
    }
  }

  return sanitizeExtractedText(texts.join("\n\n"));
}

function isUtf8LikeContent(text: string) {
  if (!text) return false;
  const sample = text.slice(0, 4096);
  if (!sample) return false;

  let printable = 0;
  for (let i = 0; i < sample.length; i += 1) {
    const code = sample.charCodeAt(i);
    if (code === 9 || code === 10 || code === 13) {
      printable += 1;
      continue;
    }
    if (code >= 32 && code <= 126) {
      printable += 1;
      continue;
    }
    if (code >= 160) {
      printable += 1;
    }
  }

  return printable / sample.length >= 0.84;
}

function decodeUtf8IfSupported(buffer: Buffer, mimeType: string) {
  const lowered = mimeType.toLowerCase();
  const allowsUtf8Decode =
    lowered.startsWith("text/") || UTF8_SAFE_MIME_TYPES.has(lowered);

  if (!allowsUtf8Decode) {
    return null;
  }

  const decoded = sanitizeExtractedText(buffer.toString("utf8"));
  if (!decoded) {
    return null;
  }

  return isUtf8LikeContent(decoded) ? decoded : null;
}

function hasWordExtension(fileName: string | undefined) {
  if (!fileName) return false;
  const normalized = fileName.trim().toLowerCase();
  return (
    normalized.endsWith(".doc") ||
    normalized.endsWith(".docx") ||
    normalized.endsWith(".docm")
  );
}

function isWordLikeMimeType(mimeType: string) {
  const normalized = mimeType.toLowerCase();
  return (
    normalized === DOC_MIME ||
    normalized === DOCX_MIME ||
    normalized === DOCM_MIME
  );
}

function hasPdfExtension(fileName: string | undefined) {
  return Boolean(fileName && fileName.trim().toLowerCase().endsWith(".pdf"));
}

async function extractWordTextFromBuffer(
  buffer: Buffer,
  mimeType: string,
  fileName?: string,
) {
  const shouldUseWordExtractor =
    mimeType === DOC_MIME ||
    mimeType === DOCM_MIME ||
    hasWordExtension(fileName);

  if (mimeType === DOCX_MIME) {
    try {
      const extracted = await mammoth.extractRawText({ buffer });
      const sanitizedDocx = sanitizeExtractedText(extracted.value);
      if (sanitizedDocx) {
        return sanitizedDocx;
      }
    } catch {
      // Fallback to word-extractor below.
    }
  }

  if (!shouldUseWordExtractor && mimeType !== DOCX_MIME) {
    return "";
  }

  try {
    const extracted = await wordExtractor.extract(buffer);
    const rawBody = typeof extracted.getBody === "function" ? extracted.getBody() : "";
    const rawHeaders =
      typeof extracted.getHeaders === "function"
        ? extracted.getHeaders({ includeFooters: false })
        : "";
    const rawFootnotes =
      typeof extracted.getFootnotes === "function" ? extracted.getFootnotes() : "";

    const merged = [rawBody, rawHeaders, rawFootnotes].filter(Boolean).join("\n\n");
    const sanitized = sanitizeExtractedText(merged);
    if (!sanitized) {
      throw new Error("Word document has no extractable text.");
    }

    return sanitized;
  } catch (error) {
    const message = error instanceof Error ? error.message : "word extraction failed";
    throw new Error(`Word extraction failed (${fileName ?? mimeType}): ${message}`);
  }
}

async function fetchGoogleDriveFileText(
  fileId: string,
  mimeType: string,
  accessToken: string,
  fileName?: string,
) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
  };

  const isGoogleDoc = mimeType === GOOGLE_DOC_MIME;
  const isGoogleSheet = mimeType === GOOGLE_SHEET_MIME;
  const isGooglePresentation = mimeType === GOOGLE_PRESENTATION_MIME;

  let url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`;
  if (isGoogleDoc || isGooglePresentation) {
    url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=text/plain&supportsAllDrives=true`;
  } else if (isGoogleSheet) {
    url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=text/csv&supportsAllDrives=true`;
  }

  const response = await fetchWithTimeout(url, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google Drive content fetch failed: ${response.status} ${body.slice(0, 200)}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (mimeType === PDF_MIME || hasPdfExtension(fileName)) {
    let text = await extractPdfTextFromBuffer(buffer);

    if (shouldAttemptOcrFallback(text)) {
      try {
        const ocrText = await ocrPdfBuffer(buffer);
        if (ocrText) {
          text = ocrText;
        }
      } catch (error) {
        const details = error instanceof Error ? error.message : "OCR fallback failed";
        if (!text) {
          throw new Error(`PDF text extraction failed and OCR fallback failed: ${details}`);
        }
      }
    }

    if (!text) {
      throw new Error("PDF file has no extractable text.");
    }

    return text;
  }

  if (isWordLikeMimeType(mimeType) || hasWordExtension(fileName)) {
    let wordText = "";

    try {
      wordText = await extractWordTextFromBuffer(
        buffer,
        mimeType,
        fileName,
      );
    } catch (error) {
      const details = error instanceof Error ? error.message : "Word extraction failed";
      if (!env.OCR_FALLBACK_ENABLED) {
        throw new Error(details);
      }
    }

    if (shouldAttemptOcrFallback(wordText) && (mimeType === DOCX_MIME || mimeType === DOCM_MIME)) {
      try {
        const ocrText = await ocrDocxImages(buffer);
        if (ocrText) {
          return ocrText;
        }
      } catch (error) {
        const details = error instanceof Error ? error.message : "DOCX OCR failed";
        if (!wordText) {
          throw new Error(`Word extraction failed and OCR fallback failed: ${details}`);
        }
      }
    }

    if (wordText) {
      return wordText;
    }

    throw new Error("Word file has no extractable text.");
  }

  const utf8Text = decodeUtf8IfSupported(buffer, mimeType);
  if (utf8Text) {
    return utf8Text;
  }

  if (isGoogleDoc || isGoogleSheet || isGooglePresentation) {
    const exported = sanitizeExtractedText(buffer.toString("utf8"));
    if (!exported) {
      throw new Error("Google workspace document produced empty text content.");
    }
    return exported;
  }

  throw new Error(
    `Unsupported Google Drive mimeType for text ingestion: ${mimeType}. Supported: Google Docs/Sheets/Slides, Word (.doc/.docx), PDF, and text-based files.`,
  );
}

function parseGoogleDriveSecret(secret: Record<string, unknown>) {
  const googleOAuth =
    secret.googleOAuth &&
    typeof secret.googleOAuth === "object" &&
    !Array.isArray(secret.googleOAuth)
      ? (secret.googleOAuth as Record<string, unknown>)
      : {};

  const accessToken =
    (typeof googleOAuth.accessToken === "string" && googleOAuth.accessToken) ||
    (typeof secret.accessToken === "string" ? secret.accessToken : "");

  return {
    accessToken,
  };
}

function normalizeGoogleDriveFolderId(raw: unknown) {
  if (typeof raw !== "string") return null;
  const input = raw.trim();
  if (!input) return null;

  const folderPathMatch = input.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderPathMatch?.[1]) {
    return folderPathMatch[1];
  }

  const idQueryMatch = input.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idQueryMatch?.[1]) {
    return idQueryMatch[1];
  }

  const normalized = input.toLowerCase();
  if (
    normalized === "sharedwithme" ||
    normalized === "shared_with_me" ||
    normalized === "shared-with-me" ||
    normalized === SHARED_WITH_ME_FOLDER_TOKEN
  ) {
    return SHARED_WITH_ME_FOLDER_TOKEN;
  }

  return input;
}

function parseIsoDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return new Date(parsed).toISOString();
}

function parsePositiveInt(value: unknown, fallback: number, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function isTemporaryOfficeFileName(fileName: string) {
  const normalized = fileName.trim().toLowerCase();
  return (
    normalized.startsWith("~$") ||
    normalized.startsWith(".~lock.") ||
    normalized.endsWith(".docx#") ||
    normalized.endsWith(".tmp") ||
    normalized.endsWith(".exe")
  );
}

async function fetchGoogleDriveDocuments(
  config: Record<string, unknown>,
  secret: Record<string, unknown>,
): Promise<ConnectorFetchResult> {
  const parsedSecret = parseGoogleDriveSecret(secret);
  const accessToken =
    parsedSecret.accessToken ||
    (typeof config.accessToken === "string" ? config.accessToken : "");

  if (!accessToken) {
    throw new Error("Google Drive connector requires accessToken in secretJson or configJson.");
  }

  const documents: ConnectorFetchedDocument[] = [];
  const errors: ConnectorFetchResult["errors"] = [];

  const fileIds = Array.isArray(config.fileIds)
    ? config.fileIds.filter((value): value is string => typeof value === "string" && value.length > 0)
    : [];
  const folderId = normalizeGoogleDriveFolderId(config.folderId);
  const includeTrashed = Boolean(config.includeTrashed);
  const recursive =
    typeof config.recursive === "boolean" ? config.recursive : true;
  const maxDepth = parsePositiveInt(config.maxDepth, 8, 0, 24);
  const modifiedAfterRaw =
    parseIsoDate(config.modifiedAfter) ||
    (typeof config.syncCursor === "object" &&
    config.syncCursor &&
    !Array.isArray(config.syncCursor)
      ? parseIsoDate((config.syncCursor as Record<string, unknown>).lastSyncAt)
      : null);
  const maxFiles = Math.max(
    1,
    Math.min(
      5000,
      typeof config.maxFiles === "number" && Number.isFinite(config.maxFiles)
        ? Math.floor(config.maxFiles)
        : 1000,
    ),
  );

  const headers = {
    Authorization: `Bearer ${accessToken}`,
  };

  type DriveFileWithPath = {
    file: Record<string, unknown>;
    pathSegments: string[];
  };

  let driveFiles: DriveFileWithPath[] = [];

  if (fileIds.length > 0) {
    for (const fileId of fileIds) {
      const metadataUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
        fileId,
      )}?fields=id,name,mimeType,modifiedTime,owners(displayName),webViewLink,version&supportsAllDrives=true`;
      const response = await fetchWithTimeout(metadataUrl, { headers });
      if (!response.ok) {
        const body = await response.text();
        errors.push({
          externalId: fileId,
          message: `Metadata fetch failed: ${response.status} ${body.slice(0, 160)}`,
        });
        continue;
      }
      driveFiles.push({
        file: (await response.json()) as Record<string, unknown>,
        pathSegments: [],
      });
    }
  } else if (folderId) {
    const isSharedWithMe = folderId === SHARED_WITH_ME_FOLDER_TOKEN;
    let rootName = "";
    if (!isSharedWithMe) {
      const rootMetaUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
        folderId,
      )}?fields=id,name,mimeType&supportsAllDrives=true`;
      const rootMetaResponse = await fetchWithTimeout(rootMetaUrl, { headers });
      if (rootMetaResponse.ok) {
        const root = (await rootMetaResponse.json()) as Record<string, unknown>;
        rootName = typeof root.name === "string" ? root.name : "";
      }
    } else {
      rootName = "Shared with me";
    }

    const queue: Array<{ folderId: string; depth: number; pathSegments: string[]; sharedWithMe?: boolean }> = [
      {
        folderId,
        depth: 0,
        pathSegments: rootName ? [rootName] : [],
        sharedWithMe: isSharedWithMe,
      },
    ];
    const visitedFolders = new Set<string>();

    while (queue.length > 0 && driveFiles.length < maxFiles) {
      const current = queue.shift()!;
      if (visitedFolders.has(current.folderId)) {
        continue;
      }
      visitedFolders.add(current.folderId);

      let nextPageToken: string | undefined;
      do {
        const queryParts = current.sharedWithMe
          ? ["sharedWithMe=true"]
          : [`'${current.folderId}' in parents`];
        if (!includeTrashed) {
          queryParts.push("trashed=false");
        }
        if (modifiedAfterRaw) {
          queryParts.push(`modifiedTime > '${modifiedAfterRaw}'`);
        }

        const q = queryParts.join(" and ");
        const listUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
          q,
        )}&pageSize=200&fields=nextPageToken,files(id,name,mimeType,modifiedTime,owners(displayName),webViewLink,version)&supportsAllDrives=true&includeItemsFromAllDrives=true${
          nextPageToken ? `&pageToken=${encodeURIComponent(nextPageToken)}` : ""
        }`;

        const response = await fetchWithTimeout(listUrl, { headers });
        if (!response.ok) {
          const body = await response.text();
          throw new Error(
            `Google Drive folder listing failed: ${response.status} ${body.slice(0, 200)}`,
          );
        }

        const payload = (await response.json()) as {
          nextPageToken?: string;
          files?: Array<Record<string, unknown>>;
        };
        const pageFiles = payload.files ?? [];

        for (const file of pageFiles) {
          const mimeType =
            typeof file.mimeType === "string"
              ? file.mimeType
              : "application/octet-stream";
          const name = typeof file.name === "string" ? file.name : "";
          const id = typeof file.id === "string" ? file.id : "";

          if (!id) {
            continue;
          }

          if (mimeType === GOOGLE_FOLDER_MIME) {
            if (recursive && current.depth < maxDepth) {
              queue.push({
                folderId: id,
                depth: current.depth + 1,
                pathSegments: name
                  ? [...current.pathSegments, name]
                  : [...current.pathSegments],
                sharedWithMe: false,
              });
            }
            continue;
          }

          driveFiles.push({
            file,
            pathSegments: [...current.pathSegments],
          });
          if (driveFiles.length >= maxFiles) {
            break;
          }
        }

        nextPageToken = payload.nextPageToken;
      } while (nextPageToken && driveFiles.length < maxFiles);
    }
  } else {
    throw new Error("Google Drive connector requires either fileIds[] or folderId.");
  }

  for (const entry of driveFiles.slice(0, maxFiles)) {
    const file = entry.file;
    const pathSegments = entry.pathSegments;
    const fileId = typeof file.id === "string" ? file.id : "";
    const fileName = typeof file.name === "string" ? file.name : "Untitled";
    const mimeType =
      typeof file.mimeType === "string" ? file.mimeType : "application/octet-stream";
    const version =
      typeof file.version === "number"
        ? String(file.version)
        : typeof file.version === "string"
          ? file.version
          : null;
    const webViewLink = typeof file.webViewLink === "string" ? file.webViewLink : null;
    const owners = Array.isArray(file.owners) ? file.owners : [];
    const owner = owners.length > 0 && owners[0] && typeof owners[0] === "object"
      ? (owners[0] as Record<string, unknown>).displayName
      : null;

    if (!fileId || mimeType === GOOGLE_FOLDER_MIME) {
      continue;
    }

    if (isTemporaryOfficeFileName(fileName)) {
      continue;
    }

    try {
      const contentText = await fetchGoogleDriveFileText(
        fileId,
        mimeType,
        accessToken,
        fileName,
      );
      documents.push({
        externalId: fileId,
        title: fileName,
        contentText,
        sourceUrl: webViewLink,
        mimeType,
        owner: typeof owner === "string" ? owner : null,
        accessScope: "google_drive",
        revisionId: version,
        metadata: {
          modifiedTime: file.modifiedTime,
          drivePathSegments: pathSegments,
          drivePath: pathSegments.join(" / "),
          driveFolderHint:
            pathSegments.length > 0
              ? pathSegments[pathSegments.length - 1]
              : null,
        },
      });
    } catch (error) {
      errors.push({
        externalId: fileId,
        message: error instanceof Error ? error.message : "Failed to fetch Google Drive file",
      });
    }
  }

  return { documents, errors };
}

function resolveWebConnectorHeaders(
  config: Record<string, unknown>,
  secret: Record<string, unknown>,
) {
  const headers: Record<string, string> = {};

  const apiKey =
    (typeof secret.apiKey === "string" && secret.apiKey.trim()) ||
    (typeof config.apiKey === "string" && config.apiKey.trim()) ||
    "";
  const apiKeyHeader =
    (typeof config.apiKeyHeader === "string" && config.apiKeyHeader.trim()) ||
    "Authorization";
  const apiKeyPrefix =
    typeof config.apiKeyPrefix === "string" ? config.apiKeyPrefix : "Bearer ";

  if (apiKey) {
    const value =
      apiKeyHeader.toLowerCase() === "authorization"
        ? `${apiKeyPrefix}${apiKey}`
        : apiKey;
    headers[apiKeyHeader] = value;
  }

  const secretHeaders =
    secret.headers && typeof secret.headers === "object" && !Array.isArray(secret.headers)
      ? (secret.headers as Record<string, unknown>)
      : {};
  for (const [key, value] of Object.entries(secretHeaders)) {
    if (typeof value === "string" && key.trim()) {
      headers[key.trim()] = value;
    }
  }

  return headers;
}

async function fetchWebUrlDocuments(
  config: Record<string, unknown>,
  secret: Record<string, unknown>,
): Promise<ConnectorFetchResult> {
  const listUrls = Array.isArray(config.urls)
    ? config.urls.filter((value): value is string => typeof value === "string" && value.length > 0)
    : [];
  const singleUrl = typeof config.url === "string" && config.url.length > 0 ? [config.url] : [];
  const urls = [...new Set([...listUrls, ...singleUrl])];

  if (urls.length === 0) {
    throw new Error("web_url connector requires configJson.url or configJson.urls[]");
  }

  const documents: ConnectorFetchedDocument[] = [];
  const errors: ConnectorFetchResult["errors"] = [];
  const headers = resolveWebConnectorHeaders(config, secret);

  for (const url of urls) {
    try {
      const response = await fetchWithTimeout(url, {
        headers,
      });
      if (!response.ok) {
        const body = await response.text();
        errors.push({
          externalId: url,
          message: `URL fetch failed: ${response.status} ${body.slice(0, 160)}`,
        });
        continue;
      }

      const text = (await response.text()).trim();
      if (!text) {
        errors.push({
          externalId: url,
          message: "URL returned empty body",
        });
        continue;
      }

      documents.push({
        externalId: url,
        title: url,
        contentText: text,
        sourceUrl: url,
        mimeType: response.headers.get("content-type"),
        accessScope: "web",
      });
    } catch (error) {
      errors.push({
        externalId: url,
        message: error instanceof Error ? error.message : "Unknown web fetch error",
      });
    }
  }

  return { documents, errors };
}

async function fetchPostgresDocuments(config: Record<string, unknown>): Promise<ConnectorFetchResult> {
  const connectionString =
    typeof config.connectionString === "string" ? config.connectionString : "";
  const query = typeof config.query === "string" ? config.query : "";
  const idColumn = typeof config.idColumn === "string" ? config.idColumn : "id";
  const titleColumn = typeof config.titleColumn === "string" ? config.titleColumn : "title";
  const textColumns = Array.isArray(config.textColumns)
    ? config.textColumns.filter((value): value is string => typeof value === "string")
    : [];

  if (!connectionString || !query) {
    throw new Error("postgres connector requires configJson.connectionString and configJson.query");
  }

  const client = new PgClient({ connectionString });
  await client.connect();

  try {
    const result = await client.query(query);
    const documents: ConnectorFetchedDocument[] = result.rows.map((row, index) => {
      const rowRecord = row as Record<string, unknown>;
      const externalId = String(rowRecord[idColumn] ?? `row-${index + 1}`);
      const title = String(rowRecord[titleColumn] ?? `Record ${index + 1}`);
      const contentText =
        textColumns.length > 0
          ? textColumns.map((column) => String(rowRecord[column] ?? "")).join("\n").trim()
          : JSON.stringify(rowRecord, null, 2);

      return {
        externalId,
        title,
        contentText: contentText || JSON.stringify(rowRecord, null, 2),
        mimeType: "application/json",
        accessScope: "database",
        metadata: {
          rowIndex: index,
          source: "postgres",
        },
      };
    });

    return { documents, errors: [] };
  } finally {
    await client.end();
  }
}

async function fetchMysqlDocuments(config: Record<string, unknown>): Promise<ConnectorFetchResult> {
  const connectionUri =
    typeof config.connectionUri === "string"
      ? config.connectionUri
      : typeof config.connectionString === "string"
        ? config.connectionString
        : "";
  const query = typeof config.query === "string" ? config.query : "";
  const idColumn = typeof config.idColumn === "string" ? config.idColumn : "id";
  const titleColumn = typeof config.titleColumn === "string" ? config.titleColumn : "title";
  const textColumns = Array.isArray(config.textColumns)
    ? config.textColumns.filter((value): value is string => typeof value === "string")
    : [];

  if (!connectionUri || !query) {
    throw new Error("mysql connector requires configJson.connectionUri and configJson.query");
  }

  const connection = await createConnection(connectionUri);

  try {
    const [rows] = await connection.query(query);
    const data = Array.isArray(rows) ? (rows as Array<Record<string, unknown>>) : [];

    const documents: ConnectorFetchedDocument[] = data.map((row, index) => {
      const externalId = String(row[idColumn] ?? `row-${index + 1}`);
      const title = String(row[titleColumn] ?? `Record ${index + 1}`);
      const contentText =
        textColumns.length > 0
          ? textColumns.map((column) => String(row[column] ?? "")).join("\n").trim()
          : JSON.stringify(row, null, 2);

      return {
        externalId,
        title,
        contentText: contentText || JSON.stringify(row, null, 2),
        mimeType: "application/json",
        accessScope: "database",
        metadata: {
          rowIndex: index,
          source: "mysql",
        },
      };
    });

    return { documents, errors: [] };
  } finally {
    await connection.end();
  }
}

export async function fetchConnectorDocuments(input: {
  connectorType: ConnectorType;
  configJson: unknown;
  secretJson: unknown;
}): Promise<ConnectorFetchResult> {
  const config = safeRecord(input.configJson);
  const secret = safeRecord(input.secretJson);

  switch (input.connectorType) {
    case "google_drive":
      return fetchGoogleDriveDocuments(config, secret);
    case "web_url":
      return fetchWebUrlDocuments(config, secret);
    case "postgres":
      return fetchPostgresDocuments(config);
    case "mysql":
      return fetchMysqlDocuments(config);
    case "manual_upload":
      return {
        documents: [],
        errors: [
          {
            message:
              "manual_upload connector requires explicit upload pipeline. No automated pull configured.",
          },
        ],
      };
    default:
      throw new Error(`Unsupported connector type: ${input.connectorType}`);
  }
}
