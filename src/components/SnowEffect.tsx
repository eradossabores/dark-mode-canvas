import { useEffect, useRef } from "react";

const SNOWFLAKE_COUNT = 40;

interface Snowflake {
  x: number;
  y: number;
  r: number;
  speed: number;
  wind: number;
  opacity: number;
}

export default function SnowEffect() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let snowflakes: Snowflake[] = [];

    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
    }

    function createSnowflakes() {
      snowflakes = Array.from({ length: SNOWFLAKE_COUNT }, () => ({
        x: Math.random() * canvas!.width,
        y: Math.random() * canvas!.height,
        r: Math.random() * 2.5 + 1,
        speed: Math.random() * 0.6 + 0.2,
        wind: Math.random() * 0.4 - 0.2,
        opacity: Math.random() * 0.4 + 0.15,
      }));
    }

    function draw() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      for (const s of snowflakes) {
        ctx!.beginPath();
        ctx!.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(255, 255, 255, ${s.opacity})`;
        ctx!.fill();

        s.y += s.speed;
        s.x += s.wind + Math.sin(s.y * 0.01) * 0.3;

        if (s.y > canvas!.height) {
          s.y = -s.r;
          s.x = Math.random() * canvas!.width;
        }
        if (s.x > canvas!.width) s.x = 0;
        if (s.x < 0) s.x = canvas!.width;
      }
      animationId = requestAnimationFrame(draw);
    }

    resize();
    createSnowflakes();
    draw();

    window.addEventListener("resize", () => {
      resize();
      createSnowflakes();
    });

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[1]"
      aria-hidden="true"
    />
  );
}
