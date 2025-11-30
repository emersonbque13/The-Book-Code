import { ImageAnnotatorClient } from '@google-cloud/vision';

export default async function handler(req, res) {
  // CORS handling (optional but good practice if needed)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Check for Server-Side Credentials
    // In Vercel, set GOOGLE_CREDENTIALS environment variable to the content of your Service Account JSON.
    if (!process.env.GOOGLE_CREDENTIALS) {
      // Return 503 so frontend knows to use fallback
      return res.status(503).json({ error: 'Service credentials not configured on server.' });
    }

    // 2. Initialize Client
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    const client = new ImageAnnotatorClient({ credentials });

    // 3. Get Image Data
    const { image } = req.body; // Expecting base64 string without data prefix
    if (!image) {
      return res.status(400).json({ error: 'No image data provided.' });
    }

    // 4. Call Google Vision API
    const [result] = await client.textDetection({
      image: { content: image }
    });

    const fullText = result.fullTextAnnotation?.text || '';
    
    // 5. Return Text
    return res.status(200).json({ text: fullText });

  } catch (error) {
    console.error('Vision API Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error during OCR.' });
  }
}