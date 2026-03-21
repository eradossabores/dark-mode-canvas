import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";
import * as THREE from "three";

type DottedSurfaceProps = Omit<React.ComponentProps<"div">, "ref">;

const hslTokenToHex = (token: string) => {
  const [h, s, l] = token.split(" ").map((value) => parseFloat(value));

  if ([h, s, l].some(Number.isNaN)) return "#0f172a";

  const saturation = s / 100;
  const lightness = l / 100;
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lightness - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;

  if (h >= 0 && h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  const toHex = (channel: number) =>
    Math.round((channel + m) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const getScenePalette = () => {
  const styles = getComputedStyle(document.documentElement);

  return {
    foreground: hslTokenToHex(styles.getPropertyValue("--foreground").trim()),
    primary: hslTokenToHex(styles.getPropertyValue("--primary").trim()),
    accent: hslTokenToHex(styles.getPropertyValue("--accent").trim()),
    background: hslTokenToHex(styles.getPropertyValue("--background").trim()),
  };
};

export function DottedSurface({ className, ...props }: DottedSurfaceProps) {
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const palette = getScenePalette();
    const isDark = resolvedTheme === "dark";
    const separation = 110;
    const amountX = 34;
    const amountY = 52;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(palette.background, 1400, 5200);

    const camera = new THREE.PerspectiveCamera(
      58,
      container.clientWidth / container.clientHeight,
      1,
      10000,
    );
    camera.position.set(0, 300, 980);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(scene.fog.color, 0);
    container.appendChild(renderer.domElement);

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(amountX * amountY * 3);
    const colors = new Float32Array(amountX * amountY * 3);

    const primaryColor = new THREE.Color(palette.primary);
    const accentColor = new THREE.Color(palette.accent);
    const foregroundColor = new THREE.Color(palette.foreground);

    let pointer = 0;
    for (let ix = 0; ix < amountX; ix++) {
      for (let iy = 0; iy < amountY; iy++) {
        const index = pointer * 3;
        positions[index] = ix * separation - (amountX * separation) / 2;
        positions[index + 1] = 0;
        positions[index + 2] = iy * separation - (amountY * separation) / 2;

        const blendTarget = (ix + iy) % 5 === 0 ? accentColor : primaryColor;
        const mixed = foregroundColor.clone().lerp(blendTarget, isDark ? 0.72 : 0.58);
        colors[index] = mixed.r;
        colors[index + 1] = mixed.g;
        colors[index + 2] = mixed.b;
        pointer++;
      }
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: isDark ? 7 : 6,
      vertexColors: true,
      transparent: true,
      opacity: isDark ? 0.5 : 0.38,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    let count = 0;
    let animationId = 0;

    const animate = () => {
      animationId = requestAnimationFrame(animate);

      const positionAttribute = geometry.getAttribute("position") as THREE.BufferAttribute;
      const positionArray = positionAttribute.array as Float32Array;

      let i = 0;
      for (let ix = 0; ix < amountX; ix++) {
        for (let iy = 0; iy < amountY; iy++) {
          const index = i * 3;
          positionArray[index + 1] =
            Math.sin((ix + count) * 0.24) * 34 +
            Math.sin((iy + count) * 0.36) * 30;
          i++;
        }
      }

      positionAttribute.needsUpdate = true;
      points.rotation.z = Math.sin(count * 0.04) * 0.03;
      renderer.render(scene, camera);
      count += 0.08;
    };

    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener("resize", handleResize);
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [resolvedTheme]);

  return (
    <div
      ref={containerRef}
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      {...props}
    />
  );
}

export default DottedSurface;