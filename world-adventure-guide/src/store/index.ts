import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Adventure, UserRecord, RecordKind } from '../types';
import { buildAdventurePath, SAMPLE_ADVENTURE_TEMPLATE, validateAdventureInvariant } from '../data/worldData';

// =======================
// Adventure Store
// =======================
interface AdventureState {
  adventures: Adventure[];
  activeAdventureId: string | null;

  /** 创建新冒险 */
  createAdventure: (opts: {
    title: string;
    theme?: string;
    worldId: string;
    fromPlaceId: string;
    toPlaceId: string;
    coverNote?: string;
  }) => Adventure | null;

  /** 切换活跃冒险 */
  setActiveAdventure: (id: string | null) => void;

  /** 更新当前探索进度 */
  setCurrentStep: (adventureId: string, step: number) => void;

  /** 访问冒险（更新时间） */
  touchAdventure: (adventureId: string) => void;

  /** 删除冒险 */
  deleteAdventure: (adventureId: string) => void;
}

const makeSampleAdventure = (): Adventure => {
  const now = Date.now();
  return {
    id: `adv-${now}-0`,
    worldId: SAMPLE_ADVENTURE_TEMPLATE.worldId,
    title: SAMPLE_ADVENTURE_TEMPLATE.title,
    theme: SAMPLE_ADVENTURE_TEMPLATE.theme,
    placeIds: SAMPLE_ADVENTURE_TEMPLATE.placeIds,
    routeIds: SAMPLE_ADVENTURE_TEMPLATE.routeIds,
    createdAt: now,
    lastVisitedAt: now,
    currentStep: 0,
    coverNote: '示例冒险：沿着这条线，你会遇见花园城市、佛教之国、咖啡之乡、春城、天府之国、十三朝古都，最后回到皇城根下。',
  };
};

export const useAdventureStore = create<AdventureState>()(
  persist(
    (set, get) => ({
      adventures: [],
      activeAdventureId: null,

      createAdventure: ({ title, theme, worldId, fromPlaceId, toPlaceId, coverNote }) => {
        const path = buildAdventurePath(fromPlaceId, toPlaceId, worldId);
        if (!path) return null;
        // #3 invariant 防线：routeIds.length === placeIds.length - 1 且每段边都真的连接相邻节点
        const invErr = validateAdventureInvariant(path.placeIds, path.routeIds);
        if (invErr) {
          console.error('[createAdventure] 结构不变量校验失败:', invErr);
          return null;
        }
        const now = Date.now();
        const adv: Adventure = {
          id: `adv-${now}-${Math.floor(Math.random() * 1000)}`,
          worldId,
          title,
          theme,
          placeIds: path.placeIds,
          routeIds: path.routeIds,
          createdAt: now,
          lastVisitedAt: now,
          currentStep: 0,
          coverNote,
        };
        set((s) => ({
          adventures: [adv, ...s.adventures],
          activeAdventureId: adv.id,
        }));
        return adv;
      },

      setActiveAdventure: (id) => {
        if (id) get().touchAdventure(id);
        set({ activeAdventureId: id });
      },

      setCurrentStep: (adventureId, step) => {
        set((s) => ({
          adventures: s.adventures.map((a) => {
            if (a.id !== adventureId) return a;
            const bounded = Math.max(0, Math.min(a.placeIds.length - 1, step));
            return { ...a, currentStep: bounded, lastVisitedAt: Date.now() };
          }),
        }));
      },

      touchAdventure: (adventureId) => {
        set((s) => ({
          adventures: s.adventures.map((a) =>
            a.id === adventureId ? { ...a, lastVisitedAt: Date.now() } : a
          ),
        }));
      },

      deleteAdventure: (adventureId) => {
        set((s) => ({
          adventures: s.adventures.filter((a) => a.id !== adventureId),
          activeAdventureId: s.activeAdventureId === adventureId ? null : s.activeAdventureId,
        }));
      },
    }),
    {
      name: 'wag-adventures',
      version: 1,
      // 首次打开如果没有冒险，注入一个示例冒险
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (state.adventures.length === 0) {
          state.adventures = [makeSampleAdventure()];
          state.activeAdventureId = state.adventures[0].id;
        }
      },
    }
  )
);

// =======================
// Record Store
// =======================
interface RecordState {
  records: UserRecord[];
  addRecord: (opts: {
    kind: RecordKind;
    text: string;
    worldId: string;
    timePerspective?: string;
    placeId?: string;
    contentId?: string;
    adventureId?: string;
    rating?: number;
  }) => UserRecord;
  updateRecord: (id: string, patch: Partial<UserRecord>) => void;
  deleteRecord: (id: string) => void;
  getRecordsBy: (filters: {
    placeId?: string;
    adventureId?: string;
    contentId?: string;
    kind?: RecordKind;
  }) => UserRecord[];
  toggleFavorite: (opts: {
    placeId?: string;
    contentId?: string;
    worldId: string;
    adventureId?: string;
  }) => void;
  /**
   * 判断是否已收藏。identity = worldId + placeId (+ contentId)。
   * 注：同一个"地理地点/内容"在不同 World 下是独立的收藏项。
   */
  isFavorited: (filters: { placeId?: string; contentId?: string; worldId?: string }) => boolean;
}

export const useRecordStore = create<RecordState>()(
  persist(
    (set, get) => ({
      records: [],

      addRecord: ({ kind, text, worldId, timePerspective, placeId, contentId, adventureId, rating }) => {
        const now = Date.now();
        const rec: UserRecord = {
          id: `rec-${now}-${Math.floor(Math.random() * 10000)}`,
          kind,
          worldId,
          timePerspective,
          placeId,
          contentId,
          adventureId,
          text,
          rating,
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ records: [rec, ...s.records] }));
        return rec;
      },

      updateRecord: (id, patch) => {
        set((s) => ({
          records: s.records.map((r) =>
            r.id === id ? { ...r, ...patch, updatedAt: Date.now() } : r
          ),
        }));
      },

      deleteRecord: (id) => {
        set((s) => ({ records: s.records.filter((r) => r.id !== id) }));
      },

      getRecordsBy: ({ placeId, adventureId, contentId, kind }) => {
        return get().records.filter((r) => {
          if (placeId && r.placeId !== placeId) return false;
          if (adventureId && r.adventureId !== adventureId) return false;
          if (contentId && r.contentId !== contentId) return false;
          if (kind && r.kind !== kind) return false;
          return true;
        });
      },

      toggleFavorite: ({ placeId, contentId, worldId, adventureId }) => {
        if (!placeId && !contentId) return;
        // #5 Favorite identity = worldId + placeId (+ contentId)。
        // adventureId 只是"该收藏是在哪次冒险上下文中产生的"上下文，不参与唯一键判断。
        const existing = get().records.find(
          (r) =>
            r.kind === 'favorite' &&
            r.worldId === worldId &&
            (placeId ? r.placeId === placeId : !r.placeId) &&
            (contentId ? r.contentId === contentId : !r.contentId)
        );
        if (existing) {
          set((s) => ({ records: s.records.filter((r) => r.id !== existing.id) }));
        } else {
          const now = Date.now();
          const rec: UserRecord = {
            id: `rec-${now}-${Math.floor(Math.random() * 10000)}`,
            kind: 'favorite',
            worldId,
            placeId,
            contentId,
            adventureId,
            text: '',
            createdAt: now,
            updatedAt: now,
          };
          set((s) => ({ records: [rec, ...s.records] }));
        }
      },

      isFavorited: ({ placeId, contentId, worldId }) => {
        return get().records.some((r) => {
          if (r.kind !== 'favorite') return false;
          if (worldId && r.worldId !== worldId) return false;
          // placeId 维度：提供了就要严格相等；没提供则不要求
          if (placeId !== undefined) {
            if (r.placeId !== placeId) return false;
          }
          // contentId 维度：提供了就要严格相等
          if (contentId !== undefined) {
            if (r.contentId !== contentId) return false;
          }
          return true;
        });
      },
    }),
    {
      name: 'wag-records',
      version: 1,
    }
  )
);
