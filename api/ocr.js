import { ImageAnnotatorClient } from '@google-cloud/vision';

export default async function handler(req, res) {
  // Configuração de CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Verificar Credenciais
    if (!process.env.GOOGLE_CREDENTIALS) {
      console.warn("Server: GOOGLE_CREDENTIALS não configurado.");
      return res.status(503).json({ error: 'Credenciais de serviço não configuradas.' });
    }

    // 2. Inicializar Cliente com tratamento robusto de JSON
    let credentials;
    try {
      credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
      
      // Correção crítica para quebras de linha em variáveis de ambiente no Vercel
      // O JSON.parse às vezes mantém o literal "\n" em vez da quebra de linha real
      if (credentials.private_key) {
        credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
      }
    } catch (e) {
      console.error("Server: Erro ao analisar JSON das credenciais", e);
      return res.status(500).json({ error: 'Formato de credenciais inválido (JSON parse error).' });
    }

    const client = new ImageAnnotatorClient({ credentials });

    // 3. Obter dados da imagem
    const { image } = req.body; 
    if (!image) {
      return res.status(400).json({ error: 'Nenhuma imagem fornecida no corpo da requisição.' });
    }

    // 4. Chamar Google Vision API
    // Usando documentTextDetection (OCR denso) que é melhor para livros/páginas
    const [result] = await client.documentTextDetection({
      image: { content: image }
    });

    // 5. Extração segura do texto
    // Tenta fullTextAnnotation (bloco completo) ou fallback para textAnnotations (fragmentos)
    const fullText = result.fullTextAnnotation?.text || result.textAnnotations?.[0]?.description || '';
    
    if (!fullText) {
        return res.status(200).json({ text: '', message: 'Nenhum texto detectado na imagem.' });
    }

    return res.status(200).json({ text: fullText });

  } catch (error) {
    console.error('Server: Erro na Vision API:', error);
    // Retorna a mensagem de erro para o cliente (útil para o fallback entender o que houve)
    return res.status(500).json({ error: error.message || 'Erro interno no servidor OCR.' });
  }
}