export enum CipherMode {
  PLP = 'PLP',   // Format: Paragraph:Line:Word
  DPLP = 'DPLP'  // Format: Date:Paragraph:Line:Word
}

export interface BookLocation {
  paragraph: number;
  line: number;
  word: number;
  content: string; // The actual word found
}

// Maps a normalized word to an array of possible locations in the book
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

// Google AI Studio Global Interface
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    aistudio?: AIStudio;
  }
}