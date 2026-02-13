"use client";

import { useState, useEffect, useCallback } from "react";
import type { ActiveWorktree, DeactiveBranch, EndedWorktree } from "@/lib/types";

interface WorktreeState {
  active: ActiveWorktree[];
  deactive: DeactiveBranch[];
  ended: EndedWorktree[];
  loading: boolean;
  error: string | null;
}

export function useWorktrees(pollInterval = 5000) {
  const [state, setState] = useState<WorktreeState>({
    active: [],
    deactive: [],
    ended: [],
    loading: true,
    error: null,
  });

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/status");
      if (!res.ok) throw new Error("Failed to fetch status");
      const data = await res.json();
      setState({
        active: data.active,
        deactive: data.deactive,
        ended: data.ended,
        loading: false,
        error: null,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Unknown error",
      }));
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, pollInterval);
    return () => clearInterval(interval);
  }, [fetchStatus, pollInterval]);

  return { ...state, refresh: fetchStatus };
}
