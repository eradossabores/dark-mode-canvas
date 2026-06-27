/// <reference types="vite/client" />

// vite-imagetools: any image import with query params (?format=webp etc.)
declare module "*.png?*" {
  const src: string;
  export default src;
}
declare module "*.jpg?*" {
  const src: string;
  export default src;
}
declare module "*.jpeg?*" {
  const src: string;
  export default src;
}
