import { NextRequest, NextResponse } from "next/server";

const ALLOWED_EXTENSIONS = [".gguf"];

export async function GET(req: NextRequest) {
  const targetUrl = req.nextUrl.searchParams.get("url");
  if (!targetUrl) {
    return NextResponse.json(
      { error: "Missing url parameter" },
      { status: 400 }
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  if (!ALLOWED_EXTENSIONS.some((ext) => parsed.pathname.endsWith(ext))) {
    return NextResponse.json(
      { error: "URL must point to a .gguf file" },
      { status: 400 }
    );
  }

  if (parsed.protocol !== "https:") {
    return NextResponse.json(
      { error: "Only HTTPS URLs allowed" },
      { status: 400 }
    );
  }

  const headers: Record<string, string> = {};
  const rangeHeader = req.headers.get("range");
  if (rangeHeader) {
    headers["Range"] = rangeHeader;
  }

  try {
    const upstream = await fetch(targetUrl, { headers });
    const responseHeaders = new Headers();

    for (const key of [
      "content-length",
      "content-range",
      "content-type",
      "accept-ranges",
    ]) {
      const val = upstream.headers.get(key);
      if (val) responseHeaders.set(key, val);
    }
    responseHeaders.set("Access-Control-Allow-Origin", "*");

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch upstream" },
      { status: 502 }
    );
  }
}

export async function HEAD(req: NextRequest) {
  const targetUrl = req.nextUrl.searchParams.get("url");
  if (!targetUrl) {
    return NextResponse.json(
      { error: "Missing url parameter" },
      { status: 400 }
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  if (!ALLOWED_EXTENSIONS.some((ext) => parsed.pathname.endsWith(ext))) {
    return NextResponse.json(
      { error: "URL must point to a .gguf file" },
      { status: 400 }
    );
  }

  if (parsed.protocol !== "https:") {
    return NextResponse.json(
      { error: "Only HTTPS URLs allowed" },
      { status: 400 }
    );
  }

  try {
    const upstream = await fetch(targetUrl, { method: "HEAD" });
    const responseHeaders = new Headers();
    for (const key of ["content-length", "content-type", "accept-ranges"]) {
      const val = upstream.headers.get(key);
      if (val) responseHeaders.set(key, val);
    }
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    return new NextResponse(null, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch upstream" },
      { status: 502 }
    );
  }
}
