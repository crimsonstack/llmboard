import { NextResponse } from "next/server";
import { listSetups } from "@/lib/store/setupStore";

export async function GET() {
  try {
    const rows = await listSetups();
    const setups = rows.map(r => ({ id: r.id, name: r.name, description: r.description, createdAt: r.createdAt }));
    return NextResponse.json({ ok: true, setups });
  } catch (e: any) {
    return NextResponse.json({ ok: false, code: "LIST_SETUPS_FAILED", message: e?.message || "Failed to list setups" }, { status: 500 });
  }
}
