import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { marked } from 'marked';
import { streamChat, loadKnowledgeBase, loadChats, saveChats } from '../utils/api';
import { buildSystemPrompt, friendlyError } from '../utils/systemPrompt';
import SettingsModal from '../components/SettingsModal';
import Toast from '../components/Toast';
import { useToast } from '../hooks/useToast';

marked.setOptions({ breaks: true, gfm: true });

const SUGGESTIONS = [
  'O que é usucapião?',
  'Explique o habeas corpus',
  'Diferença entre dolo e culpa',
  'Redija um contrato de prestação de serviços',
  'O que é liquidação de sentença?',
];

export default function Chat() {
  const navigate = useNavigate();
  const { toast, showToast } = useToast();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [model, setModel] = useState(() => localStorage.getItem('aurora_model') || 'openrouter/free');
  const [additionalContext, setAdditionalContext] = useState(() => localStorage.getItem('aurora_knowledge') || '');
  const [knowledgeBase, setKnowledgeBase] = useState(null);

  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [savingChats, setSavingChats] = useState(false);

  const msgsRef = useRef(null);
  const inputRef = useRef(null);
  const historyRef = useRef([]); // track history for streaming retries

  const activeChat = chats.find((chat) => chat.id === activeChatId) ?? null;

  const createChatId = () => crypto?.randomUUID?.() || `chat-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  function createChatTitleFromMessage(text) {
    if (!text) return 'Nova conversa';
    let s = text.toLowerCase().trim();
    s = s.replace(/^(me\s+)?(por\s+favor\s+)?/i, '');
    s = s.replace(/^(me\s+)?(explique|explique-me|defina|resuma)\s*/i, '');
    s = s.replace(/o que (?:é|e|são|sao)\s*/i, '');
    s = s.replace(/[?!.]+$/g, '').replace(/[?!.]/g, '');
    const words = s.split(/\s+/).filter(Boolean);
    const titleCore = words.slice(0, 5).join(' ');
    const cap = titleCore.replace(/\b\w/g, (c) => c.toUpperCase());
    if (/\b(explique|defina|resuma)\b/i.test(text) || /o que (?:é|e|são|sao)/i.test(text)) {
      return 'Explicação de ' + cap;
    }
    return cap || 'Nova conversa';
  }

  useEffect(() => {
    loadChats()
      .then((data) => {
        const loaded = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
        const normalized = loaded.map((chat) => ({
          id: chat.id || createChatId(),
          name: chat.name || 'Nova conversa',
          messages: Array.isArray(chat.messages) ? chat.messages : [],
        }));
        setChats(normalized);
        // leave `activeChatId` null so the page opens in initial (no-chat) state
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (activeChat) {
      setMessages(activeChat.messages);
      historyRef.current = activeChat.messages || [];
    } else {
      setMessages([]);
      historyRef.current = [];
    }
  }, [activeChatId]);

  const persistChats = async (updatedChats) => {
    setChats(updatedChats);
    setSavingChats(true);
    try {
      await saveChats(updatedChats);
    } catch (err) {
      console.error('Falha ao salvar chats:', err);
      showToast('Não foi possível salvar chats');
    } finally {
      setSavingChats(false);
    }
  };

  const handleNewChat = async () => {
    const id = createChatId();
    const chat = { id, name: 'Nova conversa', messages: [] };
    const updated = [chat, ...chats];
    setActiveChatId(id);
    await persistChats(updated);
    setSidebarOpen(false);
  };

  const handleSelectChat = (id) => {
    setActiveChatId(id);
    setSidebarOpen(false);
  };

  const handleDeleteChat = async (id) => {
    const updated = chats.filter((chat) => chat.id !== id);
    setChats(updated);
    if (id === activeChatId) {
      setActiveChatId(updated[0]?.id ?? null);
    }
    await persistChats(updated);
  };

  const handleStartRename = (chat) => {
    setRenamingId(chat.id);
    setRenameValue(chat.name);
  };

  const handleSaveRename = async (id) => {
    const name = renameValue.trim() || 'Sem título';
    const updated = chats.map((chat) => (chat.id === id ? { ...chat, name } : chat));
    setRenamingId(null);
    await persistChats(updated);
  };

  const handleRenameKeyDown = (e, id) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveRename(id);
    }
  };

  const updateActiveChatMessages = async (newMessages) => {
    if (!activeChatId) return;
    const updated = chats.map((chat) => (chat.id === activeChatId ? { ...chat, messages: newMessages } : chat));
    await persistChats(updated);
  };

  /* ── Load knowledge base ── */
  useEffect(() => {
    loadKnowledgeBase()
      .then(setKnowledgeBase)
      .catch(() => {});
  }, []);

  /* ── Auto-scroll ── */
  useEffect(() => {
    msgsRef.current?.scrollTo({ top: msgsRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  /* ── Badge label ── */
  const badgeLabel = model.split('/').pop().split(':')[0];

  /* ── Send message ── */
  const sendMessage = useCallback(
    async (text) => {
      text = text?.trim() || input.trim();
      if (!text || busy) return;

      setInput('');
      setBusy(true);

      let currentChatId = activeChatId;
      if (!currentChatId) {
        const id = createChatId();
        const newChat = { id, name: 'Nova conversa', messages: [] };
        const updatedChats = [newChat, ...chats];
        setChats(updatedChats);
        setActiveChatId(id);
        currentChatId = id;
        persistChats(updatedChats);
      }

      const userMsg = { id: Date.now(), role: 'user', content: text };
      const assistantPlaceholder = { id: Date.now() + 1, role: 'assistant', content: '', streaming: true };

      if (!currentChatId) {
        if (chats.length === 0) {
          const id = createChatId();
          const title = createChatTitleFromMessage(text);
          const newChat = { id, name: title, messages: [userMsg, assistantPlaceholder] };
          const updatedChats = [newChat, ...chats];
          setChats(updatedChats);
          setActiveChatId(id);
          currentChatId = id;
          historyRef.current = [userMsg];
          setMessages([userMsg, assistantPlaceholder]);
          persistChats(updatedChats);
        } else {
          // If there are existing chats but none selected, open the first one and append
          const first = chats[0];
          const id = first.id;
          setActiveChatId(id);
          currentChatId = id;
          const existing = Array.isArray(first.messages) ? first.messages : [];
          historyRef.current = [...existing, userMsg];
          const updatedChats = chats.map((c) => (c.id === id ? { ...c, messages: [...existing, userMsg, assistantPlaceholder] } : c));
          setChats(updatedChats);
          setMessages([...existing, userMsg, assistantPlaceholder]);
          persistChats(updatedChats);
        }
      } else {
        historyRef.current = [...historyRef.current, userMsg];
        setMessages((prev) => [
          ...prev,
          userMsg,
          assistantPlaceholder,
        ]);
      }

      const systemContent = buildSystemPrompt(knowledgeBase, additionalContext);
      const msgsCopy = historyRef.current.slice();

      let full = '';
      let attempts = 0;
      const MAX = 2;

      async function tryOnce() {
        attempts++;
        try {
          if (attempts > 1) await new Promise((r) => setTimeout(r, 1800));
          for await (const delta of streamChat(msgsCopy, systemContent, model)) {
            full += delta;
            const snapshot = full;
            setMessages((prev) => {
              const next = [...prev];
              next[next.length - 1] = {
                ...next[next.length - 1],
                content: snapshot,
                streaming: true,
              };
              return next;
            });
          }
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { ...next[next.length - 1], content: full, streaming: false };
            return next;
          });
          historyRef.current = [...historyRef.current, { role: 'assistant', content: full }];
          await updateActiveChatMessages(historyRef.current);
        } catch (err) {
          console.error('[AURORA] tentativa ' + attempts, err);
          if (attempts < MAX && err.status !== 401 && err.status !== 400) {
            return tryOnce();
          }
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = {
              ...next[next.length - 1],
              content: '',
              error: friendlyError(err.message, err.status),
              streaming: false,
            };
            return next;
          });
          historyRef.current.pop();
        }
      }

      await tryOnce();
      setBusy(false);
      inputRef.current?.focus();
    },
    [input, busy, model, knowledgeBase, additionalContext, activeChatId, chats]
  );

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleClear() {
    setMessages([]);
    historyRef.current = [];
    if (activeChatId) updateActiveChatMessages([]);
    inputRef.current?.focus();
  }

  function handleTextareaInput(e) {
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 130) + 'px';
    setInput(el.value);
  }

  return (
    <div className="chat-shell">
      <aside className={`chat-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-title">Conversas</div>
          <button className="sidebar-btn" onClick={handleNewChat}>
            + Novo chat
          </button>
        </div>
        <div className="chat-list">
          {chats.length === 0 ? (
            <div className="chat-empty">Nenhum chat salvo. Crie um novo chat.</div>
          ) : (
            chats.map((chat) => (
              <div key={chat.id} className={`chat-item ${chat.id === activeChatId ? 'active' : ''}`}>
                {renamingId === chat.id ? (
                  <input
                    className="chat-sidebar-input"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => handleRenameKeyDown(e, chat.id)}
                    onBlur={() => handleSaveRename(chat.id)}
                    autoFocus
                  />
                ) : (
                  <button className="chat-item-main" onClick={() => handleSelectChat(chat.id)}>
                    {chat.name}
                  </button>
                )}
                <div className="chat-item-actions">
                  <button className="chat-item-action" onClick={() => handleStartRename(chat)} title="Renomear chat">
                    ✎
                  </button>
                  <button className="chat-item-action" onClick={() => handleDeleteChat(chat.id)} title="Excluir chat">
                    🗑
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        <button className="sidebar-close" onClick={() => setSidebarOpen(false)}>
          Fechar
        </button>
      </aside>
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}
      <div className="chat-content">
      {/* ── Header ── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px', background: 'var(--s1)',
        borderBottom: '1px solid var(--bdr)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(true)} title="Abrir menu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div style={{ lineHeight: 1.1 }}>
            <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '.1em', color: 'var(--acc)' }}>AURORA</div>
            <div style={{ fontSize: 10, fontWeight: 400, color: 'var(--muted)', letterSpacing: '.05em', textTransform: 'uppercase', marginTop: 1 }}>
              Assistente Jurídica
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, maxWidth: 240, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activeChat?.name || 'Nenhuma conversa selecionada'}
            </div>
          </div>
          <span style={{
            fontSize: 11, color: 'var(--muted)', background: 'var(--s2)',
            padding: '3px 10px', borderRadius: 'var(--r-pill)',
            border: '1px solid var(--bdr)', maxWidth: 170,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {badgeLabel}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <IconBtn title="Gerenciar Base de Conhecimento" onClick={() => navigate('/knowledge-manager')}>
            <svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          </IconBtn>
          <IconBtn title="Limpar conversa" onClick={handleClear}>
            <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </IconBtn>
          <IconBtn title="Configurações" onClick={() => setSettingsOpen(true)}>
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </IconBtn>
        </div>
      </header>

      {/* ── Messages ── */}
      <main ref={msgsRef} style={{
        flex: 1, overflowY: 'auto', padding: '26px 20px',
        display: 'flex', flexDirection: 'column', gap: 20,
        scrollbarWidth: 'thin', scrollbarColor: 'var(--s3) transparent',
      }}>
        {messages.length === 0 ? (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 10, color: 'var(--muted)', textAlign: 'center', padding: 40,
          }}>
            <div style={{ fontSize: 28, opacity: .3, marginBottom: 2 }}>⚖︎</div>
            <div style={{ fontSize: 20, fontWeight: 500, color: 'var(--text)', opacity: .5, letterSpacing: '-.01em' }}>
              Olá, Aline! 👋
            </div>
            <div style={{ fontSize: 13, maxWidth: 270, lineHeight: 1.55 }}>
              Sou a AURORA, sua assistente jurídica. Pergunte sobre qualquer tema do Direito.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center', marginTop: 14 }}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  style={{
                    fontSize: 12.5, fontFamily: 'var(--font)', color: 'var(--acc)',
                    background: 'var(--acc-dim)', border: '1px solid rgba(212,166,74,.22)',
                    padding: '6px 13px', borderRadius: 'var(--r-pill)', cursor: 'pointer',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageRow key={msg.id} msg={msg} />
          ))
        )}
      </main>

      {/* ── Input ── */}
      <footer style={{
        padding: '14px 20px 18px',
        borderTop: '1px solid var(--bdr)', background: 'var(--s1)', flexShrink: 0,
      }}>
        <div style={{
          display: 'flex', gap: 10, alignItems: 'flex-end',
          background: 'var(--s2)', border: '1px solid var(--bdr)',
          borderRadius: 'var(--r-pill)', padding: '10px 10px 10px 18px',
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onInput={handleTextareaInput}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={busy ? 'Aguardando AURORA…' : 'Faça uma pergunta…'}
            disabled={busy}
            rows={1}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--text)', fontFamily: 'var(--font)', fontSize: 14.5,
              lineHeight: 1.5, resize: 'none', minHeight: 24, maxHeight: 130,
              height: 24, overflowY: 'auto', scrollbarWidth: 'none',
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={busy || !input.trim()}
            style={{
              width: 36, height: 36, minWidth: 36, borderRadius: 'var(--r-pill)',
              background: busy || !input.trim() ? 'var(--s3)' : 'var(--acc)',
              border: 'none', cursor: busy || !input.trim() ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: busy || !input.trim() ? 'var(--subtle)' : '#0c0b09',
              transition: 'all .15s', flexShrink: 0,
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5"/>
              <polyline points="5 12 12 5 19 12"/>
            </svg>
          </button>
        </div>
      </footer>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        model={model} setModel={setModel}
        additionalContext={additionalContext} setAdditionalContext={setAdditionalContext}
        knowledgeBase={knowledgeBase}
      />
      <Toast toast={toast} />
      </div>
    </div>
  );
}

function IconBtn({ children, onClick, title }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: 33, height: 33, border: '1px solid var(--bdr)',
        borderRadius: 'var(--r-lg)', background: 'transparent', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--muted)', transition: 'all .15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--s2)'; e.currentTarget.style.color = 'var(--text)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted)'; }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  );
}

function MessageRow({ msg }) {
  const isUser = msg.role === 'user';

  if (msg.error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
        <div style={{ fontSize: 10, color: 'var(--muted)', padding: '0 4px', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 600 }}>aurora</div>
        <div style={{
          maxWidth: 'min(78%, 620px)', background: 'rgba(212,106,106,.09)',
          border: '1px solid rgba(212,106,106,.2)', borderRadius: 'var(--r-xl)',
          borderBottomLeftRadius: 'var(--r)', padding: '11px 16px',
          fontSize: 13.5, color: '#e08888', lineHeight: 1.6,
        }}>
          <strong>Não consegui responder.</strong>
          <br /><br />
          {msg.error.split('\n').map((l, i) => <span key={i}>{l}<br /></span>)}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 4,
      alignItems: isUser ? 'flex-end' : 'flex-start',
      animation: 'msgUp .2s ease',
    }}>
      <div style={{ fontSize: 10, color: 'var(--muted)', padding: '0 4px', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 600 }}>
        {isUser ? 'você' : 'aurora'}
      </div>
      <div style={{
        maxWidth: 'min(78%, 620px)', padding: '11px 16px',
        borderRadius: 'var(--r-xl)', lineHeight: 1.7, fontSize: 14.5, wordBreak: 'break-word',
        ...(isUser
          ? { background: 'var(--acc-dim)', border: '1px solid rgba(212,166,74,.22)', borderBottomRightRadius: 'var(--r)', whiteSpace: 'pre-wrap' }
          : { background: 'var(--s1)', border: '1px solid var(--bdr)', borderBottomLeftRadius: 'var(--r)' }),
      }}>
        {isUser ? (
          msg.content
        ) : (
          <>
            <div
              className="md-content"
              dangerouslySetInnerHTML={{ __html: msg.content ? marked.parse(msg.content) : '' }}
            />
            {msg.streaming && (
              <span style={{
                display: 'inline-block', width: 2, height: '1em',
                background: 'var(--acc)', marginLeft: 2, verticalAlign: 'text-bottom',
                animation: 'blink .7s infinite',
              }} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
