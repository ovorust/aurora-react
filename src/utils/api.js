const KB_ENDPOINT = 'https://api.npoint.io/da442f6109be89720e58';

/* ── Knowledge Base ── */
export async function loadKnowledgeBase() {
  const res = await fetch(KB_ENDPOINT, { headers: { 'Content-Type': 'application/json' } });
  if (!res.ok) throw new Error('Erro ao carregar: ' + res.status);
  return res.json();
}

export async function saveKnowledgeBase(data) {
  const payload = { ...data, metadata: { ...data.metadata, last_updated: new Date().toISOString() } };
  const res = await fetch(KB_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Erro ao salvar: ' + res.status);
  return res.json();
}

const CHAT_ENDPOINT = 'https://api.npoint.io/7a8a3150e70c5b6fd525';

export async function loadChats() {
  const res = await fetch(CHAT_ENDPOINT, { headers: { 'Content-Type': 'application/json' } });
  if (!res.ok) throw new Error('Erro ao carregar chats: ' + res.status);
  const data = await res.json();
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.data)) return data.data;
  return [];
}

export async function saveChats(chats) {
  const res = await fetch(CHAT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(chats),
  });
  if (!res.ok) throw new Error('Erro ao salvar chats: ' + res.status);
  return res.json();
}

export function getDefaultKnowledgeData() {
  const now = new Date().toISOString();
  return {
    version: '1.0',
    metadata: { created_at: now, last_updated: now, user: 'Aline' },
    instructions: [
      { id: 'inst-001', type: 'instruction', title: 'Especialidade Principal', content: 'Foco em Direito com expertise em todas as áreas (Civil, Penal, Trabalhista, Tributário, Administrativo, Processual, etc.)', category: 'expertise', priority: 'high', editable: true, created_at: now, updated_at: now },
      { id: 'inst-002', type: 'instruction', title: 'Formato de Respostas', content: 'Respostas claras, estruturadas e acessíveis. Use listas quando apropriado. Cite artigos de lei quando relevante.', category: 'format', priority: 'high', editable: true, created_at: now, updated_at: now },
    ],
    preferences: [
      { id: 'pref-001', type: 'preference', title: 'Citações Legais', content: 'Sempre cite artigos do CPC/2015, CC, CP e Constituição Federal', category: 'citations', editable: true, created_at: now, updated_at: now },
    ],
    student_profile: [
      { id: 'prof-001', type: 'profile', title: 'Situação Acadêmica', content: 'Aluna de Direito na Universidade', editable: true, created_at: now, updated_at: now },
    ],
    knowledge_base: [
      { id: 'kb-001', type: 'knowledge', title: 'Áreas de Especialização', items: ['Direito Civil', 'Direito Penal', 'Direito Processual Civil', 'Direito Trabalhista', 'Direito Tributário', 'Direito Administrativo', 'Direito Constitucional', 'Direito Empresarial'], editable: true, created_at: now, updated_at: now },
      { id: 'kb-002', type: 'knowledge', title: 'Tipos de Trabalhos Aceitos', items: ['Resumos e sínteses', 'Artigos científicos', 'Monografias', 'Peças processuais', 'Contratos', 'Pareceres jurídicos', 'Projetos de pesquisa', 'Estudos de caso'], editable: true, created_at: now, updated_at: now },
    ],
  };
}

/* ── OpenRouter Streaming ── */
export async function* streamChat(messages, systemContent, model) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + window.__cfg.ak,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: systemContent }, ...messages],
      stream: true,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body?.error?.message || 'HTTP ' + res.status);
    err.status = res.status;
    throw err;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      const t = line.trim();
      if (!t || t === 'data: [DONE]' || !t.startsWith('data: ')) continue;
      try {
        const json = JSON.parse(t.slice(6));
        if (json.error) {
          const streamErr = new Error(json.error.message || 'Provider returned error');
          streamErr.status = json.error.code;
          throw streamErr;
        }
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch (e) {
        if (e.status) throw e;
      }
    }
  }
}
