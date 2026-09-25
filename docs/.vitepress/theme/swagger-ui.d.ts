declare module 'swagger-ui' {
  interface SwaggerUIOptions {
    url: string;
    domNode: HTMLElement;
    presets: unknown[];
    layout?: string;
  }
  interface SwaggerUIBundleFn {
    (options: SwaggerUIOptions): unknown;
    presets: { apis: unknown };
  }
  const SwaggerUIBundle: SwaggerUIBundleFn;
  export default SwaggerUIBundle;
}

declare module 'swagger-ui/dist/swagger-ui-standalone-preset' {
  const preset: unknown;
  export default preset;
}

declare module 'swagger-ui/dist/swagger-ui.css';
