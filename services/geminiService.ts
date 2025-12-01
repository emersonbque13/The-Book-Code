import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";

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
            text: "Transcreva todo o texto contido nesta imagem. Ignore cabeçalhos ou rodapés irrelevantes se parecerem ruído, mas tente capturar o corpo do texto com precisão. Mantenha a formatação de parágrafos. Retorne apenas o texto transcrito, sem comentários adicionais."
          }
        ]
      },
      config: {
        // Reduzir restrições de segurança para OCR de texto, evitando falsos positivos
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: HarmBlockThreshold.BLOCK_NONE },
        ]
      }
    });

    if (!response.text) {
      throw new Error("O modelo retornou uma resposta vazia. Tente novamente ou verifique a qualidade da imagem.");
    }

    return response.text;
  } catch (error: any) {
    console.error("Gemini OCR Fallback Error:", error);
    // Retorna a mensagem original do erro para melhor debug no frontend
    throw new Error(`Falha na API Gemini: ${error.message || error.toString()}`);
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
    
    // Se a resposta não foi OK, tentar ler o erro para debug
    let errorDetail = "";
    try {
        const errData = await response.json();
        errorDetail = errData.error || "";
    } catch(e) {}

    console.warn(`Vision API endpoint returned status ${response.status}. Detail: ${errorDetail}. Switching to fallback.`);
    throw new Error("Vision API unavailable");

  } catch (visionError) {
    // 2. Fallback to Gemini
    console.log("Alternando para Fallback (Gemini)...");
    
    if (!geminiKey) {
      // Se não tiver chave, propaga o erro específico para que a UI peça a chave
      throw new Error("Google Vision API indisponível e Chave Gemini não configurada.");
    }

    return await extractTextWithGemini(base64Data, mimeType, geminiKey);
  }
};