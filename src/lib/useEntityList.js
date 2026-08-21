import { useCallback, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

// Entity list hook with optimistic create/remove and safe rollback on failure.
export function useEntityList(entityName) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await base44.entities[entityName].list("-updated_date");
      setItems(data || []);
    } finally {
      setLoading(false);
    }
  }, [entityName]);
  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (body) => {
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const now = new Date().toISOString();
    const optimistic = { ...body, id: tempId, created_date: now, updated_date: now };
    setItems((prev) => [optimistic, ...prev]);
    try {
      const created = await base44.entities[entityName].create(body);
      setItems((prev) => prev.map((it) => (it.id === tempId ? created : it)));
    } catch (e) {
      setItems((prev) => prev.filter((it) => it.id !== tempId));
      throw e;
    }
  }, [entityName]);

  const update = useCallback(async (id, body) => {
    let snapshot;
    setItems((prev) => {
      snapshot = prev;
      return prev.map((it) => (it.id === id ? { ...it, ...body } : it));
    });
    try {
      await base44.entities[entityName].update(id, body);
    } catch (e) {
      setItems(snapshot);
      throw e;
    }
  }, [entityName]);

  const remove = useCallback(async (id) => {
    let snapshot;
    setItems((prev) => {
      snapshot = prev;
      return prev.filter((it) => it.id !== id);
    });
    try {
      await base44.entities[entityName].delete(id);
    } catch (e) {
      setItems(snapshot);
      throw e;
    }
  }, [entityName]);

  return { items, loading, create, update, remove, reload: load };
}