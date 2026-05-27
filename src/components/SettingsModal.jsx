import { useState, useEffect } from 'react';

const MODELS = [
  { value: 'openrouter/free', label: 'Auto — OpenRouter (melhor disponível) ★' },
  { value: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B — Meta' },
  { value: 'openai/gpt-oss-120b:free', label: 'GPT-OSS 120B — OpenAI (open-source)' },
  { value: 'openai/gpt-oss-20b:free', label: 'GPT-OSS 20B — OpenAI (rápido)' },
  { value: 'deepseek/deepseek-v4-flash:free', label: 'DeepSeek V4 Flash — 1M ctx' },
  { value: 'nvidia/nemotron-3-super-120b-a12b:free', label: 'Nemotron Super 120B — NVIDIA' },
  { value: 'qwen/qwen3-next-80b-a3b-instruct:free', label: 'Qwen3 Next 80B — Alibaba' },
  { value: 'google/gemma-4-31b-it:free', label: 'Gemma 4 31B — Google' },
  { value: 'z-ai/glm-4.5-air:free', label: 'GLM-4.5 Air — Z.ai' },
  { value: 'meta-llama/llama-3.2-3b-instruct:free', label: 'Llama 3.2 3B — (mais leve)' },
];

export default function SettingsModal({ open, onClose, model, setModel, additionalContext, setAdditionalContext, knowledgeBase }) {
  const [activeTab, setActiveTab] = useState('model');
  const [localModel, setLocalModel] = useState(model);
  const [localCtx, setLocalCtx] = useState(additionalContext);

  useEffect(() => {
    if (open) { setLocalModel(model); setLocalCtx(additionalContext); setActiveTab('model'); }
  }, [open]);

  function handleSave() {
    setModel(localModel);
    setAdditionalContext(localCtx);
    localStorage.setItem('aurora_model', localModel);
    localStorage.setItem('aurora_knowledge', localCtx);
    onClose();
  }

  function handleClearContext() {
    setLocalCtx('');
  }

  const kbCount = knowledgeBase
    ? ['instructions', 'preferences', 'student_profile', 'knowledge_base']
        .reduce((n, k) => n + (knowledgeBase[k]?.length || 0), 0)
    : 0;

  const hasContext = localCtx.trim().length > 0 || kbCount > 0;

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.72)',
        backdropFilter: 'blur(7px)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', zIndex: 100, padding: 20,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--s1)', border: '1px solid var(--bdr-h)',
        borderRadius: 'var(--r-xl)', width: '100%', maxWidth: 480,
        boxShadow: '0 20px 60px rgba(0,0,0,.5)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '22px 24px 0' }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 2 }}>Configurações</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 18 }}>
            Personalize o comportamento da AURORA.
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--bdr)', padding: '0 24px' }}>
          {['model', 'knowledge'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                fontSize: 13, fontFamily: 'var(--font)', fontWeight: 500,
                padding: '9px 12px', border: 'none', background: 'none', cursor: 'pointer',
                color: activeTab === tab ? 'var(--acc)' : 'var(--muted)',
                borderBottom: activeTab === tab ? '2px solid var(--acc)' : '2px solid transparent',
                marginBottom: -1, transition: 'all .15s',
              }}
            >
              {tab === 'model' ? 'Modelo' : 'Base de Conhecimento'}
            </button>
          ))}
        </div>

        {/* Tab: Modelo */}
        {activeTab === 'model' && (
          <div style={{ padding: '20px 24px' }}>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Modelo de IA (gratuito)</label>
              <select
                style={selectStyle}
                value={localModel}
                onChange={(e) => setLocalModel(e.target.value)}
              >
                {MODELS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                Modelos 100% gratuitos via OpenRouter. Limite: ~200 req/dia.
              </div>
            </div>
          </div>
        )}

        {/* Tab: Knowledge */}
        {activeTab === 'knowledge' && (
          <div style={{ padding: '20px 24px' }}>
            {/* Status dot */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '10px 14px', background: 'var(--s2)', borderRadius: 'var(--r-lg)', border: '1px solid var(--bdr)' }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: hasContext ? 'var(--acc)' : 'var(--subtle)',
                boxShadow: hasContext ? '0 0 6px var(--acc)' : 'none',
              }} />
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                {kbCount > 0 && localCtx.trim()
                  ? `Base de conhecimento (${kbCount} itens) + ${localCtx.trim().length} chars adicionais ativos.`
                  : kbCount > 0
                  ? `Base de conhecimento ativa com ${kbCount} itens.`
                  : localCtx.trim()
                  ? `${localCtx.trim().length} caracteres de contexto adicional ativos.`
                  : 'Nenhuma instrução adicional ativa.'}
              </span>
            </div>

            <div>
              <label style={labelStyle}>Instruções e contexto adicional</label>
              <textarea
                style={{ ...inputStyle, resize: 'vertical', minHeight: 130, lineHeight: 1.5 }}
                value={localCtx}
                onChange={(e) => setLocalCtx(e.target.value)}
                placeholder={'Exemplos:\n• Foco em Direito Tributário Federal\n• Sou aluna do 5º período de Direito\n• Sempre citar artigos do CPC/2015\n• Trecho de doutrina ou sumário de aula'}
              />
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                Estas instruções são adicionadas ao prompt de sistema e salvas localmente.
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 24px', borderTop: '1px solid var(--bdr)', background: 'var(--s2)',
        }}>
          <button
            style={{ ...btnBase, background: 'transparent', borderColor: 'rgba(212,106,106,.3)', color: '#e08888', fontSize: 13 }}
            onClick={handleClearContext}
          >
            Limpar contexto
          </button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={btnGhost} onClick={onClose}>Cancelar</button>
            <button style={btnAcc} onClick={handleSave}>Salvar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const labelStyle = {
  display: 'block', fontSize: 11, color: 'var(--muted)',
  textTransform: 'uppercase', letterSpacing: '.07em',
  fontWeight: 600, marginBottom: 7,
};

const baseInput = {
  width: '100%', background: 'var(--s2)', border: '1px solid var(--bdr)',
  borderRadius: 'var(--r-lg)', color: 'var(--text)', fontFamily: 'var(--font)',
  fontSize: 14, padding: '10px 13px', outline: 'none',
};

const inputStyle = { ...baseInput };

const selectStyle = {
  ...baseInput,
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b6356' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 13px center',
  paddingRight: 36,
};

const btnBase = {
  padding: '8px 18px', borderRadius: 'var(--r-lg)', fontFamily: 'var(--font)',
  fontSize: 13, fontWeight: 500, cursor: 'pointer', border: '1px solid transparent',
};

const btnAcc = { ...btnBase, background: 'var(--acc)', color: '#0c0b09', borderColor: 'var(--acc)' };
const btnGhost = { ...btnBase, background: 'transparent', borderColor: 'var(--bdr)', color: 'var(--muted)' };
