import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function backendUrl(request: NextRequest, segments: string[]): string {
  const configured = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const base = configured.replace(/\/$/, "");
  const url = new URL(`${base}/${segments.join("/")}`);
  url.search = request.nextUrl.search;
  return url.toString();
}

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const headers = new Headers();
  const authorization = request.headers.get("authorization");
  const contentType = request.headers.get("content-type");
  if (authorization) headers.set("authorization", authorization);
  if (contentType) headers.set("content-type", contentType);

  try {
    const response = await fetch(backendUrl(request, path), {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
      cache: "no-store",
      redirect: "manual"
    });

    const responseHeaders = new Headers();
    const responseContentType = response.headers.get("content-type");
    if (responseContentType) responseHeaders.set("content-type", responseContentType);

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    });
  } catch (error) {
    console.error("Coach API proxy error", error);
    return NextResponse.json(
      {
        detail: "The Coach AI server could not be reached. Set API_URL on the web deployment to the public FastAPI service URL."
      },
      { status: 503 }
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
