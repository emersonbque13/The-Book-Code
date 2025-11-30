import { GoogleGenAI } from "@google/genai";

/**
 * Fallback method: Uses Gemini API (Client-Side)
 */
const extractTextWithGemini = async (base64Data: string, mimeType: string, apiKey: string): Promise<string> => {
  if (!apiKey) {
    throw new Error("Falha no OCR Primário e Chave API Gemini ausente para fallback.");
  }

  const ai = new GoogleGenAI({ apiKey: apiKey });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType
            }
          },
          {
            text: "Transcreva todo o texto contido nesta imagem. Ignore cabeçalhos ou rodapés irrelevantes se parecerem ruído, mas tente capturar o corpo do texto com precisão. Retorne apenas o texto transcrito, sem comentários adicionais."
          }
        ]
      }
    });

    return response.text || "";
  } catch (error: any) {
    console.error("Gemini OCR Fallback Error:", error);
    throw new Error(error.message || "Falha na API Gemini.");
  }
};

/**
 * Main OCR entry point.
 * Strategy:
 * 1. Try Google Vision API (via /api/ocr Vercel function).
 * 2. If fails (or local dev without API mock), Fallback to Gemini.
 */
export const extractTextFromImage = async (base64Data: string, mimeType: string, customKey?: string): Promise<string> => {
  const geminiKey = customKey || process.env.API_KEY;

  // 1. Attempt Google Vision API (Server-Side)
  try {
    const controller = new AbortController();
    // Timeout to prevent hanging if serverless is slow, switching to fallback faster
    const timeoutId = setTimeout(() => controller.abort(), 8000); 

    const response = await fetch('/api/ocr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: base64Data }), // Sending raw base64
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.text) {
        console.log("OCR Sucesso: Via Google Vision API");
        return data.text;
      }
    }
    
    // If response was not OK (e.g. 503 credentials missing, 404 route not found locally), throw to trigger catch
    console.warn(`Vision API endpoint returned status ${response.status}. Switching to fallback.`);
    throw new Error("Vision API unavailable");

  } catch (visionError) {
    // 2. Fallback to Gemini
    console.log("Alternando para Fallback (Gemini)...", visionError);
    
    if (!geminiKey) {
      throw new Error("Google Vision API indisponível e Chave Gemini não configurada.");
    }

    return await extractTextWithGemini(base64Data, mimeType, geminiKey);
  }
};