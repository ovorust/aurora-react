import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKnowledgeBase } from '../hooks/useKnowledgeBase';
import { useToast } from '../hooks/useToast';
import ItemModal from '../components/ItemModal';
import Toast from '../components/Toast';

const TABS = [
  { key: 'instructions', label: 'Instruções', section: 'instructions', icon: '📌', emptyIcon: '📝', emptyText: 'Nenhuma instrução adicionada' },
  { key: 'preferences', label: 'Preferências', section: 'preferences', icon: '⚙︎', emptyIcon: '⚙︎', emptyText: 'Nenhuma preferência adicionada' },
  { key: 'profile', label: 'Perfil', section: 'student_profile', icon: '👤', emptyIcon: '👤', emptyText: 'Nenhuma informação de perfil' },
  { key: 'knowledge', label: 'Base de Conhecimento', section: 'knowledge_base', icon: '📚', emptyIcon: '📚', emptyText: 'Nenhuma base de conhecimento' },
];

export default function KnowledgeManager() {
  const navigate = useNavigate();
  const { toast, showToast } = useToast();
  const { data, loading, saving, addItem, updateItem, deleteItem } = useKnowledgeBase(showToast);

  const [activeTabKey, setActiveTabKey] = useState('instructions');
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);

  const activeTab = TABS.find((t) => t.key === activeTabKey);
  const sectionKey = activeTab?.section;
  const items = data?.[sectionKey] || [];

  function handleAdd() {
    setEditItem(null);
    setModalOpen(true);
  }

  function handleEdit(item) {
    setEditItem(item);
    setModalOpen(true);
  }

  function handleDelete(item) {
    if (!confirm('Tem certeza que deseja deletar este item?')) return;
    deleteItem(sectionKey, item.id);
    showToast('Item deletado! ✓');
  }

  function handleSave(formData) {
    if (editItem) {
      updateItem(sectionKey, editItem.id, formData);
      showToast('Item atualizado! ✓');
    } else {
      const now = new Date().toISOString();
      addItem(sectionKey, {
        id: 'item-' + Date.now(),
        type: sectionKey === 'knowledge_base' ? 'knowledge'
          : sectionKey === 'student_profile' ? 'profile'
          : sectionKey.replace(/s$/, ''),
        editable: true,
        created_at: now,
        updated_at: now,
        ...formData,
      });
      showToast('Item adicionado! ✓');
    }
    setModalOpen(false);
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'var(--font)' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: 20 }}>

        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 30, flexWrap: 'wrap', gap: 16,
        }}>
          <div>
            <h1 style={{ fontSize: 24, letterSpacing: '-.01em' }}>⚖︎ Gerenciador de Base de Conhecimento</h1>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
              Organize e personalize o contexto da AURORA
              {saving && <span style={{ marginLeft: 10, color: 'var(--acc)' }}>⏳ Salvando...</span>}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={btnAcc} onClick={handleAdd}>+ Adicionar Item</button>
            <button style={btnGhost} onClick={() => navigate('/')}>← Voltar</button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--bdr)', marginBottom: 24 }}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTabKey(tab.key)}
              style={{
                padding: '12px 16px', border: 'none', background: 'none', cursor: 'pointer',
                color: activeTabKey === tab.key ? 'var(--acc)' : 'var(--muted)',
                fontFamily: 'var(--font)', fontWeight: 500, fontSize: 13,
                borderBottom: activeTabKey === tab.key ? '2px solid var(--acc)' : '2px solid transparent',
                marginBottom: -1, transition: 'all .15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Section ── */}
        <div style={{
          background: 'var(--s1)', border: '1px solid var(--bdr)',
          borderRadius: 'var(--r-xl)', overflow: 'hidden',
        }}>
          <div style={{
            padding: '18px 22px', borderBottom: '1px solid var(--bdr)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{activeTab?.label}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                {items.length} {items.length === 1 ? 'item' : 'itens'}
              </div>
            </div>
          </div>
          <div style={{ padding: '20px 22px' }}>
            {loading ? (
              <LoadingState />
            ) : items.length === 0 ? (
              <EmptyState tab={activeTab} onAdd={handleAdd} />
            ) : (
              items.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  sectionKey={sectionKey}
                  onEdit={() => handleEdit(item)}
                  onDelete={() => handleDelete(item)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      <ItemModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        editItem={editItem}
        sectionKey={sectionKey}
      />
      <Toast toast={toast} />
    </div>
  );
}

function ItemCard({ item, sectionKey, onEdit, onDelete }) {
  const isKnowledge = sectionKey === 'knowledge_base';
  const contentText = isKnowledge
    ? (Array.isArray(item.items) ? item.items.join(', ') : String(item.items || ''))
    : item.content || '';

  return (
    <div style={{
      background: 'var(--s2)', border: '1px solid var(--bdr)',
      borderRadius: 'var(--r-lg)', padding: 16, marginBottom: 12,
      display: 'flex', gap: 12, alignItems: 'flex-start',
      transition: 'all .2s',
    }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(212,166,74,.15)'; e.currentTarget.style.background = '#212015'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--bdr)'; e.currentTarget.style.background = 'var(--s2)'; }}
    >
      <div style={{
        width: 36, height: 36, minWidth: 36, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        borderRadius: 'var(--r-lg)', background: 'var(--acc-dim)', fontSize: 16,
      }}>
        {isKnowledge ? '📚' : '📌'}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{item.title}</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 8 }}>
          {contentText.length > 200 ? contentText.slice(0, 200) + '…' : contentText}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {item.category && (
            <span style={{ background: 'var(--acc-dim)', color: 'var(--acc)', padding: '2px 8px', borderRadius: 12, fontSize: 11 }}>
              {item.category}
            </span>
          )}
          {item.locked && (
            <span style={{ background: 'rgba(212,106,106,.15)', color: '#e08888', padding: '2px 8px', borderRadius: 12, fontSize: 11 }}>
              🔒 Bloqueado
            </span>
          )}
          {item.priority && (
            <span style={{ fontSize: 11, color: 'var(--subtle)' }}>
              Prioridade: <strong style={{ color: 'var(--muted)' }}>{item.priority}</strong>
            </span>
          )}
          {isKnowledge && Array.isArray(item.items) && (
            <span style={{ fontSize: 11, color: 'var(--subtle)' }}>
              {item.items.length} itens
            </span>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {item.locked || item.editable === false ? (
          <button style={{ ...btnSm, ...btnGhostSm, opacity: .4 }} disabled>Bloqueado</button>
        ) : (
          <>
            <button style={{ ...btnSm, ...btnGhostSm }} onClick={onEdit}>Editar</button>
            <button style={{ ...btnSm, ...btnDangerSm }} onClick={onDelete}>Deletar</button>
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState({ tab, onAdd }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
      <div style={{ fontSize: 32, marginBottom: 12, opacity: .3 }}>{tab?.emptyIcon}</div>
      <div style={{ fontSize: 14, marginBottom: 4 }}>{tab?.emptyText}</div>
      <div style={{ fontSize: 12, opacity: .7, marginBottom: 16 }}>Clique em + Adicionar Item para começar</div>
      <button style={btnAcc} onClick={onAdd}>+ Adicionar Item</button>
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
      <div style={{ fontSize: 14 }}>Carregando base de conhecimento…</div>
    </div>
  );
}

const btnBase = {
  padding: '8px 18px', borderRadius: 'var(--r-lg)', fontFamily: 'var(--font)',
  fontSize: 13, fontWeight: 500, cursor: 'pointer', border: '1px solid transparent',
};

const btnAcc = { ...btnBase, background: 'var(--acc)', color: '#0c0b09' };
const btnGhost = { ...btnBase, background: 'transparent', borderColor: 'var(--bdr)', color: 'var(--muted)' };

const btnSm = { ...btnBase, padding: '5px 11px', fontSize: 12 };
const btnGhostSm = { background: 'transparent', borderColor: 'var(--bdr)', color: 'var(--muted)' };
const btnDangerSm = { background: 'transparent', borderColor: 'rgba(212,106,106,.3)', color: '#e08888' };
