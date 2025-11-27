import { BookIndex, BookLocation, CipherMode, ProcessingResult } from '../types';

/**
 * Parses the "Book" text into a structured index for fast lookups.
 * We index by lines and words.
 */
export const indexBook = (text: string, mode: CipherMode): BookIndex => {
  const index: BookIndex = {};
  const lines = text.split(/\r?\n/);

  lines.forEach((lineContent, lineIdx) => {
    // 1-based indexing for user friendliness
    const lineNum = lineIdx + 1; 
    
    // Split by spaces to get words, keeping punctuation attached to words implies
    // strict matching, but usually book ciphers strip punctuation. 
    // We will clean words for indexing.
    const words = lineContent.trim().split(/\s+/);

    words.forEach((rawWord, wordIdx) => {
      if (!rawWord) return;
      
      const wordNum = wordIdx + 1;
      // Clean the word for the key (remove punctuation, lowercase)
      const cleanWord = rawWord.replace(/[^\wÀ-ÿ]/g, '').toLowerCase();
      
      if (mode === CipherMode.WORD) {
        if (!cleanWord) return;
        if (!index[cleanWord]) index[cleanWord] = [];
        index[cleanWord].push({ line: lineNum, word: wordNum, content: cleanWord });
      } 
      else if (mode === CipherMode.OTTENDORF) {
        // Index every character in the raw word (or clean word)
        // Ottendorf usually counts letters within the word.
        // We will use the Clean Word for letter counting to avoid confusion with punctuation.
        const chars = cleanWord.split('');
        chars.forEach((char, charIdx) => {
          const charNum = charIdx + 1;
          const key = char.toLowerCase();
          if (!index[key]) index[key] = [];
          index[key].push({ line: lineNum, word: wordNum, char: charNum, content: char });
        });
      }
    });
  });

  return index;
};

/**
 * Encodes a message using the provided book index.
 * Uses Homophonic Substitution (randomly selects one valid location for each token).
 * Adds Page Number to the code structure if provided (mainly for Ottendorf).
 */
export const encodeMessage = (message: string, bookIndex: BookIndex, mode: CipherMode, pageNumber: number = 1): ProcessingResult => {
  const missingTokens: string[] = [];
  let result = "";
  
  // Normalize tokens based on mode
  if (mode === CipherMode.WORD) {
    // Split message into words
    const tokens = message.trim().split(/\s+/);
    
    const codes = tokens.map(token => {
      const cleanToken = token.replace(/[^\wÀ-ÿ]/g, '').toLowerCase();
      if (!cleanToken) return null; // Skip pure punctuation in word mode usually

      const locations = bookIndex[cleanToken];
      
      if (!locations || locations.length === 0) {
        missingTokens.push(token);
        return `[${token}]`; // Keep plaintext if not found
      }

      // Pick a random location
      const loc = locations[Math.floor(Math.random() * locations.length)];
      return `${loc.line}:${loc.word}`;
    }).filter(c => c !== null);

    result = codes.join("  ");
  } 
  else {
    // Character mode (Ottendorf/P.L.L)
    // We process every character that is a letter/number
    const chars = message.split('');
    const codes = chars.map(char => {
       if (char.match(/\s/)) return '/'; // Use slash for spaces
       
       const cleanChar = char.toLowerCase();
       // If it's not a standard letter/number, just keep it (punctuation)
       if (!cleanChar.match(/[a-z0-9À-ÿ]/)) return char;

       const locations = bookIndex[cleanChar];
       if (!locations || locations.length === 0) {
         missingTokens.push(char);
         return `[${char}]`;
       }

       const loc = locations[Math.floor(Math.random() * locations.length)];
       // Format: Page:Line:Word:Letter
       return `${pageNumber}:${loc.line}:${loc.word}:${loc.char}`;
    });

    result = codes.join(" ");
  }

  return {
    success: missingTokens.length === 0,
    text: result,
    missingTokens: [...new Set(missingTokens)]
  };
};

/**
 * Decodes a cipher string using the Book Text (not index, we need direct lookup).
 */
export const decodeMessage = (cipher: string, bookText: string, mode: CipherMode): ProcessingResult => {
  const lines = bookText.split(/\r?\n/);
  let decodedParts: string[] = [];
  let error = undefined;

  // Split cipher by spaces
  const tokens = cipher.trim().split(/\s+/);

  decodedParts = tokens.map(token => {
    // Handle spaces/separators
    if (token === '/') return ' ';
    if (token.startsWith('[') && token.endsWith(']')) return token.slice(1, -1); // Plaintext fallback
    if (!token.includes(':')) return token; // Not a code? return as is.

    const parts = token.split(':').map(n => parseInt(n, 10));
    
    // Explicitly initialize variables to avoid TS strict null check errors
    let lineNum: number = 0;
    let wordNum: number = 0;
    let charNum: number = 0;

    if (mode === CipherMode.WORD) {
      // Expecting Line:Word
      if (parts.length >= 2) {
        lineNum = parts[0];
        wordNum = parts[1];
      }
    } else {
      // Expecting Page:Line:Word:Letter (4 parts) OR Line:Word:Letter (3 parts - legacy)
      if (parts.length === 4) {
         // We ignore the Page Number (parts[0]) for the actual decoding logic
         // assuming the user has loaded the correct text into the "Dados Coletados" area.
         lineNum = parts[1];
         wordNum = parts[2];
         charNum = parts[3];
      } else if (parts.length === 3) {
         lineNum = parts[0];
         wordNum = parts[1];
         charNum = parts[2];
      }
    }

    // Validate Line
    if (lineNum < 1 || lineNum > lines.length) return '?';
    
    const lineContent = lines[lineNum - 1];
    const words = lineContent.trim().split(/\s+/);

    // Validate Word
    if (wordNum < 1 || wordNum > words.length) return '?';
    
    const rawWord = words[wordNum - 1];
    const cleanWord = rawWord.replace(/[^\wÀ-ÿ]/g, '');

    if (mode === CipherMode.WORD) {
      return cleanWord.toUpperCase();
    } else {
      // Validate Char
      if (charNum < 1 || charNum > cleanWord.length) return '?';
      return cleanWord[charNum - 1].toUpperCase();
    }
  });

  return {
    success: true,
    text: mode === CipherMode.WORD ? decodedParts.join(' ') : decodedParts.join(''),
    error
  };
};