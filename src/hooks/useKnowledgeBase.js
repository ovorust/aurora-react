import { useState, useEffect, useCallback } from 'react';
import { loadKnowledgeBase, saveKnowledgeBase, getDefaultKnowledgeData } from '../utils/api';

export function useKnowledgeBase(showToast) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadKnowledgeBase()
      .then(setData)
      .catch(() => {
        setData(getDefaultKnowledgeData());
        showToast?.('Usando base local (endpoint indisponível)');
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line

  const persist = useCallback(
    async (newData) => {
      setSaving(true);
      try {
        await saveKnowledgeBase(newData);
        showToast?.('Dados salvos no servidor! ✓');
      } catch {
        showToast?.('Erro ao salvar. Tente novamente.');
      } finally {
        setSaving(false);
      }
    },
    [showToast]
  );

  /* ── CRUD helpers ── */
  const addItem = useCallback(
    (sectionKey, item) => {
      const newData = {
        ...data,
        [sectionKey]: [...(data[sectionKey] || []), item],
      };
      setData(newData);
      persist(newData);
    },
    [data, persist]
  );

  const updateItem = useCallback(
    (sectionKey, id, changes) => {
      const newData = {
        ...data,
        [sectionKey]: data[sectionKey].map((x) =>
          x.id === id ? { ...x, ...changes, updated_at: new Date().toISOString() } : x
        ),
      };
      setData(newData);
      persist(newData);
    },
    [data, persist]
  );

  const deleteItem = useCallback(
    (sectionKey, id) => {
      const newData = {
        ...data,
        [sectionKey]: data[sectionKey].filter((x) => x.id !== id),
      };
      setData(newData);
      persist(newData);
    },
    [data, persist]
  );

  return { data, loading, saving, addItem, updateItem, deleteItem };
}
