import { WoodenStorageBox } from '../../generated';
import boxImage from '../../assets/hero.png';
import { applyStandardDropShadow } from './shadowUtils';
import { GroundEntityConfig, renderConfiguredGroundEntity } from './genericGroundRenderer';
import { imageManager } from './imageManager';

// --- Constants ---
export const BOX_WIDTH = 64;
export const BOX_HEIGHT = 64;
export const PLAYER_BOX_INTERACTION_DISTANCE_SQUARED = 96.0 * 96.0;
const SHAKE_DURATION_MS = 150;
const SHAKE_INTENSITY_PX = 10;
const HEALTH_BAR_WIDTH = 50;
const HEALTH_BAR_HEIGHT = 6;
const HEALTH_BAR_Y_OFFSET = 8;
const HEALTH_BAR_VISIBLE_DURATION_MS = 3000;

const boxConfig: GroundEntityConfig<WoodenStorageBox> = {
  getImageSource: (entity) => {
    if (entity.isDestroyed || entity.isHidden) {
      return null;
    }
    return boxImage;
  },

  getTargetDimensions: (_img: HTMLImageElement, _entity: WoodenStorageBox) => ({
    width: BOX_WIDTH,
    height: BOX_HEIGHT,
  }),

  calculateDrawPosition: (entity, drawWidth, drawHeight) => ({
    drawX: entity.posX - drawWidth / 2,
    drawY: entity.posY - drawHeight / 2 - 10,
  }),

  getShadowParams: undefined,

  applyEffects: (ctx, entity, nowMs, _baseDrawX, _baseDrawY, cycleProgress) => {
    if (!entity.isHidden && !entity.isDestroyed) {
      applyStandardDropShadow(ctx, { cycleProgress, blur: 4, offsetY: 3 });
    }

    let shakeOffsetX = 0;
    let shakeOffsetY = 0;

    if (entity.lastHitTime && !entity.isDestroyed) {
      // Convert micros (bigint) to ms safely:
      const lastHitTimeMs = Number(entity.lastHitTime.microsSinceUnixEpoch / 1000n);
      const elapsedSinceHit = nowMs - lastHitTimeMs;

      if (elapsedSinceHit >= 0 && elapsedSinceHit < SHAKE_DURATION_MS) {
        const shakeFactor = 1 - elapsedSinceHit / SHAKE_DURATION_MS;
        const currentShakeIntensity = SHAKE_INTENSITY_PX * shakeFactor;
        shakeOffsetX = (Math.random() - 0.5) * 2 * currentShakeIntensity;
        shakeOffsetY = (Math.random() - 0.5) * 2 * currentShakeIntensity;
      }
    }

    return { offsetX: shakeOffsetX, offsetY: shakeOffsetY };
  },

  drawOverlay: (
    ctx,
    entity,
    finalDrawX,
    finalDrawY,
    finalDrawWidth,
    _finalDrawHeight,
    nowMs,
    _baseDrawX,
    _baseDrawY
  ) => {
    if (entity.isDestroyed || entity.isHidden) return;

    const health = entity.health ?? 0;
    const maxHealth = entity.maxHealth ?? 1;

    if (health < maxHealth && entity.lastHitTime) {
      const lastHitTimeMs = Number(entity.lastHitTime.microsSinceUnixEpoch / 1000n);
      const elapsedSinceHit = nowMs - lastHitTimeMs;

      if (elapsedSinceHit < HEALTH_BAR_VISIBLE_DURATION_MS) {
        const healthPercentage = Math.max(0, health / maxHealth);
        const barOuterX = finalDrawX + (finalDrawWidth - HEALTH_BAR_WIDTH) / 2;
        const barOuterY = finalDrawY - HEALTH_BAR_Y_OFFSET - HEALTH_BAR_HEIGHT;

        const timeSinceLastHitRatio = elapsedSinceHit / HEALTH_BAR_VISIBLE_DURATION_MS;
        const opacity = Math.max(0, 1 - Math.pow(timeSinceLastHitRatio, 2));

        ctx.fillStyle = `rgba(0, 0, 0, ${0.5 * opacity})`;
        ctx.fillRect(barOuterX, barOuterY, HEALTH_BAR_WIDTH, HEALTH_BAR_HEIGHT);

        const healthBarInnerWidth = HEALTH_BAR_WIDTH * healthPercentage;
        const r = Math.floor(255 * (1 - healthPercentage));
        const g = Math.floor(255 * healthPercentage);
        ctx.fillStyle = `rgba(${r}, ${g}, 0, ${opacity})`;
        ctx.fillRect(barOuterX, barOuterY, healthBarInnerWidth, HEALTH_BAR_HEIGHT);

        ctx.strokeStyle = `rgba(0,0,0, ${0.7 * opacity})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(barOuterX, barOuterY, HEALTH_BAR_WIDTH, HEALTH_BAR_HEIGHT);
      }
    }
  },

  fallbackColor: '#A0522D',
};

// Preload image only if the asset bundle provides it
if (boxImage) {
  imageManager.preloadImage(boxImage);
}

export function renderWoodenStorageBox(
  ctx: CanvasRenderingContext2D,
  box: WoodenStorageBox,
  nowMs: number,
  cycleProgress: number
) {
  renderConfiguredGroundEntity({
    ctx,
    entity: box,
    config: boxConfig,
    nowMs,
    entityPosX: box.posX,
    entityPosY: box.posY,
    cycleProgress,
  });
}