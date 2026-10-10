// 造景 / 人物 / 物品 sprite 素材（v6 批量）：统一加载 + 就绪探测，未就绪时调用方回退矢量管线
import plantGreenUrl from '../../assets/sprites/plant_green_round.png';
import plantRedUrl from '../../assets/sprites/plant_red.png';
import plantGrassUrl from '../../assets/sprites/plant_grass_strap.png';
import woodUrl from '../../assets/sprites/wood_drift.png';
import rockUrl from '../../assets/sprites/rock_slate.png';
import rockLeftUrl from '../../assets/sprites/rock_left.png';
import rockRightUrl from '../../assets/sprites/rock_right.png';
import rockTopUrl from '../../assets/sprites/rock_top.png';
import shellUrl from '../../assets/sprites/shell_conch.png';
import coralUrl from '../../assets/sprites/coral_branch.png';
import moneywortUrl from '../../assets/sprites/plant_moneywort.png';
import valisneriaUrl from '../../assets/sprites/plant_valisneria.png';
import archUrl from '../../assets/sprites/rock_arch_slate.png';
import shopDoorUrl from '../../assets/sprites/shop_door.png';

import personA from '../../assets/sprites/person_woman_red.png';
import personB from '../../assets/sprites/person_man_blue.png';
import personC from '../../assets/sprites/person_boy_yellow.png';
import personD from '../../assets/sprites/person_woman_green.png';
import personE from '../../assets/sprites/person_glasses_man.png';
import personF from '../../assets/sprites/person_oldman_beard.png';
import personG from '../../assets/sprites/person_oldwoman.png';
import personH from '../../assets/sprites/person_girl_pink.png';
import personI from '../../assets/sprites/person_student_backpack.png';
import personJ from '../../assets/sprites/person_businesswoman.png';
import personK from '../../assets/sprites/person_cap_hoodie.png';
import sideA from '../../assets/sprites/side_woman_red.png';
import sideB from '../../assets/sprites/side_man_blue.png';
import sideC from '../../assets/sprites/side_boy_yellow.png';
import sideD from '../../assets/sprites/side_businesswoman.png';
import sideE from '../../assets/sprites/side_student_backpack.png';
import sideF from '../../assets/sprites/side_hoodie.png';
import backB from '../../assets/sprites/back_girl_pink.png';
import bossClerk from '../../assets/sprites/boss_clerk.png';
import wallet from '../../assets/sprites/item_wallet.png';
import plantPot from '../../assets/sprites/item_plant_pot.png';
import foodCan from '../../assets/sprites/item_food_can.png';
import netBg from '../../assets/sprites/net_bg.jpg';
import smallTank from '../../assets/sprites/item_small_tank.png';
import thermometer from '../../assets/sprites/item_thermometer.png';
import fishNet from '../../assets/sprites/item_fish_net.png';
import scallopShell from '../../assets/sprites/ui_scallop_shell.png';
import starfish from '../../assets/sprites/deco_starfish.png';
import waterBowl from '../../assets/sprites/item_water_bowl.png';
import wideTank from '../../assets/sprites/item_wide_tank.png';
import bookStack from '../../assets/sprites/item_book_stack.png';
import ropeNet from '../../assets/sprites/rope_net.png';
import suppliesBg from '../../assets/sprites/supplies_bg.jpg';

import itemFood from '../../assets/sprites/item_food_can.png';
import itemIck from '../../assets/sprites/item_med_ick.png';
import itemFungus from '../../assets/sprites/item_med_fungus.png';
import itemVitamin from '../../assets/sprites/item_vitamin.png';
import itemEgg from '../../assets/sprites/item_egg_pouch.png';
import itemBook from '../../assets/sprites/item_research_book.png';
import itemHeater from '../../assets/sprites/item_heater.png';
import itemFilter from '../../assets/sprites/item_filter.png';
import itemWaterTest from '../../assets/sprites/item_water_test.png';
import itemLight from '../../assets/sprites/item_light.png';
import itemAutoFeeder from '../../assets/sprites/item_auto_feeder.png';
import itemBasket from '../../assets/sprites/item_basket.png';
import itemPremiumFood from '../../assets/sprites/item_premium_food.png';
import itemAlgaeCleaner from '../../assets/sprites/item_algae_cleaner.png';
import itemSign from '../../assets/sprites/item_sign.png';

export const ITEM_SPRITES: Record<string, string> = {
  food_bag: itemFood,
  med_ick: itemIck,
  med_fungus: itemFungus,
  vitamin: itemVitamin,
  egg_common: itemEgg,
  egg_rare: itemEgg,
  egg_exotic: itemEgg,
  // v6.7 新增 9 件
  heater: itemHeater,
  filter: itemFilter,
  water_test: itemWaterTest,
  light: itemLight,
  auto_feeder: itemAutoFeeder,
  basket: itemBasket,
  premium_food: itemPremiumFood,
  algae_cleaner: itemAlgaeCleaner,
  sign: itemSign,
};
export const BOOK_SPRITE = itemBook;

function mk(url: string): HTMLImageElement {
  const img = new Image();
  img.src = url;
  return img;
}

export const DECOR_SPRITES = {
  plantGreen: mk(plantGreenUrl),
  plantRed: mk(plantRedUrl),
  plantGrass: mk(plantGrassUrl),
  wood: mk(woodUrl),
  rock: mk(rockUrl),
  rockLeft: mk(rockLeftUrl),
  rockRight: mk(rockRightUrl),
  rockTop: mk(rockTopUrl),
  shell: mk(shellUrl),
  coral: mk(coralUrl),
  moneywort: mk(moneywortUrl),
  valisneria: mk(valisneriaUrl),
  arch: mk(archUrl),
};

/**
 * 19 种顾客：前 8 张为**侧身/背对**素材（店内行走用，不再正面朝观众），
 * 后 11 张为正面素材（保留作兜底）。索引 0-7 侧身/背对，8-18 正面。
 */
export const PERSON_SPRITES = [
  mk(sideA), mk(sideB), mk(sideC), mk(sideD), mk(sideE), mk(sideF), mk(backB),
  mk(personA), mk(personB), mk(personC), mk(personD), mk(personE), mk(personF),
  mk(personG), mk(personH), mk(personI), mk(personJ), mk(personK),
];
/** 柜台老板 / 台面物品（钱包·鱼粮·盆栽） */
export const SHOP_PROPS = { boss: mk(bossClerk), wallet: mk(wallet), plant: mk(plantPot), foodCan: mk(foodCan) };

/** 店内行走优先使用侧身/背对（0-7）；站立气泡顾客用正面（8+） */
export const WALK_VARIANT_COUNT = 7; // v6.9：侧身 6 + 背面 1（老人素材抠图有黑块残留，已移除）
export const NET_BG = netBg;
/** 等距双开门（商店门） */
export const SHOP_DOOR = mk(shopDoorUrl);
/** Fish Supplies：半透明黄褐绳网（叠在水下实景背景上） */
export const ROPE_NET = ropeNet;
export const SUPPLIES_BG = suppliesBg;
/** 研究木架：上层鱼具（环境=温度计 / 营养=鱼粮罐 / 广告=渔网兜）、中层小鱼缸、下层书 */
export const SHELF_SPRITES = { thermometer, foodCan: itemFood, fishNet, smallTank };
/** Species Chart：青色扇贝壳卡片底 + 海星装饰 */
export const SPECIES_UI = { shell: scallopShell, starfish };
/** 研究木架三层道具：上层水盆+瓶、中层宽鱼缸+瓶、下层叠放书+竖书 */
export const SHELF_ITEMS = { waterBowl, wideTank, bookStack, bottleA: itemIck, bottleB: itemVitamin, bottleC: itemFungus, book: itemBook };

function ok(img: HTMLImageElement): boolean {
  return img.complete && img.naturalWidth > 0;
}

export function decorSpritesReady(): boolean {
  return ok(DECOR_SPRITES.plantGreen) && ok(DECOR_SPRITES.wood) && ok(DECOR_SPRITES.rock);
}
export function personSpritesReady(): boolean {
  return PERSON_SPRITES.some(ok);
}
export function itemSprite(id: string): HTMLImageElement | null {
  const url = ITEM_SPRITES[id];
  if (!url) return null;
  const img = new Image();
  img.src = url;
  return img;
}
export function itemSpriteUrl(id: string): string | null {
  return ITEM_SPRITES[id] ?? null;
}
