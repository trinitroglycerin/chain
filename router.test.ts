import { Router, routeVars, Middleware } from "./mod.ts";
import type { ConnInfo } from "https://deno.land/std@0.108.0/http/mod.ts";
import { assertEquals } from "https://deno.land/std@0.108.0/testing/asserts.ts";

const TEST_BASE_URL = new URL("http://example.com");

const setValueMiddleware: Middleware = (next) => (req, connInfo, ctx) => {
  return next(req, connInfo, ctx.withValue("foo", "bar"));
};

const readValueToBodyMiddleware: Middleware = (_next) => {
  return (_req, _connInfo, ctx) => {
    const body = {
      foo: ctx.value("foo"),
    };

    return new Response(JSON.stringify(body), {
      headers: [["content-type", "application/json; encoding=utf8"]],
    });
  };
};

const dumpInfoMiddleware: Middleware = (_next) => {
  return (req, _info, ctx) => {
    const strings = [`${req.method} ${req.url}`];
    const vars = routeVars(ctx);
    if (vars.size > 0) {
      const params = new URLSearchParams();
      for (const [k, v] of vars) {
        params.set(k, v);
      }

      strings.push(params.toString());
    }

    const body = strings.join("\n");
    return new Response(body, {
      headers: [["content-type", "text/plain; encoding=utf8"]],
    });
  };
};

async function testHandleRequest(
  router: Router,
  request: Request
): Promise<Response> {
  const handle = router.handler();
  return await handle(request, {} as unknown as ConnInfo);
}

Deno.test({
  name: "can handle simple GET requests",
  async fn() {
    const router = new Router();
    router.get("/", dumpInfoMiddleware);
    router.post("/", dumpInfoMiddleware);
    const uri = new URL("/", TEST_BASE_URL);
    const request = new Request(uri.href, { method: "get" });
    const response = await testHandleRequest(router, request);
    assertEquals(await response.text(), `GET ${uri.href}`);
  },
});

Deno.test({
  name: "can handle simple GET requests with vars",
  async fn() {
    const router = new Router();
    router.get("/{foo}", dumpInfoMiddleware);
    const uri = new URL("/1234", TEST_BASE_URL);
    const request = new Request(uri.href, { method: "get" });
    const response = await testHandleRequest(router, request);
    const txt = await response.text();
    const [, vars] = txt.split("\n");
    assertEquals(vars, new URLSearchParams({ foo: "1234" }).toString());
  },
});

Deno.test({
  name: "middleware chain works as expected",
  async fn() {
    const router = new Router();
    router.use(setValueMiddleware, readValueToBodyMiddleware);
    const uri = new URL("/foo", TEST_BASE_URL);
    const request = new Request(uri.href);
    const response = await testHandleRequest(router, request);
    assertEquals(await response.json(), { foo: "bar" });
  },
});
