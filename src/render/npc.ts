/** 生成的人物立绘（绿幕抠图 → 透明底 WebP）：正面 + 侧面行走两种朝向 */

import business from '../assets/npc/business.webp';
import businessSide from '../assets/npc/business-side.webp';
import elderMan from '../assets/npc/elder-man.webp';
import elderManSide from '../assets/npc/elder-man-side.webp';
import elderWoman from '../assets/npc/elder-woman.webp';
import elderWomanSide from '../assets/npc/elder-woman-side.webp';
import kid from '../assets/npc/kid.webp';
import kidSide from '../assets/npc/kid-side.webp';
import office from '../assets/npc/office.webp';
import officeSide from '../assets/npc/office-side.webp';
import shopkeeper from '../assets/npc/shopkeeper.webp';
import businessLeft from '../assets/npc/business-left.webp';
import elderManLeft from '../assets/npc/elder-man-left.webp';
import elderWomanLeft from '../assets/npc/elder-woman-left.webp';
import kidLeft from '../assets/npc/kid-left.webp';
import officeLeft from '../assets/npc/office-left.webp';
import studentLeft from '../assets/npc/student-left.webp';
import womanLeft from '../assets/npc/woman-left.webp';
import workerLeft from '../assets/npc/worker-left.webp';
import student from '../assets/npc/student.webp';
import studentSide from '../assets/npc/student-side.webp';
import woman from '../assets/npc/woman.webp';
import womanSide from '../assets/npc/woman-side.webp';
import worker from '../assets/npc/worker.webp';
import workerSide from '../assets/npc/worker-side.webp';
import type { NpcKind } from '../core/types';

export type NpcView = 'front' | 'side' | 'left';

const SRC: Record<NpcKind, Partial<Record<NpcView, string>>> = {
  shopkeeper: { front: shopkeeper },
  student: { front: student, side: studentSide, left: studentLeft },
  office: { front: office, side: officeSide, left: officeLeft },
  kid: { front: kid, side: kidSide, left: kidLeft },
  'elder-man': { front: elderMan, side: elderManSide, left: elderManLeft },
  business: { front: business, side: businessSide, left: businessLeft },
  woman: { front: woman, side: womanSide, left: womanLeft },
  'elder-woman': { front: elderWoman, side: elderWomanSide, left: elderWomanLeft },
  worker: { front: worker, side: workerSide, left: workerLeft },
};

export interface NpcSprite {
  img: HTMLImageElement;
  /** 宽高比 */
  ratio: number;
}

const cache = new Map<string, NpcSprite>();

export function getNpc(kind: NpcKind, view: NpcView = 'front'): NpcSprite | null {
  const url = SRC[kind]?.[view] ?? SRC[kind]?.front ?? SRC.woman.front;
  if (!url) return null;
  const key = `${kind}:${view}`;
  let entry = cache.get(key);
  if (!entry) {
    const img = new Image();
    img.src = url;
    entry = { img, ratio: 1 };
    cache.set(key, entry);
  }
  const img = entry.img;
  if (!img.complete || img.naturalWidth === 0) return null;
  entry.ratio = img.naturalWidth / img.naturalHeight;
  return entry;
}

export function preloadNpc(): void {
  for (const kind of Object.keys(SRC) as NpcKind[]) {
    getNpc(kind, 'front');
    getNpc(kind, 'side');
    getNpc(kind, 'left');
  }
}
