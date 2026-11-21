import React, { useEffect, useState } from 'react';
import { Lottie } from '@remotion/lottie';
import { continueRender, delayRender, staticFile } from 'remotion';

// Pre-loaded offline Lottie animation data for instant zero-latency rendering
import shoppingCartAnimation from '../../../remotion/public/lottie/shopping-cart.json' with { type: 'json' };
import lockAnimation from '../../../remotion/public/lottie/lock.json' with { type: 'json' };
import serverAnimation from '../../../remotion/public/lottie/server.json' with { type: 'json' };
import databaseAnimation from '../../../remotion/public/lottie/database.json' with { type: 'json' };
import alertAnimation from '../../../remotion/public/lottie/alert-triangle.json' with { type: 'json' };
import activityAnimation from '../../../remotion/public/lottie/activity.json' with { type: 'json' };
import scooter3dAnimation from '../../../remotion/public/lottie/scooter-3d.json' with { type: 'json' };
import ecommerceShopAnimation from '../../../remotion/public/lottie/ecommerce-shop.json' with { type: 'json' };
import money3dAnimation from '../../../remotion/public/lottie/money-3d.json' with { type: 'json' };
import techCloudAnimation from '../../../remotion/public/lottie/tech_cloud.json' with { type: 'json' };

const STATIC_CATALOG: Record<string, any> = {
  'shopping-cart': shoppingCartAnimation,
  shop: ecommerceShopAnimation,
  cart: ecommerceShopAnimation,
  ecommerce: ecommerceShopAnimation,
  'ecommerce-shop': ecommerceShopAnimation,
  scooter: scooter3dAnimation,
  delivery: scooter3dAnimation,
  rider: scooter3dAnimation,
  truck: scooter3dAnimation,
  ride: scooter3dAnimation,
  'scooter-3d': scooter3dAnimation,
  money: money3dAnimation,
  'money-3d': money3dAnimation,
  fintech: money3dAnimation,
  payment: money3dAnimation,
  'credit-card': money3dAnimation,
  cloud: techCloudAnimation,
  'tech-cloud': techCloudAnimation,
  lock: lockAnimation,
  mutex: lockAnimation,
  security: lockAnimation,
  server: serverAnimation,
  pipeline: serverAnimation,
  database: databaseAnimation,
  db: databaseAnimation,
  alert: alertAnimation,
  warning: alertAnimation,
  error: alertAnimation,
  activity: activityAnimation,
  pulse: activityAnimation,
};

export interface LottieAssetProps {
  /**
   * Name or keyword matching the catalog, or a relative path in public (e.g. "lottie/cache/box.json")
   */
  name?: string;
  /**
   * Optional direct public URL or path to a dynamic Lottie JSON file (e.g. from online search)
   */
  src?: string;
  /**
   * Optional direct animation JSON object
   */
  animationData?: any;
  style?: React.CSSProperties;
  loop?: boolean;
}

export const LottieAsset: React.FC<LottieAssetProps> = ({
  name,
  src,
  animationData: directData,
  style,
  loop = true,
}) => {
  // 1. Direct object passed
  if (directData) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', ...style }}>
        <Lottie animationData={directData} loop={loop} />
      </div>
    );
  }

  // 2. Preloaded bundled static asset
  const lowerName = (name || '').toLowerCase().trim();
  if (lowerName && STATIC_CATALOG[lowerName]) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', ...style }}>
        <Lottie animationData={STATIC_CATALOG[lowerName]} loop={loop} />
      </div>
    );
  }

  // 3. Dynamic Lottie from public/ or URL
  const resolvedSrc = src || (lowerName.includes('.json') ? lowerName : (lowerName ? `lottie/cache/${lowerName}.json` : ''));
  return <DynamicLottieLoader src={resolvedSrc} style={style} loop={loop} />;
};

const DynamicLottieLoader: React.FC<{ src: string; style?: React.CSSProperties; loop?: boolean }> = ({
  src,
  style,
  loop = true,
}) => {
  const [data, setData] = useState<any>(null);
  const [handle] = useState(() => delayRender());

  useEffect(() => {
    if (!src) {
      continueRender(handle);
      return;
    }

    let fetchUrl = src;
    if (!src.startsWith('http://') && !src.startsWith('https://')) {
      fetchUrl = staticFile(src);
    }

    let isMounted = true;
    fetch(fetchUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((jsonData) => {
        if (isMounted) {
          setData(jsonData);
        }
        continueRender(handle);
      })
      .catch((err) => {
        console.warn(`[LottieAsset] Could not load dynamic lottie from ${fetchUrl}:`, err);
        continueRender(handle);
      });

    return () => {
      isMounted = false;
    };
  }, [handle, src]);

  if (!data) return null;

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', ...style }}>
      <Lottie animationData={data} loop={loop} />
    </div>
  );
};
