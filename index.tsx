import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';

// Assume process.env.API_KEY is available in the environment
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Utility to simulate navigation in an iframe
const navigateTo = (url: string) => {
  const iframe = document.getElementById('content-frame') as HTMLIFrameElement;
  if (iframe) {
    iframe.src = url;
  }
};

const App: React.FC = () => {
  const [currentUrl, setCurrentUrl] = useState<string>('volt://newtab');
  const [inputUrl, setInputUrl] = useState<string>('');
  const [aiChatVisible, setAiChatVisible] = useState<boolean>(false);
  const [aiInput, setAiInput] = useState<string>('');
  const [aiMessages, setAiMessages] = useState<{ sender: string; text: string }[]>([]);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [showDownloadPrompt, setShowDownloadPrompt] = useState<boolean>(false);
  const [downloadingVideo, setDownloadingVideo] = useState<boolean>(false);
  const aiChatHistoryRef = useRef<HTMLDivElement>(null);
  const chatInstanceRef = useRef<any>(null); // To store the chat instance
  const iframeRef = useRef<HTMLIFrameElement>(null); // Reference to the iframe

  useEffect(() => {
    // Scroll to the bottom of the chat history when new messages arrive
    if (aiChatHistoryRef.current) {
      aiChatHistoryRef.current.scrollTop = aiChatHistoryRef.current.scrollHeight;
    }
  }, [aiMessages]);

  const handleUrlSubmit = (e: React.FormEvent, urlOverride?: string) => {
    e.preventDefault();
    
    const targetUrl = urlOverride || inputUrl;

    if (targetUrl.trim() === '') return;

    let url = targetUrl;
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('volt://')) {
      // Treat as search query if not a URL
      url = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
    }

    setCurrentUrl(url);
    if (iframeRef.current) {
      iframeRef.current.src = url; // Directly set iframe src
    }
    setInputUrl(url); // Update input field to reflect the navigated URL

    // Simulate video detection for download
    if (url.includes('youtube.com/watch') || url.includes('.mp4') || url.includes('.mov')) {
      setShowDownloadPrompt(true);
    } else {
      setShowDownloadPrompt(false);
    }
  };

  const handleAiChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (aiInput.trim() === '') return;

    const userMessage = aiInput;
    setAiMessages((prev) => [...prev, { sender: 'Você', text: userMessage }]);
    setAiInput('');
    setIsTyping(true);

    try {
      // Initialize chat if not already, or use existing one
      if (!chatInstanceRef.current) {
        chatInstanceRef.current = ai.chats.create({
          model: 'gemini-3-flash-preview',
          config: {
            systemInstruction: `Você é um assistente de IA integrado ao VoltBrowser. Ajude os usuários com informações sobre a web e o navegador. Você pode:
            - Responder perguntas gerais.
            - "Resumir esta página" (se o usuário pedir, diga que você pode simular o resumo da página atual, que é: "O VoltBrowser é um navegador super rápido com IA e downloads de vídeo.").
            - "Baixar este vídeo" (se o usuário pedir, diga que você pode simular o download do vídeo da página atual, que é uma função principal do VoltBrowser.).
            `,
          },
        });
      }

      const responseStream = await chatInstanceRef.current.sendMessageStream({ message: userMessage });
      let fullResponse = '';
      for await (const chunk of responseStream) {
        const textChunk = (chunk as GenerateContentResponse).text;
        if (textChunk) {
          fullResponse += textChunk;
          // Update message in real-time if desired, or just build up fullResponse
        }
      }

      // Handle specific commands
      if (userMessage.toLowerCase().includes('resumir esta página')) {
        fullResponse = "O VoltBrowser é um navegador super rápido com IA e downloads de vídeo.";
      } else if (userMessage.toLowerCase().includes('baixar este vídeo')) {
        fullResponse = "Simulando o download do vídeo da página atual. É uma função principal do VoltBrowser!";
        handleDownloadVideo(); // Trigger the download simulation
      }

      setAiMessages((prev) => [...prev, { sender: 'Volt AI', text: fullResponse.trim() }]);
    } catch (error: any) {
      console.error('Erro ao interagir com a IA:', error);
      // If the error message indicates a key issue, prompt user to select a new key
      if (error.message && error.message.includes("Requested entity was not found.")) {
        // This simulates the check and prompt from Veo API Key Selection guidelines
        if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
          await window.aistudio.openSelectKey();
          setAiMessages((prev) => [...prev, { sender: 'Volt AI', text: 'Houve um problema com a chave da API. Por favor, selecione sua chave novamente.' }]);
        } else {
          setAiMessages((prev) => [...prev, { sender: 'Volt AI', text: 'Desculpe, não consegui processar sua solicitação devido a um erro na API. Tente novamente mais tarde.' }]);
        }
      } else {
        setAiMessages((prev) => [...prev, { sender: 'Volt AI', text: 'Desculpe, não consegui processar sua solicitação. Tente novamente.' }]);
      }
    } finally {
      setIsTyping(false);
    }
  };

  const handleDownloadVideo = () => {
    setDownloadingVideo(true);
    // Simulate download time
    setTimeout(() => {
      setDownloadingVideo(false);
      alert('Vídeo baixado com sucesso! (Simulado)');
      setShowDownloadPrompt(false); // Hide prompt after simulated download
    }, 3000);
  };

  const goBack = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.history.back();
    }
  };

  const goForward = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.history.forward();
    }
  };

  const refreshPage = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.location.reload();
    }
  };

  const handleIframeLoad = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        // Attempt to get the iframe's actual URL
        const iframeLocation = iframeRef.current.contentWindow.location.href;
        if (iframeLocation !== currentUrl) {
          setCurrentUrl(iframeLocation);
          setInputUrl(iframeLocation);
          // Also re-evaluate video download prompt based on the new URL
          if (iframeLocation.includes('youtube.com/watch') || iframeLocation.includes('.mp4') || iframeLocation.includes('.mov')) {
            setShowDownloadPrompt(true);
          } else {
            setShowDownloadPrompt(false);
          }
        }
      } catch (e) {
        // This error is expected for cross-origin iframes due to security restrictions
        // We cannot read contentWindow.location.href directly.
        console.warn("Could not access iframe location due to same-origin policy. URL in address bar might not reflect internal navigation.", e);
        // In this case, currentUrl and inputUrl will remain what was initially navigated to.
        // A real browser would have more complex ways to track the actual URL.
      }
    }
  };

  return (
    <div style={styles.appContainer}>
      {/* Top Bar (Tabs) */}
      <div style={styles.topBar}>
        <div style={styles.tab}>
          <span style={styles.tabIcon}>⚡</span> Nova Aba
        </div>
        <div style={styles.newTabButton}>+</div>
      </div>

      {/* Header (Address Bar & Controls) */}
      <div style={styles.header}>
        <div style={styles.navButtons}>
          <button style={styles.navButton} onClick={goBack} aria-label="Voltar">←</button>
          <button style={styles.navButton} onClick={goForward} aria-label="Avançar">→</button>
          <button style={styles.navButton} onClick={refreshPage} aria-label="Recarregar">↻</button>
        </div>
        <form onSubmit={handleUrlSubmit} style={styles.addressBarContainer}>
          <span style={styles.securityIcon}>🛡️</span>
          <input
            type="text"
            style={styles.addressBarInput}
            value={inputUrl === '' ? currentUrl : inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            onFocus={() => { if (inputUrl === 'volt://newtab') setInputUrl(''); }}
            onBlur={() => { if (inputUrl === '') setInputUrl('volt://newtab'); }}
            placeholder="Pesquisar na web ou digitar URL..."
            aria-label="Barra de endereço"
          />
          <button type="submit" style={styles.addressBarSearchIcon} aria-label="Pesquisar">🔍</button>
        </form>
        <div style={styles.headerIcons}>
          <button style={styles.headerIconButton} onClick={() => setAiChatVisible(!aiChatVisible)} aria-label="Abrir assistente de IA">
            <span style={{ color: aiChatVisible ? '#00e676' : '#90caf9' }}>⚡</span>
          </button>
          <button style={styles.headerIconButton} aria-label="Adicionar aos favoritos">⭐</button>
          <button style={styles.headerIconButton} onClick={handleDownloadVideo} disabled={!showDownloadPrompt || downloadingVideo} aria-label="Baixar vídeo">
            {downloadingVideo ? '⏳' : '⬇️'}
          </button>
          <button style={styles.headerIconButton} aria-label="Configurações">⚙️</button>
          <button style={styles.headerIconButton} aria-label="Mais opções">⋮</button>
        </div>
      </div>

      {/* Main Content Area */}
      {currentUrl === 'volt://newtab' ? (
        <div style={styles.homeScreen}>
          <img src="https://example.com/voltbrowser-logo.png" alt="VoltBrowser Logo" style={styles.logo} /> {/* Placeholder image */}
          <h1 style={styles.appName}>VoltBrowser</h1>
          <p style={styles.tagline}>VELOCIDADE MÁXIMA</p>

          <form onSubmit={handleUrlSubmit} style={styles.searchBoxForm}>
            <input
              type="text"
              style={styles.mainSearchInput}
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="Pesquisar na web ou digitar URL. TURBO"
              aria-label="Pesquisa principal"
            />
            <span style={styles.turboLabel}>TURBO</span>
          </form>

          <div style={styles.quickAccessGrid}>
            {['Google', 'YouTube', 'GitHub', 'Twitter', 'Reddit', 'Wikipedia', 'Stack Overflow', 'LinkedIn'].map((site) => (
              <div key={site} style={styles.quickAccessItem} onClick={(e) => {
                const targetUrl = `https://www.${site.toLowerCase().replace(' ', '')}.com`;
                // Now passing the targetUrl directly to handleUrlSubmit
                handleUrlSubmit(e, targetUrl);
              }} aria-label={`Acesso rápido a ${site}`}>
                <img src={`https://www.google.com/s2/favicons?domain=${site.toLowerCase().replace(' ', '')}.com&sz=64`} alt={`${site} icon`} style={styles.quickAccessIcon} />
                <span style={styles.quickAccessText}>{site}</span>
              </div>
            ))}
          </div>

          <div style={styles.statsGrid}>
            <div style={styles.statCard} aria-label="Páginas carregadas">
              <span style={styles.statIcon}>🌐</span>
              <p style={styles.statValue}>2,847</p>
              <p style={styles.statLabel}>Páginas carregadas</p>
            </div>
            <div style={styles.statCard} aria-label="Tempo economizado">
              <span style={styles.statIcon}>🕒</span>
              <p style={styles.statValue}>4.2h</p>
              <p style={styles.statLabel}>Tempo economizado</p>
            </div>
            <div style={styles.statCard} aria-label="Rastreadores bloqueados">
              <span style={styles.statIcon}>🛡️</span>
              <p style={styles.statValue}>12,394</p>
              <p style={styles.statLabel}>Rastreadores bloqueados</p>
            </div>
            <div style={styles.statCard} aria-label="Velocidade média">
              <span style={styles.statIcon}>📈</span>
              <p style={styles.statValue}>48ms</p>
              <p style={styles.statLabel}>Velocidade média</p>
            </div>
          </div>
        </div>
      ) : (
        <iframe
          ref={iframeRef}
          id="content-frame"
          src={currentUrl}
          style={styles.contentFrame}
          title="Browser Content"
          onLoad={handleIframeLoad}
          sandbox="allow-scripts allow-forms allow-popups allow-pointer-lock allow-same-origin allow-modals allow-presentation"
        />
      )}

      {/* AI Chat Interface */}
      {aiChatVisible && (
        <div style={styles.aiChatOverlay} role="dialog" aria-labelledby="aiChatHeader">
          <div style={styles.aiChatHeader} id="aiChatHeader">
            <span>Volt AI Assistant</span>
            <button style={styles.aiChatCloseButton} onClick={() => setAiChatVisible(false)} aria-label="Fechar assistente de IA">
              ✖
            </button>
          </div>
          <div style={styles.aiChatHistory} ref={aiChatHistoryRef} aria-live="polite" aria-atomic="true">
            {aiMessages.map((msg, index) => (
              <div key={index} style={msg.sender === 'Você' ? styles.aiChatMessageUser : styles.aiChatMessageAI}>
                <strong>{msg.sender}:</strong> {msg.text}
              </div>
            ))}
            {isTyping && (
              <div style={styles.aiChatMessageAI}>
                <strong>Volt AI:</strong> digitando...
              </div>
            )}
          </div>
          <form onSubmit={handleAiChatSubmit} style={styles.aiChatInputContainer}>
            <input
              type="text"
              style={styles.aiChatInput}
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder="Pergunte algo à IA..."
              disabled={isTyping}
              aria-label="Entrada de texto para assistente de IA"
            />
            <button type="submit" style={styles.aiChatSendButton} disabled={isTyping} aria-label="Enviar mensagem para IA">
              Enviar
            </button>
          </form>
        </div>
      )}

      {/* Download Progress/Prompt */}
      {showDownloadPrompt && !downloadingVideo && currentUrl !== 'volt://newtab' && (currentUrl.includes('youtube.com/watch') || currentUrl.includes('.mp4') || currentUrl.includes('.mov')) && (
        <div style={styles.downloadPrompt} role="alert">
          <span>Vídeo detectado! Deseja baixar?</span>
          <button style={styles.downloadPromptButton} onClick={handleDownloadVideo} aria-label="Baixar vídeo agora">Baixar</button>
          <button style={styles.downloadPromptButton} onClick={() => setShowDownloadPrompt(false)} aria-label="Ignorar download">Ignorar</button>
        </div>
      )}
      {downloadingVideo && (
        <div style={styles.downloadingOverlay} role="status" aria-live="assertive">
          <span>Baixando vídeo...</span>
        </div>
      )}
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  appContainer: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: '#0b0d10',
    color: '#e0e0e0',
  },
  topBar: {
    display: 'flex',
    backgroundColor: '#1a1c20',
    padding: '8px',
    borderBottom: '1px solid #2a2d33',
    boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
  },
  tab: {
    backgroundColor: '#0b0d10',
    color: '#e0e0e0',
    padding: '8px 15px',
    borderRadius: '8px 8px 0 0',
    display: 'flex',
    alignItems: 'center',
    marginRight: '5px',
    fontSize: '0.9em',
    border: '1px solid #2a2d33',
    borderBottom: 'none',
  },
  tabIcon: {
    marginRight: '5px',
  },
  newTabButton: {
    backgroundColor: '#2a2d33',
    color: '#e0e0e0',
    padding: '8px 15px',
    borderRadius: '8px',
    marginLeft: '5px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 15px',
    backgroundColor: '#1a1c20',
    borderBottom: '1px solid #2a2d33',
  },
  navButtons: {
    display: 'flex',
    marginRight: '10px',
  },
  navButton: {
    background: 'none',
    border: 'none',
    color: '#e0e0e0',
    fontSize: '1.2em',
    margin: '0 5px',
    cursor: 'pointer',
    padding: '5px 8px',
    borderRadius: '5px',
    transition: 'background-color 0.2s',
  },
  addressBarContainer: {
    flexGrow: 1,
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#2a2d33',
    borderRadius: '25px',
    padding: '5px 15px',
    margin: '0 10px',
  },
  securityIcon: {
    marginRight: '8px',
    color: '#4caf50', // Green shield
  },
  addressBarInput: {
    flexGrow: 1,
    background: 'none',
    border: 'none',
    color: '#e0e0e0',
    fontSize: '1em',
    outline: 'none',
  },
  addressBarSearchIcon: {
    background: 'none',
    border: 'none',
    color: '#e0e0e0',
    marginLeft: '8px',
    cursor: 'pointer',
  },
  headerIcons: {
    display: 'flex',
    marginLeft: '10px',
  },
  headerIconButton: {
    background: 'none',
    border: 'none',
    color: '#e0e0e0',
    fontSize: '1.2em',
    margin: '0 5px',
    cursor: 'pointer',
    padding: '5px',
    borderRadius: '5px',
    transition: 'background-color 0.2s',
  },
  homeScreen: {
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '20px',
    overflowY: 'auto', // Allow scrolling for home content
  },
  logo: {
    width: '100px',
    height: '100px',
    marginTop: '30px',
    marginBottom: '10px',
  },
  appName: {
    fontSize: '2.5em',
    fontWeight: 'bold',
    color: '#e0e0e0',
    margin: '0',
  },
  tagline: {
    fontSize: '0.9em',
    color: '#90caf9', // Light blue for accent
    marginBottom: '30px',
    textTransform: 'uppercase',
  },
  searchBoxForm: {
    position: 'relative',
    width: '90%',
    maxWidth: '500px',
    marginBottom: '40px',
  },
  mainSearchInput: {
    width: '100%',
    padding: '15px 20px',
    paddingRight: '80px', // Make space for TURBO label
    borderRadius: '30px',
    border: 'none',
    backgroundColor: '#2a2d33',
    color: '#e0e0e0',
    fontSize: '1em',
    outline: 'none',
    boxSizing: 'border-box',
  },
  turboLabel: {
    position: 'absolute',
    right: '20px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#00e676', // Green for TURBO
    fontSize: '0.8em',
    fontWeight: 'bold',
  },
  quickAccessGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '15px',
    width: '90%',
    maxWidth: '600px',
    marginBottom: '40px',
  },
  quickAccessItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1c20',
    borderRadius: '15px',
    padding: '15px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  quickAccessIcon: {
    width: '40px',
    height: '40px',
    marginBottom: '10px',
  },
  quickAccessText: {
    fontSize: '0.8em',
    color: '#e0e0e0',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '20px',
    width: '90%',
    maxWidth: '600px',
    marginBottom: '30px',
  },
  statCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: '#1a1c20',
    borderRadius: '15px',
    padding: '20px',
    textAlign: 'center',
  },
  statIcon: {
    fontSize: '2em',
    color: '#90caf9', // Light blue accent
    marginBottom: '10px',
  },
  statValue: {
    fontSize: '1.8em',
    fontWeight: 'bold',
    color: '#e0e0e0',
    margin: '0',
  },
  statLabel: {
    fontSize: '0.8em',
    color: '#b0b0b0',
    margin: '0',
  },
  contentFrame: {
    flexGrow: 1,
    width: '100%',
    height: '100%',
    border: 'none',
    backgroundColor: '#fff', // Default for iframe content
  },
  aiChatOverlay: {
    position: 'fixed',
    top: '0',
    right: '0',
    width: '350px',
    height: '100vh',
    backgroundColor: '#1a1c20',
    borderLeft: '1px solid #2a2d33',
    boxShadow: '-5px 0 15px rgba(0,0,0,0.3)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 1000,
  },
  aiChatHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '15px',
    borderBottom: '1px solid #2a2d33',
    color: '#e0e0e0',
    fontWeight: 'bold',
  },
  aiChatCloseButton: {
    background: 'none',
    border: 'none',
    color: '#e0e0e0',
    fontSize: '1.2em',
    cursor: 'pointer',
  },
  aiChatHistory: {
    flexGrow: 1,
    padding: '15px',
    overflowY: 'auto',
    backgroundColor: '#0b0d10',
  },
  aiChatMessageUser: {
    backgroundColor: '#3a3d45',
    borderRadius: '10px',
    padding: '10px',
    marginBottom: '10px',
    alignSelf: 'flex-end',
    color: '#e0e0e0',
  },
  aiChatMessageAI: {
    backgroundColor: '#2a2d33',
    borderRadius: '10px',
    padding: '10px',
    marginBottom: '10px',
    alignSelf: 'flex-start',
    color: '#e0e0e0',
  },
  aiChatInputContainer: {
    display: 'flex',
    padding: '15px',
    borderTop: '1px solid #2a2d33',
  },
  aiChatInput: {
    flexGrow: 1,
    padding: '10px',
    borderRadius: '20px',
    border: '1px solid #3a3d45',
    backgroundColor: '#0b0d10',
    color: '#e0e0e0',
    outline: 'none',
    marginRight: '10px',
  },
  aiChatSendButton: {
    background: '#00e676',
    border: 'none',
    color: '#0b0d10',
    padding: '10px 15px',
    borderRadius: '20px',
    cursor: 'pointer',
    fontWeight: 'bold',
    transition: 'background-color 0.2s',
  },
  downloadPrompt: {
    position: 'fixed',
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: '#2a2d33',
    color: '#e0e0e0',
    padding: '15px 25px',
    borderRadius: '10px',
    boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    zIndex: 1001,
  },
  downloadPromptButton: {
    backgroundColor: '#00e676',
    color: '#0b0d10',
    border: 'none',
    padding: '8px 15px',
    borderRadius: '5px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  downloadingOverlay: {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    color: '#e0e0e0',
    fontSize: '1.5em',
    zIndex: 1002,
  }
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);