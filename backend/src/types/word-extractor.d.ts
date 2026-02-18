declare module "word-extractor" {
  interface ExtractedWordDocument {
    getBody(): string;
    getFootnotes(): string;
    getHeaders(options?: { includeFooters?: boolean }): string;
  }

  export default class WordExtractor {
    extract(source: string | Buffer): Promise<ExtractedWordDocument>;
  }
}

