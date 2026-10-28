/** 商品与 UI 的内联 SVG 图标（统一玻璃/黄铜风格） */

import type { IconKey } from '../core/items';

function glass(defs: string, body: string, tint: string): string {
  return `<svg viewBox="0 0 48 48" aria-hidden="true">
    <defs>
      <linearGradient id="g-${tint.replace('#', '')}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${tint}" stop-opacity="0.55"/>
        <stop offset="1" stop-color="${tint}" stop-opacity="0.95"/>
      </linearGradient>
      <linearGradient id="hi-${tint.replace('#', '')}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.65"/>
        <stop offset="0.45" stop-color="#ffffff" stop-opacity="0.05"/>
        <stop offset="1" stop-color="#ffffff" stop-opacity="0.3"/>
      </linearGradient>
      ${defs}
    </defs>
    ${body}
  </svg>`;
}

export function itemIcon(key: IconKey, tint: string): string {
  const g = `url(#g-${tint.replace('#', '')})`;
  const hi = `url(#hi-${tint.replace('#', '')})`;
  switch (key) {
    case 'bottle':
      return glass(
        '',
        `<rect x="19" y="6" width="10" height="8" rx="2" fill="#8a6a3c"/>
         <rect x="21" y="13" width="6" height="5" fill="${tint}"/>
         <path d="M18 18h12l3 6v16a3 3 0 0 1-3 3H18a3 3 0 0 1-3-3V24z" fill="${g}" stroke="rgba(20,40,50,.45)"/>
         <rect x="20" y="26" width="8" height="10" rx="1.5" fill="#f8f2df" opacity=".85"/>
         <rect x="21" y="18" width="3" height="20" fill="${hi}" opacity=".8"/>`,
        tint,
      );
    case 'jar':
      return glass(
        '',
        `<rect x="13" y="12" width="22" height="5" rx="2" fill="#7c5a34"/>
         <path d="M14 17h20v22a3 3 0 0 1-3 3H17a3 3 0 0 1-3-3z" fill="${g}" stroke="rgba(20,40,50,.4)"/>
         <rect x="16" y="25" width="16" height="9" rx="2" fill="#f8f2df" opacity=".8"/>
         <rect x="17" y="19" width="4" height="20" fill="${hi}"/>`,
        tint,
      );
    case 'jug':
      return glass(
        '',
        `<path d="M20 8h8v6l4 4v22a3 3 0 0 1-3 3H19a3 3 0 0 1-3-3V18l4-4z" fill="${g}" stroke="rgba(20,40,50,.4)"/>
         <rect x="21" y="12" width="6" height="3" fill="#e8dcc2" opacity=".8"/>
         <rect x="19" y="24" width="10" height="10" rx="2" fill="#f8f2df" opacity=".7"/>
         <rect x="18" y="18" width="3" height="20" fill="${hi}"/>`,
        tint,
      );
    case 'can':
      return glass(
        '',
        `<rect x="13" y="14" width="22" height="26" rx="3" fill="${g}" stroke="rgba(20,40,50,.4)"/>
         <rect x="13" y="12" width="22" height="5" rx="2" fill="#b9b0a0"/>
         <rect x="16" y="22" width="16" height="10" rx="2" fill="#f8f2df" opacity=".8"/>
         <circle cx="24" cy="27" r="3" fill="${tint}"/>
         <rect x="15" y="16" width="3" height="22" fill="${hi}"/>`,
        tint,
      );
    case 'pump':
      return glass(
        '',
        `<rect x="12" y="16" width="20" height="16" rx="3" fill="${g}" stroke="rgba(20,40,50,.4)"/>
         <rect x="30" y="20" width="8" height="4" rx="1" fill="#8f9aa5"/>
         <circle cx="17" cy="24" r="3" fill="#e8f4fa" opacity=".85"/>
         <path d="M34 28c2 4 0 6-2 8s-1 5 1 6" stroke="#bfe6f5" stroke-width="2" fill="none" opacity=".8"/>
         <circle cx="35" cy="14" r="2.4" fill="#d8f2ff" opacity=".8"/>
         <circle cx="40" cy="9" r="1.6" fill="#d8f2ff" opacity=".6"/>`,
        tint,
      );
    case 'filter':
      return glass(
        '',
        `<rect x="15" y="8" width="18" height="7" rx="2" fill="#6f4a2a"/>
         <rect x="17" y="14" width="14" height="24" rx="3" fill="${g}" stroke="rgba(20,40,50,.4)"/>
         <path d="M19 18h10M19 23h10M19 28h10" stroke="#ffffff" stroke-opacity=".5" stroke-width="2"/>
         <rect x="20" y="34" width="8" height="4" rx="1" fill="#4a5a68"/>`,
        tint,
      );
    case 'snail':
      return glass(
        '',
        `<path d="M8 34c4-4 10-6 18-6s14 2 18 6c-4 3-10 4-18 4s-14-1-18-4z" fill="#d9c7a2"/>
         <circle cx="27" cy="27" r="9" fill="${g}" stroke="rgba(60,40,20,.5)"/>
         <path d="M27 19a8 8 0 0 1 6 13 5 5 0 0 0-4-11 3 3 0 0 1 2 5" fill="none" stroke="#8a7050" stroke-width="2"/>
         <path d="M18 30l-4-8M16 31l-6-5" stroke="#c2ac86" stroke-width="2" stroke-linecap="round"/>
         <circle cx="14" cy="22" r="1.4" fill="#4a3a28"/>`,
        tint,
      );
    case 'seahorse':
      return glass(
        '',
        `<path d="M26 8c-6 1-8 6-6 10 2 4 0 6-3 8-4 3-4 9 1 12 4 2 8-1 9-5 1-3-1-5-3-4-2 1-2 4 0 4M26 8c5 1 8 5 7 9-1 3-4 4-6 3" fill="${g}" stroke="rgba(40,30,10,.45)" stroke-width="1.6"/>
         <circle cx="28" cy="14" r="1.8" fill="#2a2015"/>
         <path d="M20 40c-3 2-6 1-7-1" stroke="${tint}" stroke-width="2" fill="none"/>`,
        tint,
      );
    case 'plant':
      return glass(
        '',
        `<path d="M24 42V16" stroke="#3f7d43" stroke-width="3" stroke-linecap="round"/>
         <path d="M24 26c-8-1-11-6-10-12 6-1 11 4 10 12z" fill="${g}" stroke="#2f5f36"/>
         <path d="M24 22c8-2 11-7 9-13-6-1-10 5-9 13z" fill="${g}" stroke="#2f5f36"/>
         <path d="M24 34c6 0 9-4 9-9-5-1-9 3-9 9z" fill="${g}" stroke="#2f5f36" opacity=".85"/>
         <path d="M18 40h12l-2 4H20z" fill="#7a5a35"/>`,
        tint,
      );
    case 'coral':
      return glass(
        '',
        `<path d="M24 44c-2-8-6-10-10-9 3-6 2-12-1-16 6 2 9 8 9 12 1-7 3-11 7-14-2 5-2 11 0 14 2-4 5-6 9-5-4 3-5 8-5 13z" fill="${g}" stroke="rgba(120,30,60,.4)"/>
         <circle cx="16" cy="20" r="1.6" fill="#ffe4ee" opacity=".8"/>
         <circle cx="31" cy="18" r="1.4" fill="#ffe4ee" opacity=".7"/>`,
        tint,
      );
    case 'pagoda':
      return glass(
        '',
        `<path d="M8 16h32l-6 5H14zM12 24h24l-5 5H17zM16 32h16l-4 6H20z" fill="${g}" stroke="rgba(20,50,80,.45)"/>
         <rect x="22" y="38" width="4" height="5" fill="#4a6f92"/>
         <circle cx="24" cy="9" r="3" fill="#f2d98a"/>`,
        tint,
      );
    case 'ship':
      return glass(
        '',
        `<path d="M8 34l4-8h24l4 8c-4 4-10 6-16 6s-12-2-16-6z" fill="${g}" stroke="rgba(60,40,20,.5)"/>
         <rect x="22" y="8" width="3" height="18" fill="#6b4a26"/>
         <path d="M25 10l12 6-12 5z" fill="#f0ead6" opacity=".9"/>
         <path d="M22 14L12 19l10 4z" fill="#e0d8be" opacity=".8"/>`,
        tint,
      );
    case 'basket':
      return glass(
        '',
        `<path d="M10 22h28l-4 18H14z" fill="none" stroke="#c9a86a" stroke-width="2"/>
         <path d="M10 22h28M14 28h20M16 34h16M18 22l2 18M24 22v18M30 22l-2 18" stroke="#c9a86a" stroke-width="1.4" opacity=".9"/>
         <path d="M8 18h32" stroke="#a8854a" stroke-width="3" stroke-linecap="round"/>`,
        tint,
      );
    case 'feeder':
      return glass(
        '',
        `<rect x="12" y="12" width="24" height="18" rx="4" fill="${g}" stroke="rgba(30,50,60,.45)"/>
         <circle cx="24" cy="21" r="5" fill="#e8f4fa" opacity=".8"/>
         <path d="M24 18v5l3 2" stroke="#3a5a6a" stroke-width="1.6" fill="none"/>
         <circle cx="18" cy="34" r="1.6" fill="#e0b552"/>
         <circle cx="24" cy="37" r="1.4" fill="#e0b552"/>
         <circle cx="30" cy="34" r="1.2" fill="#e0b552"/>`,
        tint,
      );
    case 'lamp':
      return glass(
        '',
        `<rect x="22" y="8" width="4" height="10" fill="#8a8a90"/>
         <path d="M12 20h24l-3 8H15z" fill="${g}" stroke="rgba(80,60,20,.4)"/>
         <path d="M14 28h20l-6 14h-8z" fill="#fff0b0" opacity=".35"/>
         <circle cx="24" cy="24" r="3" fill="#fffbe0"/>`,
        tint,
      );
    case 'sign':
      return glass(
        '',
        `<rect x="22" y="26" width="4" height="16" fill="#7a5a34"/>
         <rect x="8" y="12" width="32" height="16" rx="3" fill="${g}" stroke="rgba(60,30,20,.5)"/>
         <path d="M13 20l4-4 4 4-4 4z" fill="#fff3d8" opacity=".9"/>
         <path d="M25 20h12" stroke="#fff3d8" stroke-width="2.4" stroke-linecap="round" opacity=".85"/>`,
        tint,
      );
    case 'food':
      return glass(
        '',
        `<rect x="12" y="12" width="24" height="26" rx="4" fill="${g}" stroke="rgba(60,40,20,.45)"/>
         <rect x="11" y="9" width="26" height="6" rx="2" fill="#b9ae95"/>
         <rect x="16" y="20" width="16" height="12" rx="2" fill="#f8f2df" opacity=".85"/>
         <path d="M19 26h10" stroke="${tint}" stroke-width="2"/>
         <path d="M15 16v18" stroke="#fff" stroke-opacity=".45" stroke-width="3"/>`,
        tint,
      );
    case 'egg':
      return glass(
        '',
        `<ellipse cx="24" cy="28" rx="12" ry="14" fill="${g}" stroke="rgba(60,60,80,.35)"/>
         <ellipse cx="20" cy="22" rx="4" ry="5" fill="#fff" opacity=".55"/>
         <circle cx="26" cy="32" r="3" fill="#ffffff" opacity=".35"/>
         <path d="M12 40c6 3 18 3 24 0" stroke="rgba(255,255,255,.4)" stroke-width="2" fill="none"/>`,
        tint,
      );
    case 'pill':
      return glass(
        '',
        `<rect x="14" y="10" width="20" height="10" rx="3" fill="#c8c2b2"/>
         <rect x="15" y="20" width="18" height="20" rx="4" fill="${g}" stroke="rgba(20,50,40,.4)"/>
         <path d="M18 30h12M18 34h8" stroke="#fff" stroke-opacity=".55" stroke-width="2"/>
         <circle cx="24" cy="14" r="2" fill="#6f6a5c"/>`,
        tint,
      );
    case 'flask':
      return glass(
        '',
        `<path d="M21 9h6v9l9 18a3 3 0 0 1-3 4H15a3 3 0 0 1-3-4l9-18z" fill="${g}" stroke="rgba(20,40,60,.4)"/>
         <path d="M16 30h16l4 7a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2z" fill="#ffffff" opacity=".35"/>
         <rect x="20" y="6" width="8" height="4" rx="1.5" fill="#8a8a90"/>
         <rect x="18" y="18" width="3" height="14" fill="${hi}" opacity=".7"/>`,
        tint,
      );
    default:
      return glass('', `<circle cx="24" cy="24" r="14" fill="${g}"/>`, tint);
  }
}
