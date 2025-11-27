export enum CipherMode {
  WORD = 'WORD',         // Encodes whole words (Format: Line:Word)
  OTTENDORF = 'OTTENDORF' // Encodes characters (Format: Line:Word:Letter)
}

export interface BookLocation {
  line: number;
  word: number;
  char?: number;
  content: string; // The actual word or char found
}

// Maps a normalized word or character to an array of possible locations in the book
export interface BookIndex {
  [key: string]: BookLocation[];
}

export type ProcessingResult = {
  success: boolean;
  text: string;
  error?: string;
  missingTokens?: string[];
};

export interface CipherState {
  sourceText: string;
  inputText: string;
  mode: CipherMode;
  isEncoding: boolean; // true = Encode, false = Decode
}