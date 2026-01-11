declare module "hono" {
  export class Hono {
    use(path: string, ...handlers: any[]): void;
    get(path: string, handler: (c: any) => any): void;
    post(path: string, handler: (c: any) => any): void;
  }
}

declare module "hono/cors" {
  export function cors(options?: any): any;
}

declare module "@hono/trpc-server" {
  export function trpcServer(options: any): any;
}

declare module "@trpc/server" {
  export function initTRPC(): {
    context(): {
      create(options?: any): {
        router: (routes: any) => any;
        procedure: {
          input: (schema: any) => any;
          query: (fn: any) => any;
          mutation: (fn: any) => any;
          use: (fn: any) => any;
        };
      };
    };
  };
}

declare module "@trpc/server/adapters/fetch" {
  export interface FetchCreateContextFnOptions {
    req: Request;
    resHeaders: Headers;
  }
}

declare module "superjson" {
  const superjson: any;
  export default superjson;
}

declare module "zod" {
  interface ZodString {
    email: () => any;
    min: (len: number) => any;
    optional: () => any;
  }
  interface ZodNumber {
    optional: () => any;
    default: (val: number) => any;
  }
  interface ZodObject {
    optional: () => any;
  }
  interface ZodArray {
    optional: () => any;
  }
  export const z: {
    object: (shape: Record<string, any>) => ZodObject;
    string: () => ZodString;
    number: () => ZodNumber;
    boolean: () => any;
    array: (type: any) => ZodArray;
    enum: (values: readonly string[]) => any;
    any: () => any;
  };
}
