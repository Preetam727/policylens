// Polyfill browser globals (DOMMatrix, ImageData) for the Vercel serverless runtime.
// This is required because modern pdfjs-dist (used by pdf-parse) uses these classes
// which are not defined in the Node.js serverless/Edge environment.

const polyfillGlobals = () => {
  const g = typeof globalThis !== 'undefined' 
    ? globalThis 
    : typeof global !== 'undefined' 
      ? global 
      : {} as any;

  if (!g.DOMMatrix) {
    g.DOMMatrix = class DOMMatrix {
      a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
      constructor() {}
      toString() {
        return 'matrix(1, 0, 0, 1, 0, 0)';
      }
    };
  }

  if (!g.ImageData) {
    g.ImageData = class ImageData {
      width: number;
      height: number;
      data: Uint8ClampedArray;
      constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.data = new Uint8ClampedArray(width * height * 4);
      }
    };
  }
};

polyfillGlobals();
