import sidImg from "@/assets/sid.png";
import buckImg from "@/assets/buck.png";

type Character = "sid" | "buck";
type Position = "bottom-right" | "bottom-left" | "top-right" | "top-left";

const positionClasses: Record<Position, string> = {
  "bottom-right": "bottom-2 right-2",
  "bottom-left": "bottom-2 left-2",
  "top-right": "top-2 right-2",
  "top-left": "top-2 left-2",
};

const images: Record<Character, string> = {
  sid: sidImg,
  buck: buckImg,
};

interface Props {
  character: Character;
  position?: Position;
  size?: string;
  className?: string;
}

export default function IceAgeCharacter({
  character,
  position = "bottom-right",
  size = "w-28 h-28",
  className = "",
}: Props) {
  return (
    <img
      src={images[character]}
      alt=""
      aria-hidden
      className={`pointer-events-none select-none fixed opacity-[0.09] dark:opacity-[0.05] ${positionClasses[position]} ${size} object-contain ${className}`}
      style={{ zIndex: 0 }}
    />
  );
}
