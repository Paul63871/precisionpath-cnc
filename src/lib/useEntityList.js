import { useCallback, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

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
  const create = useCallback(async (body) => { await base44.entities[entityName].create(body); await load(); }, [entityName, load]);
  const update = useCallback(async (id, body) => { await base44.entities[entityName].update(id, body); await load(); }, [entityName, load]);
  const remove = useCallback(async (id) => { await base44.entities[entityName].delete(id); await load(); }, [entityName, load]);
  return { items, loading, create, update, remove, reload: load };
}