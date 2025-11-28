import { BookIndex, BookLocation, CipherMode, ProcessingResult } from '../types';

/**
 * Parses the "Book" text into a structured index for fast lookups.
 * Indexes by Paragraph -> Line -> Word.
 */
export const indexBook = (text: string, mode: CipherMode): BookIndex => {
  const index: BookIndex = {};
  
  // Split by double newlines to identify paragraphs
  // Using regex to catch multiple newlines or newlines with whitespace
  const paragraphs = text.split(/\n\s*\n/);

  paragraphs.forEach((paraContent, paraIdx) => {
    if (!paraContent.trim()) return;
    
    const paragraphNum = paraIdx + 1;
    
    // Split paragraph into lines
    const lines = paraContent.split(/\r?\n/);

    lines.forEach((lineContent, lineIdx) => {
      const lineNum = lineIdx + 1; 
      
      // Split by spaces to get words
      const words = lineContent.trim().split(/\s+/);

      words.forEach((rawWord, wordIdx) => {
        if (!rawWord) return;
        
        const wordNum = wordIdx + 1;
        // Clean the word for the key (remove punctuation, lowercase)
        const cleanWord = rawWord.replace(/[^\wÀ-ÿ]/g, '').toLowerCase();
        
        if (!cleanWord) return;
        
        if (!index[cleanWord]) index[cleanWord] = [];
        
        // Store location: Paragraph, Line (relative to paragraph), Word
        index[cleanWord].push({ 
          paragraph: paragraphNum,
          line: lineNum, 
          word: wordNum, 
          content: cleanWord 
        });
      });
    });
  });

  return index;
};

/**
 * Encodes a message using the provided book index.
 * Uses Homophonic Substitution (randomly selects one valid location for each word).
 * PLP Format: Paragraph:Line:Word
 * DPLP Format: Date:Paragraph:Line:Word
 */
export const encodeMessage = (message: string, bookIndex: BookIndex, mode: CipherMode, dateString: string = ""): ProcessingResult => {
  const missingTokens: string[] = [];
  
  // Split message into words
  const tokens = message.trim().split(/\s+/);
  
  const codes = tokens.map(token => {
    // Clean token to match index key style
    const cleanToken = token.replace(/[^\wÀ-ÿ]/g, '').toLowerCase();
    
    // If it's punctuation only or empty, keep it as plaintext (or handle as space if needed)
    if (!cleanToken) return token; 

    const locations = bookIndex[cleanToken];
    
    if (!locations || locations.length === 0) {
      missingTokens.push(token);
      return `[${token}]`; // Keep plaintext if not found
    }

    // Pick a random location
    const loc = locations[Math.floor(Math.random() * locations.length)];
    
    if (mode === CipherMode.DPLP) {
      // Date:Paragraph:Line:Word
      // Default date to "000000" if not provided, or ensure it's not empty
      const d = dateString.trim() || "DATA";
      return `${d}:${loc.paragraph}:${loc.line}:${loc.word}`;
    } else {
      // PLP -> Paragraph:Line:Word
      return `${loc.paragraph}:${loc.line}:${loc.word}`;
    }
  });

  return {
    success: missingTokens.length === 0,
    text: codes.join("  "), // Double space to separate coded words visually
    missingTokens: [...new Set(missingTokens)]
  };
};

/**
 * Decodes a cipher string using the Book Text.
 * Reconstructs the paragraph structure to lookup words.
 */
export const decodeMessage = (cipher: string, bookText: string, mode: CipherMode): ProcessingResult => {
  // Reconstruct the structure to lookup
  const paragraphs = bookText.split(/\n\s*\n/);
  
  let decodedParts: string[] = [];
  let error = undefined;

  // Split cipher by spaces
  const tokens = cipher.trim().split(/\s+/);

  decodedParts = tokens.map(token => {
    // Handle brackets (plaintext fallback)
    if (token.startsWith('[') && token.endsWith(']')) return token.slice(1, -1);
    
    // Check for valid format (must contain colons)
    if (!token.includes(':')) return token;

    const parts = token.split(':');
    
    let paraNum: number = 0;
    let lineNum: number = 0;
    let wordNum: number = 0;

    if (mode === CipherMode.PLP) {
      // Expecting P:L:P (3 parts)
      if (parts.length === 3) {
        paraNum = parseInt(parts[0], 10);
        lineNum = parseInt(parts[1], 10);
        wordNum = parseInt(parts[2], 10);
      } else {
        return '?';
      }
    } else if (mode === CipherMode.DPLP) {
      // Expecting Date:P:L:P (4 parts)
      if (parts.length === 4) {
        // parts[0] is Date, we ignore it for decoding content
        paraNum = parseInt(parts[1], 10);
        lineNum = parseInt(parts[2], 10);
        wordNum = parseInt(parts[3], 10);
      } else {
        return '?';
      }
    }

    // Validate inputs
    if (isNaN(paraNum) || isNaN(lineNum) || isNaN(wordNum)) return '?';

    // 1. Find Paragraph
    if (paraNum < 1 || paraNum > paragraphs.length) return '?';
    const paraContent = paragraphs[paraNum - 1];
    if (!paraContent) return '?';

    // 2. Find Line within Paragraph
    const lines = paraContent.split(/\r?\n/);
    if (lineNum < 1 || lineNum > lines.length) return '?';
    const lineContent = lines[lineNum - 1];

    // 3. Find Word within Line
    const words = lineContent.trim().split(/\s+/);
    if (wordNum < 1 || wordNum > words.length) return '?';
    
    const rawWord = words[wordNum - 1];
    // Clean to return the word without attached punctuation if desired, 
    // or return rawWord to preserve book punctuation. 
    // Usually decoding wants the word concept.
    const cleanWord = rawWord.replace(/[^\wÀ-ÿ]/g, '');

    return cleanWord.toUpperCase();
  });

  return {
    success: true,
    text: decodedParts.join(' '),
    error
  };
};