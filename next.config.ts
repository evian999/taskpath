import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** 与下方 webpack() 并存时 Next 16 要求显式声明（生产构建仍默认用 Turbopack） */
  turbopack: {},
  /**
   * 仅 `next dev --webpack` 会走此配置：忽略对 data/ 的监视，减少无意义 HMR。
   */
  webpack: (config, { dev }) => {
    if (dev) {
      const prev = config.watchOptions ?? {};
      const ig = prev.ignored;
      const dataGlob = "**/data/**";
      /** Webpack 5 + Next 校验要求 `ignored` 为 non-empty string[]，不能把 RegExp 等原样并入 */
      let ignored: string[];
      if (Array.isArray(ig)) {
        const strings = ig.filter(
          (x): x is string => typeof x === "string" && x.length > 0,
        );
        ignored =
          strings.length > 0
            ? [...strings, dataGlob]
            : ["**/node_modules/**", dataGlob];
      } else if (typeof ig === "string" && ig.length > 0) {
        ignored = [ig, dataGlob];
      } else {
        ignored = ["**/node_modules/**", dataGlob];
      }
      if (!ignored.includes(dataGlob)) ignored = [...ignored, dataGlob];
      config.watchOptions = { ...prev, ignored };
    }
    return config;
  },
};

export default nextConfig;
