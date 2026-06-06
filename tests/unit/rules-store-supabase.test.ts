import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/supabase/admin", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

import { sampleRules } from "@/lib/domain/sample-rules";
import { listRules } from "@/server/stores/rules-store";
import { getSupabaseAdminClient } from "@/server/supabase/admin";

const mockedGetSupabaseAdminClient = vi.mocked(getSupabaseAdminClient);

describe("rules store with Supabase persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps built-in rules available when the remote import_rules table is empty", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });

    const query = {
      select: vi.fn(),
      order,
    };
    query.select.mockReturnValue(query);

    mockedGetSupabaseAdminClient.mockReturnValue({
      from: vi.fn(() => query),
    } as never);

    const rules = await listRules();

    expect(rules.length).toBeGreaterThanOrEqual(sampleRules.length);
    expect(rules.some((rule) => rule.id === "card-transfer-excel")).toBe(true);
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
  });
});
