import { useState, useEffect } from 'react';

const CATEGORIES = [
  { value: 'expertise', label: 'Expertise' },
  { value: 'format', label: 'Formato' },
  { value: 'capabilities', label: 'Capacidades' },
  { value: 'personality', label: 'Personalidade' },
  { value: 'citations', label: 'Citações' },
  { value: 'language', label: 'Linguagem' },
  { value: 'academic_format', label: 'Formato Acadêmico' },
  { value: 'other', label: 'Outro' },
];

export default function ItemModal({ open, onClose, onSave, editItem, sectionKey }) {
  const isKnowledge = sectionKey === 'knowledge_base';

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('medium');

  useEffect(() => {
    if (open) {
      if (editItem) {
        setTitle(editItem.title || '');
        setContent(isKnowledge
          ? (Array.isArray(editItem.items) ? editItem.items.join('\n') : editItem.items || '')
          : editItem.content || '');
        setCategory(editItem.category || '');
        setPriority(editItem.priority || 'medium');
      } else {
        setTitle('');
        setContent('');
        setCategory('');
        setPriority('medium');
      }
    }
  }, [open, editItem, isKnowledge]);

  function handleSave() {
    if (!title.trim()) return;
    if (!content.trim()) return;

    const base = {
      title: title.trim(),
      updated_at: new Date().toISOString(),
    };

    if (isKnowledge) {
      base.items = content.split('\n').filter((x) => x.trim());
    } else {
      base.content = content.trim();
      if (category) base.category = category;
      base.priority = priority;
    }

    onSave(base);
  }

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
        borderRadius: 'var(--r-xl)', width: '100%', maxWidth: 600,
        boxShadow: '0 20px 60px rgba(0,0,0,.5)', maxHeight: '90vh',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '24px', borderBottom: '1px solid var(--bdr)', background: 'var(--s2)' }}>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
            {editItem ? `Editar: ${editItem.title}` : 'Adicionar novo item'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            {isKnowledge ? 'Cada linha será um item na lista' : 'Preencha os campos abaixo'}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Título</label>
            <input
              style={inputStyle}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Citações Legais"
            />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>
              {isKnowledge ? 'Itens (um por linha)' : 'Descrição / Conteúdo'}
            </label>
            <textarea
              style={{ ...inputStyle, resize: 'vertical', minHeight: isKnowledge ? 140 : 100, lineHeight: 1.5 }}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={isKnowledge ? 'Direito Civil\nDireito Penal\nDireito Tributário' : 'Ex: Sempre cite artigos do CPC/2015...'}
            />
          </div>

          {!isKnowledge && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={labelStyle}>Categoria</label>
                <select style={selectStyle} value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">Selecione...</option>
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Prioridade</label>
                <select style={selectStyle} value={priority} onChange={(e) => setPriority(e.target.value)}>
                  <option value="low">Baixa</option>
                  <option value="medium">Média</option>
                  <option value="high">Alta</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', gap: 10, justifyContent: 'flex-end',
          padding: '16px 24px', borderTop: '1px solid var(--bdr)', background: 'var(--s2)',
        }}>
          <button style={btnGhost} onClick={onClose}>Cancelar</button>
          <button style={btnAcc} onClick={handleSave}>Salvar</button>
        </div>
      </div>
    </div>
  );
}

const labelStyle = {
  display: 'block', fontSize: 11, color: 'var(--muted)',
  textTransform: 'uppercase', letterSpacing: '.07em',
  fontWeight: 600, marginBottom: 6,
};

const inputStyle = {
  width: '100%', background: 'var(--s2)', border: '1px solid var(--bdr)',
  borderRadius: 'var(--r-lg)', color: 'var(--text)', fontFamily: 'var(--font)',
  fontSize: 13, padding: '10px 13px', outline: 'none',
};

const selectStyle = {
  ...inputStyle,
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
