// Sprite 鱼类渲染管线（试点 v2）：AI 生成素材（assets/sprites）+ 运行时合成
// 结构对齐原版 Fish Tycoon：鱼身 sprite × 尾鳍 sprite 运行时拼合 → 21×21 组合
// v2：鱼身改为自然细长形态（含小背鳍/胸鳍+裸尾柄），尾鳍图生图取色保证同色系；
//     染色收敛到自然色域（原版鱼种都是自然色，不做整圆色相旋转）；
//     圆身鱼种（肥脂/金球）直接使用整鱼 sprite。
import bodyUrl from '../../assets/sprites/body_platy_orange.png';
import bodyTetraUrl from '../../assets/sprites/body_tetra_blue.png';
import bodyAngelUrl from '../../assets/sprites/body_angelfish_stripe.png';
import bodyBettaUrl from '../../assets/sprites/body_betta_red.png';
import bodyGarUrl from '../../assets/sprites/body_gar_green.png';
import bodyClownUrl from '../../assets/sprites/body_clownfish.png';
import bodyBlueWideUrl from '../../assets/sprites/body_blue_wide.png';
import bodyYellowSlimUrl from '../../assets/sprites/body_yellow_slim.png';
import bodyPurpleDiscUrl from '../../assets/sprites/body_purple_disc.png';
import bodyBigfinRedUrl from '../../assets/sprites/body_bigfin_red.png';
import bodyZebraUrl from '../../assets/sprites/body_zebra_stripe.png';
import bodyEelUrl from '../../assets/sprites/body_eel_orange.png';
import bodyGreenFatUrl from '../../assets/sprites/body_green_fat.png';
import bodySilverUrl from '../../assets/sprites/body_silver_pointy.png';
import tailUrl from '../../assets/sprites/tail_fork_orange.png';
import tailVeilUrl from '../../assets/sprites/tail_veiltail.png';
import tailRoundUrl from '../../assets/sprites/tail_round_short.png';
import tailFanUrl from '../../assets/sprites/tail_fan_large.png';
import roundUrl from '../../assets/sprites/fish_whole_gold.png';
import bgUrl from '../../assets/sprites/tank_bg.jpg';
// v7.5：整鱼 sprite（头+身+尾一体，彻底解决"身尾拼不接"的问题）
import wf0 from '../../assets/sprites/wf_blue_slim.png';
import wf1 from '../../assets/sprites/wf_orange_stripe.png';
import wf2 from '../../assets/sprites/wf_red_veil.png';
import wf3 from '../../assets/sprites/wf_yellow_round.png';
import wf4 from '../../assets/sprites/wf_silver_pointy.png';
import wf5 from '../../assets/sprites/wf_green_fat.png';
import wf6 from '../../assets/sprites/wf_purple_disc.png';
import wf7 from '../../assets/sprites/wf_zebra.png';
import wf8 from '../../assets/sprites/wf_yellow_round.png';
import { fishScale, type FishLook } from './fishart';

const bodyImg = new Image();
const tailImg = new Image();
const roundImg = new Image();
const bgImg = new Image();
let loadedCount = 0;
const WANTED = 2; // body + tail 就绪即可合成（其余体型/尾型/背景可缺省）

function load(url: string, img: HTMLImageElement): void {
  img.onload = () => { loadedCount++; };
  img.onerror = () => { /* 加载失败保持矢量回退 */ };
  img.src = url;
}
// v6.5：14 种真实鱼身（不同体型/颜色/头型/鳍型），21 物种分散映射
const BODY_VARIANTS: HTMLImageElement[] = [];
const BODY_URLS = [
  bodyUrl, bodyTetraUrl, bodyAngelUrl, bodyBettaUrl, bodyGarUrl, bodyClownUrl,
  bodyBlueWideUrl, bodyYellowSlimUrl, bodyPurpleDiscUrl, bodyBigfinRedUrl,
  bodyZebraUrl, bodyEelUrl, bodyGreenFatUrl, bodySilverUrl,
];
// 每种鱼身的"基准色相滤镜"——尾鳍用同一滤镜即可与鱼身同色系（素材尾鳍为橙红基色）
const BODY_FILTERS = [
  'none',                    // platy 橙红
  'hue-rotate(180deg) saturate(0.9)',   // tetra 银蓝
  'hue-rotate(25deg)',       // angel 黄黑条纹
  'hue-rotate(-10deg)',      // betta 大头红
  'hue-rotate(95deg) saturate(0.9)',    // gar 尖长绿
  'none',                    // clown 小丑鱼
  'hue-rotate(185deg) saturate(0.95)',  // 蓝宽身
  'hue-rotate(28deg)',       // 黄细长
  'hue-rotate(250deg) saturate(0.9)',   // 紫圆盘
  'hue-rotate(-6deg)',       // 大鳍红
  'saturate(0.25) brightness(1.08)',    // 黑白斑马（去色）
  'none',                    // 橙鳗形长条
  'hue-rotate(100deg) saturate(0.9)',   // 绿圆胖
  'saturate(0.3) brightness(1.15)',     // 银色小尖头
];
for (const u of BODY_URLS) {
  const img = new Image();
  img.src = u;
  BODY_VARIANTS.push(img);
}
// v6.1：4 种尾型（叉尾 / 长飘带 / 短圆 / 大扇）
const TAIL_VARIANTS: HTMLImageElement[] = [];
const TAIL_URLS = [tailUrl, tailVeilUrl, tailRoundUrl, tailFanUrl];
for (const u of TAIL_URLS) {
  const img = new Image();
  img.src = u;
  TAIL_VARIANTS.push(img);
}
load(bodyUrl, bodyImg);
load(tailUrl, tailImg);
load(roundUrl, roundImg);
load(bgUrl, bgImg);

/** 21 鱼种 → 体型 sprite 索引（尽量分散：梭形/高身/大头/尖长/条纹/圆身/宽身…） */
const BODY_BY_SPECIES = [9, 0, 4, 3, 10, 2, 0, 3, 4, 5, 8, 3, 2, 1, 6, 12, 11, 7, 13, 3, 5];

/**
 * v7.5：整鱼素材（9 种，含完整头/身/尾）。21 物种分散映射到 9 种整鱼，
 * 鳍基因用 ±16° 内的轻微色相偏移区分（不再拼尾巴，避免头尾不匹配）。
 */
const WHOLE_FISH: HTMLImageElement[] = [];
for (const u of [wf0, wf1, wf2, wf3, wf4, wf5, wf6, wf7, wf8]) {
  const img = new Image();
  img.src = u;
  WHOLE_FISH.push(img);
}
/** 21 鱼种 → 整鱼索引（尽量分散，覆盖梭形/高身/大头/细长/圆胖/条纹） */
const WHOLE_BY_SPECIES = [0, 1, 2, 3, 7, 5, 0, 2, 4, 1, 6, 8, 5, 0, 3, 5, 7, 1, 4, 8, 2];
/** 整鱼的自然色相偏移上限 ±16°（保持同族、只做细微区分） */
const WF_HUE = [0, -14, 12, -9, 15, -6, 8, -16, 6, 14, -11, 0, 5, -15, 10, -4, 16, -7, 9, 3, -12];
function wholeFishIdx(sp: number): number {
  return WHOLE_BY_SPECIES[(sp - 1) % WHOLE_BY_SPECIES.length];
}
/** 21 鳍基因 → 尾型索引（0 叉尾 1 长飘带 2 短圆 3 大扇） */
const TAIL_BY_FIN = [2, 0, 0, 3, 2, 2, 0, 1, 0, 3, 1, 0, 2, 2, 0, 2, 0, 3, 1, 2, 1];

function pickBodyIdx(sp: number): number {
  return BODY_BY_SPECIES[(sp - 1) % BODY_BY_SPECIES.length];
}
function pickBody(sp: number): HTMLImageElement {
  const img = BODY_VARIANTS[pickBodyIdx(sp)];
  return img.naturalWidth > 0 ? img : bodyImg;
}
function pickTail(fin: number): HTMLImageElement {
  const img = TAIL_VARIANTS[TAIL_BY_FIN[(fin - 1) % TAIL_BY_FIN.length]];
  return img.naturalWidth > 0 ? img : tailImg;
}

export function spriteFishReady(): boolean {
  return loadedCount >= WANTED && bodyImg.naturalWidth > 0 && tailImg.naturalWidth > 0;
}
export function tankBgReady(): boolean {
  return bgImg.complete && bgImg.naturalWidth > 0;
}
export function getTankBg(): HTMLImageElement {
  return bgImg;
}

/** 自然色域染色：素材基色为橙红，只做小幅色相偏移（±36°内），避免出现霓虹色 */
const HUE_SHIFTS = [0, -12, 18, -30, 30, 8, -20, 22, -6, 14, -16, 26, 6, -26, 36, -8, 16, -22, 12, 28, -14];
function hueFilter(seed: number): string {
  const h = HUE_SHIFTS[(seed - 1) % HUE_SHIFTS.length];
  return h === 0 ? 'none' : `hue-rotate(${h}deg)`;
}
/**
 * 绘制 sprite 合成鱼：尾鳍（含鳞片尾柄，水平翻转后接在身体左后方）绕接点摆动
 * 原点在身体中心，朝右；水平翻转由调用方处理
 */
export function drawSpriteFish(ctx: CanvasRenderingContext2D, look: FishLook, x: number, y: number, wag: number, selected: boolean): void {
  const isRound = look.sp === 5 || look.sp === 10; // 肥脂鱼/金球鱼 → 整鱼 sprite
  const bSprite = isRound ? roundImg : pickBody(look.sp);
  const tSprite = pickTail(look.fin);
  // 不同体型长宽比差异大 → 按体型的像素长度归一（细长型额外缩放）；v6.2 鱼整体缩小更贴近原版小鱼群
  const lenNorm = 210 / Math.max(1, bSprite.naturalWidth);
  const scale = fishScale(look.age) * (isRound ? 0.24 : 0.21) * Math.min(1.25, Math.max(0.62, lenNorm * 1.15));
  const bw = bSprite.naturalWidth * scale;
  const bh = bSprite.naturalHeight * scale;
  const fw = tSprite.naturalWidth * scale;
  const fh = tSprite.naturalHeight * scale;
  const wagA = look.dead ? 0 : Math.sin(wag) * 0.24;
  const bob = look.dead ? 0 : Math.sin(wag * 0.5) * 1.5;
  let fishW = bw; let fishH = bh;   // 实际绘制尺寸（供病症标记/半径使用）

  ctx.save();
  ctx.translate(x, y);
  if (look.dead) { ctx.rotate(Math.PI); ctx.globalAlpha = 0.7; }

  // v7.5：整鱼直绘（头+身+尾本就是一张图），不再做"身+尾"拼接
  const wi = wholeFishIdx(look.sp);
  const wfImg = WHOLE_FISH[wi];
  if (wfImg.complete && wfImg.naturalWidth > 0) {
    // 长度归一：整鱼自带尾鳍，宽度即全长
    const wScale = fishScale(look.age) * 0.21 * Math.min(1.15, Math.max(0.62, (210 / wfImg.naturalWidth) * 1.35));
    const ww = wfImg.naturalWidth * wScale;
    const wh = wfImg.naturalHeight * wScale;
    // 摆尾：绕尾柄位置（整鱼尾部约 40% 处）做小角度摆动
    const pivX = -ww * 0.14;
    const hh = WF_HUE[(look.sp - 1) % WF_HUE.length];
    ctx.save();
    ctx.filter = hh === 0 ? 'none' : `hue-rotate(${hh}deg)`;
    // 摆动：身体微俯仰 + 尾部轻摆（整鱼无需分件，幅度更自然）
    const pitch = wagA * 0.22;
    ctx.rotate(pitch);
    ctx.translate(-pivX, 0);
    ctx.rotate(-pitch * 0.7);
    const preg = look.pregnant > 0 ? 1.04 : 1;
    ctx.drawImage(wfImg, -ww * preg / 2 + pivX, -wh / 2 + bob, ww * preg, wh);
    ctx.restore();
    ctx.filter = 'none';
    fishW = ww; fishH = wh;
  } else if (isRound) {
    ctx.filter = hueFilter(((look.sp * 7) + (look.fin * 3)) % 21 + 1);
    const rw = roundImg.naturalWidth * scale;
    const rh = roundImg.naturalHeight * scale;
    ctx.drawImage(roundImg, -rw / 2, -rh / 2 + bob, rw, rh);
    ctx.filter = 'none';
    fishW = rw; fishH = rh;
  } else {
    // 兜底：整鱼未就绪时用旧的身+尾拼接
    ctx.save();
    ctx.translate(-bw * 0.44, 0);
    ctx.rotate(wagA);
    ctx.scale(-1, 1);
    ctx.filter = BODY_FILTERS[pickBodyIdx(look.sp)];
    ctx.drawImage(tSprite, -fw * 0.22, -fh / 2, fw, fh);
    ctx.filter = 'none';
    ctx.restore();
    const preg = look.pregnant > 0 ? 1.05 : 1;
    ctx.drawImage(bSprite, -bw / 2, -bh / 2 + bob, bw * preg, bh);
    fishW = bw; fishH = bh;
  }

  // 3. 病症标记（与矢量版一致的可视化）
  if (look.sick === 'ick') {
    ctx.fillStyle = 'rgba(250,250,245,0.95)';
    for (let i = 0; i < 7; i++) {
      const a = i * 1.05 + 0.4;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * fishW * 0.26, Math.sin(a) * fishH * 0.24, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (look.sick === 'fungus') {
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = 'rgba(190,205,170,0.65)';
      ctx.beginPath();
      ctx.arc(-fishW * 0.26 + i * fishW * 0.13, -fishH * 0.18 + (i % 2) * fishH * 0.16, fishH * 0.13, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 4. 选中圈
  if (selected) {
    ctx.strokeStyle = '#ffe259';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.lineDashOffset = -wag * 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, bw * 0.58 + 10, bh * 0.58 + 10, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}
