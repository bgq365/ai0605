import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/stores/shipments-store", () => ({
  commitShipments: vi.fn(),
}));

import { POST as importsCommitPost } from "@/app/api/imports/commit/route";
import { commitShipments } from "@/server/stores/shipments-store";
import { getSupabaseAdminCredentials } from "@/server/supabase/admin";

const mockedCommitShipments = vi.mocked(commitShipments);

describe("persistence behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a 503 when shipment persistence fails", async () => {
    mockedCommitShipments.mockRejectedValueOnce(new Error("Supabase persistence is unavailable"));

    const response = await importsCommitPost(
      new Request("http://localhost/api/imports/commit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shipments: [
            {
              externalCode: "SO-100",
              storeName: "Test Store",
              items: [{ skuCode: "SKU-1", skuName: "Item", quantity: 1 }],
              sourceRowIds: [],
            },
          ],
        }),
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: "Supabase persistence is unavailable",
    });
  });

  it("resolves Supabase admin credentials from Vercel marketplace variables", () => {
    const previousUrl = process.env.SUPABASE_URL;
    const previousPublicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const previousServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const previousSecretKey = process.env.SUPABASE_SECRET_KEY;

    process.env.SUPABASE_URL = "";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
    process.env.SUPABASE_SECRET_KEY = "service-secret";

    expect(getSupabaseAdminCredentials()).toEqual({
      url: "https://example.supabase.co",
      serviceRoleKey: "service-secret",
    });

    process.env.SUPABASE_URL = previousUrl;
    process.env.NEXT_PUBLIC_SUPABASE_URL = previousPublicUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceRole;
    process.env.SUPABASE_SECRET_KEY = previousSecretKey;
  });
});
