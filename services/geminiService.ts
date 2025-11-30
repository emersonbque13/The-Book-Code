import { GoogleGenAI } from "@google/genai";

export const extractTextFromImage = async (base64Data: string, mimeType: string, customKey?: string): Promise<string> => {
  const keyToUse = customKey || process.env.API_KEY;

  if (!keyToUse) {
    throw new Error("A Chave API (API_KEY) não foi configurada. Insira manualmente ou verifique as variáveis de ambiente.");
  }

  const ai = new GoogleGenAI({ apiKey: keyToUse });

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
    console.error("Gemini OCR Error:", error);
    // Propaga a mensagem real do erro para o App.tsx tratar (ex: API key not valid)
    throw new Error(error.message || "Falha desconhecida ao conectar com a API Gemini.");
  }
};