import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { BookOpen, Key, Lock, Unlock, RefreshCw, FileText, ArrowRight, Camera, Cpu, Terminal, Shield, Hash, Upload, Calendar, Trash2 } from 'lucide-react';
import { CipherMode, ProcessingResult } from './types';
import { indexBook, encodeMessage, decodeMessage } from './services/cipherService';
import { extractTextFromImage } from './services/geminiService';
import { Button } from './components/Button';

// Texto inicial padrão
const INITIAL_BOOK = `Escreva aqui seu texto...`;

const CornerMarker = ({ className }: { className?: string }) => (
  <svg className={`absolute w-8 h-8 text-cyan-500/50 pointer-events-none ${className}`} viewBox="0 0 40 40" fill="none">
    <path d="M1 1H10M1 1V10" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const App: React.FC = () => {
  // Estado
  const [bookText, setBookText] = useState<string>(INITIAL_BOOK);
  const [inputText, setInputText] = useState<string>("");
  const [mode, setMode] = useState<CipherMode>(CipherMode.PLP);
  const [dateString, setDateString] = useState<string>("");
  const [isEncoding, setIsEncoding] = useState<boolean>(true);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState<boolean>(false);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  
  // API Key State
  const [apiKeyReady, setApiKeyReady] = useState<boolean>(false);
  const [canUseAIStudio, setCanUseAIStudio] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const txtInputRef = useRef<HTMLInputElement>(null);

  // Verificar disponibilidade da API Key na inicialização
  useEffect(() => {
    const checkApiKey = async () => {
      // Verifica se está rodando no ambiente AI Studio
      if (window.aistudio) {
        setCanUseAIStudio(true);
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setApiKeyReady(hasKey);
      } else {
        // Ambiente padrão (Vercel/Local) - verifica variavel de ambiente
        // Nota: process.env.API_KEY é injetado pelo Vite como string
        setApiKeyReady(!!process.env.API_KEY);
      }
    };
    checkApiKey();
  }, []);

  const handleLinkApiKey = async () => {
    if (window.aistudio) {
      try {
        await window.aistudio.openSelectKey();
        // Assume sucesso para mitigar condição de corrida, conforme instrução
        setApiKeyReady(true);
      } catch (e) {
        console.error("Erro ao selecionar chave", e);
        setApiKeyReady(false);
      }
    }
  };

  // Índice do Livro Memoizado
  const bookIndex = useMemo(() => {
    return indexBook(bookText, mode);
  }, [bookText, mode]);

  // Estatísticas do Livro
  const bookStats = useMemo(() => {
    const lines = bookText.split(/\r\n|\r|\n/).length;
    const words = bookText.split(/\s+/).filter(w => w.length > 0).length;
    const chars = bookText.length;
    const letters = bookText.replace(/[^a-zA-ZÀ-ÿ]/g, '').length;
    const paragraphs = bookText.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;
    // Estimativa de páginas (ex: 40 linhas por página)
    const pages = Math.max(1, Math.ceil(lines / 40));

    return { lines, words, chars, letters, paragraphs, pages };
  }, [bookText]);

  // Lógica Principal de Processamento
  const processText = useCallback(() => {
    if (!inputText.trim()) {
      setResult(null);
      return;
    }

    if (isEncoding) {
      const res = encodeMessage(inputText, bookIndex, mode, dateString);
      setResult(res);
    } else {
      const res = decodeMessage(inputText, bookText, mode);
      setResult(res);
    }
  }, [inputText, bookIndex, mode, isEncoding, dateString, bookText]);

  useEffect(() => {
    processText();
  }, [processText]);

  // Função auxiliar para processar imagens (OCR)
  const processImageFile = async (file: File) => {
    if (!apiKeyReady) {
      if (canUseAIStudio) {
        handleLinkApiKey();
        return;
      } else {
        alert("Erro: API Key não detectada.\n\nSe você está no Vercel:\n1. Vá em Settings > Environment Variables\n2. Adicione KEY: API_KEY e VALUE: sua_chave\n3. Faça o Redeploy.");
        return;
      }
    }

    setIsAnalyzingImage(true);
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const text = await extractTextFromImage(base64Data, file.type);
      
      setBookText(prev => {
        // Se o texto atual for o padrão ou estiver vazio, substitui.
        // Caso contrário, anexa (útil para adicionar múltiplas páginas).
        if (prev === INITIAL_BOOK || prev.trim() === "") {
          return text;
        }
        const separator = "\n\n--- NOVA PÁGINA IDENTIFICADA ---\n\n";
        return prev + separator + text;
      });

    } catch (err: any) {
      console.error(err);
      const msg = err.message || "";
      
      if (msg.includes("403") || msg.includes("API key not valid") || msg.includes("key")) {
        alert(`Erro de Autenticação na API Gemini:\n\n${msg}\n\nVerifique se sua API_KEY no Vercel está correta e válida.`);
      } else {
        alert(`Erro ao processar imagem:\n\n${msg}`);
      }
    } finally {
      setIsAnalyzingImage(false);
    }
  };

  // Handler unificado para o botão "Upload Arquivo" (Texto ou Imagem)
  const handleUniversalUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Se for arquivo de texto
    if (file.type === 'text/plain') {
      try {
        const text = await file.text();
        setBookText(text);
      } catch (err) {
        alert("Erro ao ler o arquivo de texto.");
      }
    } 
    // Se for imagem (png, jpeg, webp, etc)
    else if (file.type.startsWith('image/')) {
      await processImageFile(file);
    }
    else {
      alert("Formato de arquivo não suportado. Use .txt ou Imagens.");
    }

    // Limpar input para permitir selecionar o mesmo arquivo novamente se necessário
    if (txtInputRef.current) txtInputRef.current.value = '';
  };

  // Handler exclusivo para o botão "Câmera" (Imagens apenas)
  const handleCameraUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      await processImageFile(file);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Limpa o texto padrão quando o usuário clica na caixa de texto
  const handleBookTextFocus = () => {
    if (bookText === INITIAL_BOOK) {
      setBookText("");
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center relative">
      
      {/* Decorative Background Elements */}
      <div className="fixed top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50"></div>
      
      {/* Cabeçalho Cyber */}
      <header className="w-full max-w-7xl mb-12 border-b border-cyan-900/30 pb-6 relative">
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-cyan-950 border border-cyan-500/30 rounded-sm shadow-[0_0_15px_rgba(34,211,238,0.1)]">
              <Cpu className="w-10 h-10 text-cyan-400 animate-pulse" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-orbitron font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400 uppercase tracking-widest drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]">
                The Book Code
              </h1>
              <p className="text-slate-400 font-rajdhani text-lg mt-1 tracking-wider uppercase flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full animate-ping ${apiKeyReady ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                Protocolo de Mensagens Seguras V.1
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-3">
            {/* API Key Status Indicator / Action */}
            {!apiKeyReady && canUseAIStudio && (
              <Button variant="danger" size="sm" onClick={handleLinkApiKey} className="animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.4)]">
                 <Key className="w-4 h-4 mr-2" />
                 VINCULAR CHAVE API
              </Button>
            )}
            
            {!apiKeyReady && !canUseAIStudio && (
               <div 
                className="text-red-500 text-xs font-orbitron border border-red-900/50 bg-red-950/30 px-3 py-1 rounded flex items-center gap-2 cursor-help"
                title="Configure a variável de ambiente API_KEY no Vercel (Settings -> Env Variables) ou crie um arquivo .env localmente."
               >
                 <Shield className="w-3 h-3" />
                 API KEY MISSING (.ENV)
               </div>
            )}

            <div className="flex items-center gap-1 bg-slate-950/50 p-1 border border-slate-800 backdrop-blur-sm" style={{ clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)" }}>
              <button
                onClick={() => setMode(CipherMode.PLP)}
                className={`px-4 py-2 text-sm font-orbitron uppercase tracking-wider transition-all ${mode === CipherMode.PLP ? 'bg-cyan-900/50 text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Modo P.L.P
              </button>
              <button
                onClick={() => setMode(CipherMode.DPLP)}
                className={`px-4 py-2 text-sm font-orbitron uppercase tracking-wider transition-all ${mode === CipherMode.DPLP ? 'bg-cyan-900/50 text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Modo D.P.L.P
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Grid Principal */}
      <main className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Coluna Esquerda: O Livro (Chave) - 5 Colunas */}
        <section className="lg:col-span-5 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-2 gap-4">
            <h2 className="text-xl font-orbitron text-slate-300 flex items-center gap-2 uppercase tracking-widest">
              <Terminal className="w-5 h-5 text-emerald-500" />
              Dados Coletados
            </h2>
            <div className="flex flex-wrap gap-2 justify-end">
              {/* Input universal: Aceita TXT e Imagens */}
              <input 
                type="file" 
                ref={txtInputRef} 
                accept=".txt,image/*" 
                onChange={handleUniversalUpload} 
                className="hidden" 
              />
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={() => txtInputRef.current?.click()} 
                isLoading={isAnalyzingImage}
              >
                <Upload className="w-3.5 h-3.5" />
                Upload Arquivo
              </Button>

              {/* Input Câmera: Focado em captura de imagem */}
              <input 
                type="file" 
                ref={fileInputRef} 
                accept="image/*" 
                capture="environment"
                onChange={handleCameraUpload} 
                className="hidden" 
              />
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={() => fileInputRef.current?.click()} 
                isLoading={isAnalyzingImage}
              >
                <Camera className="w-3.5 h-3.5" />
                Câmera
              </Button>
            </div>
          </div>
          
          <div className="relative group p-1">
            <CornerMarker className="top-0 left-0" />
            <CornerMarker className="bottom-0 right-0 rotate-180" />
            
            <textarea
              value={bookText}
              onChange={(e) => setBookText(e.target.value)}
              onFocus={handleBookTextFocus}
              className="cyber-input w-full h-[650px] rounded-sm p-6 font-mono text-xs md:text-sm leading-relaxed text-cyan-100/80 resize-none pb-12"
              placeholder="INICIALIZAR SISTEMA COM TEXTO CHAVE..."
              spellCheck={false}
            />
            
            {/* Stats Bar */}
            <div className="absolute bottom-2 right-2 left-2 flex flex-wrap justify-end gap-x-4 gap-y-1 text-[10px] font-orbitron text-cyan-700 uppercase tracking-widest bg-black/80 px-3 py-2 border-t border-cyan-900/30 backdrop-blur-md">
              <span>Páginas (Est.): <b className="text-cyan-400">{bookStats.pages}</b></span>
              <span>Parágrafos: <b className="text-cyan-400">{bookStats.paragraphs}</b></span>
              <span>Linhas: <b className="text-cyan-400">{bookStats.lines}</b></span>
              <span>Palavras: <b className="text-cyan-400">{bookStats.words}</b></span>
              <span>Letras: <b className="text-cyan-400">{bookStats.letters}</b></span>
            </div>
          </div>
          
          {/* Botão de Limpar Dados */}
          <div className="flex justify-end">
             <Button variant="danger" size="sm" onClick={() => setBookText("")} title="Apagar todo o texto coletado">
                <Trash2 className="w-4 h-4" />
                LIMPAR DADOS
             </Button>
          </div>
        </section>

        {/* Separador Visual (apenas desktop) */}
        <div className="hidden lg:flex lg:col-span-1 items-center justify-center relative">
          <div className="h-full w-[1px] bg-slate-800"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-2 bg-[#020617] border border-slate-800 rotate-45">
             <div className="-rotate-45">
               <Shield className="w-6 h-6 text-slate-600" />
             </div>
          </div>
        </div>

        {/* Coluna Direita: Operações - 6 Colunas */}
        <section className="lg:col-span-6 flex flex-col gap-8">
          
          {/* Painel de Controle */}
          <div className="bg-slate-900/50 p-6 border border-slate-800 relative backdrop-blur-sm" style={{ clipPath: "polygon(20px 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%, 0 20px)" }}>
            <h3 className="text-xs font-orbitron text-slate-500 uppercase tracking-[0.2em] mb-4">Módulo de Operação</h3>
            <div className="flex flex-wrap gap-4 items-center justify-between">
              <div className="flex gap-3 items-center">
                <Button
                  variant={isEncoding ? 'cyber' : 'secondary'}
                  onClick={() => { setIsEncoding(true); setInputText(''); }}
                  className={isEncoding ? 'shadow-[0_0_20px_rgba(52,211,153,0.2)]' : ''}
                >
                  <Lock className="w-4 h-4" />
                  Encriptar
                </Button>
                <Button
                  variant={!isEncoding ? 'primary' : 'secondary'}
                  onClick={() => { setIsEncoding(false); setInputText(''); }}
                  className={!isEncoding ? 'text-cyan-400 border-cyan-500 shadow-[0_0_20px_rgba(34,211,238,0.2)]' : ''}
                >
                  <Unlock className="w-4 h-4" />
                  Decriptar
                </Button>

                {/* Date Input for D.P.L.P Mode */}
                {mode === CipherMode.DPLP && isEncoding && (
                  <div className="flex items-center gap-2 ml-2 pl-4 border-l border-slate-700">
                     <Calendar className="w-4 h-4 text-cyan-500" />
                     <input 
                      type="text"
                      value={dateString}
                      onChange={(e) => setDateString(e.target.value)}
                      placeholder="DD/MM/AAAA"
                      className="w-28 bg-slate-900 border border-slate-700 text-cyan-400 px-2 py-1 font-orbitron text-sm focus:border-cyan-500 outline-none"
                      title="Inserir Data"
                     />
                  </div>
                )}
              </div>
              <button 
                  onClick={() => setInputText('')}
                  className="text-slate-600 hover:text-cyan-400 transition-colors p-2"
                  title="Limpar Buffer"
              >
                  <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Área de Input */}
          <div className="flex flex-col gap-2 relative">
            <label className="text-xs font-orbitron text-cyan-600 uppercase tracking-widest pl-2 border-l-2 border-cyan-600 mb-1">
              {isEncoding ? 'Entrada de Dados (Plaintext)' : 'Sequência Codificada (Ciphertext)'}
            </label>
            <div className="relative">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="cyber-input w-full h-32 rounded-none border-l-2 border-r-2 border-t-0 border-b-0 p-4 font-mono text-base bg-slate-900/60 text-slate-200 focus:border-cyan-500"
                placeholder={isEncoding ? "Inserir mensagem confidencial..." : "Inserir coordenadas..."}
                style={{ borderImage: "linear-gradient(to bottom, rgba(34,211,238,0.5), transparent) 1 100%" }}
              />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-500/50"></div>
              <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-500/50"></div>
            </div>
          </div>

          <div className="flex justify-center -my-2 z-10 opacity-50">
            <ArrowRight className="text-cyan-500 w-6 h-6 rotate-90" />
          </div>

          {/* Área de Saída */}
          <div className="flex flex-col gap-2 flex-grow">
            <div className="flex justify-between items-end mb-1">
              <label className="text-xs font-orbitron text-emerald-500 uppercase tracking-widest pl-2 border-l-2 border-emerald-500">
                Saída do Sistema
              </label>
              {result && !result.success && isEncoding && (
                <span className="text-red-500 font-mono text-xs animate-pulse bg-red-950/30 px-2 py-1 border border-red-900">
                   [ALERTA: PERDA DE PACOTES - PALAVRAS AUSENTES]
                </span>
              )}
            </div>
            
            <div className={`cyber-input relative w-full flex-grow min-h-[250px] p-6 font-mono text-lg break-words overflow-y-auto border-2
              ${isEncoding 
                ? 'bg-slate-950/80 text-emerald-400 border-emerald-500/20 shadow-[inset_0_0_20px_rgba(16,185,129,0.05)]' 
                : 'bg-slate-950/80 text-cyan-400 border-cyan-500/20 shadow-[inset_0_0_20px_rgba(6,182,212,0.05)]'
              }`}
              style={{ 
                clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%)" 
              }}
            >
              {!result || !result.text ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-700 gap-3">
                  <div className="w-16 h-16 border border-slate-800 rounded-full flex items-center justify-center relative">
                     <div className="absolute w-full h-full border-t-2 border-slate-700 rounded-full animate-spin"></div>
                     <FileText className="w-6 h-6 opacity-30" />
                  </div>
                  <span className="text-xs font-orbitron tracking-widest opacity-50">Aguardando Processamento...</span>
                </div>
              ) : (
                <>
                  <div className="relative z-10">{result.text}</div>
                  
                  {result.missingTokens && result.missingTokens.length > 0 && (
                     <div className="mt-8 pt-4 border-t border-dashed border-slate-800 text-xs text-slate-500">
                        <p className="font-orbitron text-red-400 mb-2 uppercase tracking-wider">Falha na encriptação dos segmentos:</p>
                        <div className="flex flex-wrap gap-2">
                          {result.missingTokens.map((t, i) => (
                            <span key={i} className="px-2 py-1 bg-red-950/20 text-red-400 border border-red-900/50 font-mono">{t}</span>
                          ))}
                        </div>
                     </div>
                  )}
                </>
              )}
              
              {/* Botão Copiar */}
              {result?.text && (
                 <button 
                  onClick={() => navigator.clipboard.writeText(result.text)}
                  className="absolute top-4 right-4 p-2 bg-slate-900 border border-slate-700 hover:border-emerald-500 hover:text-emerald-400 text-slate-500 transition-all group z-20"
                  title="Copiar para área de transferência"
                 >
                   <FileText className="w-4 h-4 group-hover:scale-110 transition-transform" />
                 </button>
              )}
            </div>
          </div>
        </section>
      </main>
      
      {/* Rodapé Decorativo */}
      <footer className="w-full text-center py-6 mt-8 text-slate-700 text-xs font-orbitron tracking-widest border-t border-slate-900">
        SYSTEM SECURE /// ENCRYPTED CONNECTION ESTABLISHED
      </footer>
    </div>
  );
};

export default App;