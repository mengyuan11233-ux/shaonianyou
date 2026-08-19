// 动态加载高德地图 JS API 2.0（含安全密钥）
let amapPromise = null;

export function loadAMap() {
  if (window.AMap) return Promise.resolve(window.AMap);
  if (amapPromise) return amapPromise;

  amapPromise = new Promise((resolve, reject) => {
    window._AMapSecurityConfig = {
      securityJsCode: import.meta.env.VITE_AMAP_SECURITY_CODE,
    };
    const script = document.createElement('script');
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${import.meta.env.VITE_AMAP_JS_KEY}`;
    script.onload = () => resolve(window.AMap);
    script.onerror = () => reject(new Error('高德地图加载失败，请检查 JS API Key 与域名白名单'));
    document.head.appendChild(script);
  });
  return amapPromise;
}
