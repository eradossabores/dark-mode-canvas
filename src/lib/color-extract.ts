/**
 * Extract dominant colors from an image file and generate HSL theme values.
 */
export async function extractColorsFromImage(file: File): Promise<{
  primary: string;
  secondary: string;
  accent: string;
}> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      // Sample at small size for performance
      canvas.width = 64;
      canvas.height = 64;
      ctx.drawImage(img, 0, 0, 64, 64);
      const data = ctx.getImageData(0, 0, 64, 64).data;

      // Collect colors, skip white/black/transparent
      const colors: [number, number, number][] = [];
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        if (a < 128) continue; // skip transparent
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const lightness = (max + min) / 2;
        if (lightness > 240 || lightness < 15) continue; // skip near-white/black
        const saturation = max === min ? 0 : (max - min) / (1 - Math.abs(2 * lightness / 255 - 1));
        if (saturation < 0.1) continue; // skip grays
        colors.push([r, g, b]);
      }

      if (colors.length === 0) {
        resolve({
          primary: "270 60% 50%",
          secondary: "174 50% 45%",
          accent: "38 90% 55%",
        });
        return;
      }

      // Simple k-means with 3 clusters
      const clusters = kMeans(colors, 3);
      const hslClusters = clusters.map(rgbToHsl).sort((a, b) => b[1] - a[1]); // sort by saturation

      resolve({
        primary: `${Math.round(hslClusters[0][0])} ${Math.round(hslClusters[0][1])}% ${Math.round(hslClusters[0][2])}%`,
        secondary: hslClusters.length > 1
          ? `${Math.round(hslClusters[1][0])} ${Math.round(hslClusters[1][1])}% ${Math.round(hslClusters[1][2])}%`
          : `${Math.round((hslClusters[0][0] + 120) % 360)} ${Math.round(hslClusters[0][1] * 0.7)}% ${Math.round(hslClusters[0][2])}%`,
        accent: hslClusters.length > 2
          ? `${Math.round(hslClusters[2][0])} ${Math.round(hslClusters[2][1])}% ${Math.round(hslClusters[2][2])}%`
          : `${Math.round((hslClusters[0][0] + 60) % 360)} 80% 55%`,
      });
    };
    img.onerror = () => {
      resolve({
        primary: "270 60% 50%",
        secondary: "174 50% 45%",
        accent: "38 90% 55%",
      });
    };
    img.src = URL.createObjectURL(file);
  });
}

function rgbToHsl(rgb: [number, number, number]): [number, number, number] {
  const r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
      case g: h = ((b - r) / d + 2) * 60; break;
      case b: h = ((r - g) / d + 4) * 60; break;
    }
  }

  return [h, s * 100, l * 100];
}

function kMeans(colors: [number, number, number][], k: number): [number, number, number][] {
  // Pick initial centroids spread across the data
  const step = Math.max(1, Math.floor(colors.length / k));
  let centroids: [number, number, number][] = Array.from({ length: k }, (_, i) =>
    colors[Math.min(i * step, colors.length - 1)]
  );

  for (let iter = 0; iter < 10; iter++) {
    const clusters: [number, number, number][][] = Array.from({ length: k }, () => []);

    for (const c of colors) {
      let minDist = Infinity, idx = 0;
      for (let i = 0; i < k; i++) {
        const d = (c[0] - centroids[i][0]) ** 2 + (c[1] - centroids[i][1]) ** 2 + (c[2] - centroids[i][2]) ** 2;
        if (d < minDist) { minDist = d; idx = i; }
      }
      clusters[idx].push(c);
    }

    centroids = clusters.map((cl, i) => {
      if (cl.length === 0) return centroids[i];
      return [
        Math.round(cl.reduce((s, c) => s + c[0], 0) / cl.length),
        Math.round(cl.reduce((s, c) => s + c[1], 0) / cl.length),
        Math.round(cl.reduce((s, c) => s + c[2], 0) / cl.length),
      ] as [number, number, number];
    });
  }

  return centroids;
}
