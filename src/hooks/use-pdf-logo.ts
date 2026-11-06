import { useEffect, useState } from "react";
import { loadPdfLogo } from "@/lib/pdf-logo";

export function usePdfLogo(url?: string | null): string {
  const [image, setImage] = useState("");
  useEffect(() => {
    let active = true;
    setImage("");
    loadPdfLogo(url).then((loaded) => {
      if (active) setImage(loaded);
    }).catch(() => {
      // Do not display another factory's logo when loading fails.
      if (active) setImage("");
    });
    return () => { active = false; };
  }, [url]);
  return image;
}