import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import path from "node:path";
import { verifySession } from "@/lib/auth";

let running = false;

export async function POST() {
  const adminId = await verifySession();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      {
        error:
          "Local scrape can only be triggered from a dev server (NODE_ENV !== production). " +
          "On the operator laptop, run `npm run dev` and trigger from localhost, or run `npm run scrape:otrucking` in a terminal.",
      },
      { status: 501 }
    );
  }

  if (running) {
    return NextResponse.json({ error: "A local scrape is already running on this server." }, { status: 409 });
  }

  const cwd = process.cwd();
  const isWindows = process.platform === "win32";
  const cmd = isWindows ? "npm.cmd" : "npm";

  try {
    const child = spawn(cmd, ["run", "scrape:otrucking"], {
      cwd,
      detached: !isWindows,
      stdio: "ignore",
      env: process.env,
    });
    if (!isWindows) child.unref();

    running = true;
    child.on("exit", () => {
      running = false;
    });
    child.on("error", () => {
      running = false;
    });

    return NextResponse.json({
      started: true,
      pid: child.pid,
      logFile: path.join(cwd, "scrape-progress.jsonl"),
    });
  } catch (e) {
    running = false;
    return NextResponse.json(
      { error: `Failed to spawn scraper: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 }
    );
  }
}
