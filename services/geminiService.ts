import { GoogleGenAI } from "@google/genai";

export const extractTextFromImage = async (base64Data: string, mimeType: string): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
  } catch (error) {
    console.error("Gemini OCR Error:", error);
    throw new Error("Falha ao reconhecer texto da imagem.");
  }
};