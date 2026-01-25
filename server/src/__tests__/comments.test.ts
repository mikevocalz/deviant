import { vi, describe, it, expect, beforeEach } from "vitest";
import { testClient } from "hono/testing";

const mockFind = vi.fn();
const mockFindByID = vi.fn();
const mockCreate = vi.fn();
const mockMe = vi.fn();

vi.mock("../lib/payload", () => ({
  payloadClient: {
    find: (...args: unknown[]) => mockFind(...args),
    findByID: (...args: unknown[]) => mockFindByID(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    me: (...args: unknown[]) => mockMe(...args),
  },
  getCookiesFromRequest: (req: Request) =>
    req.headers.get("Cookie") ?? undefined,
}));

import app from "./test-app";

const client = testClient(app);

describe("GET /api/comments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when postId is missing", async () => {
    const res = await client.api.comments.$get({ query: {} });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error", "postId is required");
    expect(mockFind).not.toHaveBeenCalled();
  });

  it("returns comments when postId provided", async () => {
    const docs = [
      {
        id: "c1",
        content: "First comment",
        author: { id: "u1", username: "alice" },
        post: "p1",
        createdAt: "2024-01-01T00:00:00Z",
        likes: 0,
      },
    ];
    mockFind.mockResolvedValue({
      docs,
      totalDocs: 1,
      limit: 20,
      page: 1,
      totalPages: 1,
      pagingCounter: 1,
      hasPrevPage: false,
      hasNextPage: false,
      prevPage: null,
      nextPage: null,
    });

    const res = await client.api.comments.$get({
      query: { postId: "p1", limit: "20", page: "1", depth: "2" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.docs).toEqual(docs);
    expect(body.totalDocs).toBe(1);
    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "comments",
        limit: 20,
        page: 1,
        depth: 2,
        sort: "-createdAt",
        where: { post: { equals: "p1" }, parent: { exists: false } },
      }),
      undefined,
    );
  });

  it("caps limit at 100", async () => {
    mockFind.mockResolvedValue({
      docs: [],
      totalDocs: 0,
      limit: 100,
      page: 1,
      totalPages: 0,
      pagingCounter: 1,
      hasPrevPage: false,
      hasNextPage: false,
      prevPage: null,
      nextPage: null,
    });
    await client.api.comments.$get({
      query: { postId: "p1", limit: "999" },
    });
    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 100 }),
      undefined,
    );
  });

  it("returns 500 when Payload find throws", async () => {
    mockFind.mockRejectedValue(new Error("Payload CMS is not configured"));
    const res = await client.api.comments.$get({
      query: { postId: "p1" },
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});

describe("POST /api/comments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when body is missing", async () => {
    const res = await client.api.comments.$post({
      json: {} as unknown as Record<string, unknown>,
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/request body|post and text/i);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("returns 400 when post or text is missing", async () => {
    const res = await client.api.comments.$post({
      json: { post: "p1" },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/post and text are required/i);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("returns 400 when text is empty after trim", async () => {
    const res = await client.api.comments.$post({
      json: { post: "p1", text: "   " },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/comment text cannot be empty/i);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("returns 401 when author cannot be resolved", async () => {
    mockMe.mockResolvedValue(null);
    mockFindByID.mockRejectedValue(new Error("not found"));
    mockFind.mockResolvedValue({ docs: [] });

    const res = await client.api.comments.$post({
      json: {
        post: "p1",
        text: "Hello",
        authorUsername: "nobody",
      },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/user not found|logging in/i);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("creates comment when authorId is valid", async () => {
    mockMe.mockResolvedValue(null);
    mockFindByID.mockResolvedValue({ id: "u1", username: "alice" });
    const created = {
      id: "c1",
      content: "Hello",
      author: "u1",
      post: "p1",
      createdAt: "2024-01-01T00:00:00Z",
      likes: 0,
    };
    mockCreate.mockResolvedValue(created);

    const res = await client.api.comments.$post({
      json: {
        post: "p1",
        text: "Hello",
        authorId: "u1",
      },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual(created);
    expect(mockFindByID).toHaveBeenCalledWith("users", "u1", 0, undefined);
    expect(mockCreate).toHaveBeenCalledWith(
      "comments",
      expect.objectContaining({
        post: "p1",
        content: "Hello",
        author: "u1",
      }),
      undefined,
      2,
    );
  });

  it("creates comment when me() returns user and authorId not provided", async () => {
    mockMe.mockResolvedValue({ id: "u2", username: "bob" });
    mockFindByID.mockResolvedValue({ id: "u2", username: "bob" });
    const created = {
      id: "c2",
      content: "From me()",
      author: "u2",
      post: "p1",
      createdAt: "2024-01-01T00:00:00Z",
      likes: 0,
    };
    mockCreate.mockResolvedValue(created);

    const res = await client.api.comments.$post({
      json: { post: "p1", text: "From me()" },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual(created);
    expect(mockMe).toHaveBeenCalled();
    expect(mockFindByID).toHaveBeenCalledWith("users", "u2", 0, undefined);
    expect(mockCreate).toHaveBeenCalledWith(
      "comments",
      expect.objectContaining({
        post: "p1",
        content: "From me()",
        author: "u2",
      }),
      undefined,
      2,
    );
  });

  it("creates comment with parent when parent provided", async () => {
    mockMe.mockResolvedValue(null);
    mockFindByID.mockResolvedValue({ id: "u1" });
    const created = {
      id: "c3",
      content: "Reply",
      author: "u1",
      post: "p1",
      parent: "c0",
      createdAt: "2024-01-01T00:00:00Z",
      likes: 0,
    };
    mockCreate.mockResolvedValue(created);

    const res = await client.api.comments.$post({
      json: {
        post: "p1",
        text: "Reply",
        authorId: "u1",
        parent: "c0",
      },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith(
      "comments",
      expect.objectContaining({
        post: "p1",
        content: "Reply",
        author: "u1",
        parent: "c0",
      }),
      undefined,
      2,
    );
  });

  it("resolves author by username when authorId not provided", async () => {
    mockMe.mockResolvedValue(null);
    mockFindByID.mockRejectedValue(new Error("not found"));
    mockFind.mockResolvedValueOnce({ docs: [{ id: "u3", username: "charlie" }] });
    const created = {
      id: "c4",
      content: "By username",
      author: "u3",
      post: "p1",
      createdAt: "2024-01-01T00:00:00Z",
      likes: 0,
    };
    mockCreate.mockResolvedValue(created);

    const res = await client.api.comments.$post({
      json: {
        post: "p1",
        text: "By username",
        authorUsername: "charlie",
      },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual(created);
    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "users",
        where: { username: { equals: "charlie" } },
        limit: 1,
      }),
      undefined,
    );
    expect(mockCreate).toHaveBeenCalledWith(
      "comments",
      expect.objectContaining({ content: "By username", author: "u3" }),
      undefined,
      2,
    );
  });

  it("returns error status when Payload create throws", async () => {
    mockMe.mockResolvedValue(null);
    mockFindByID.mockResolvedValue({ id: "u1" });
    const err = new Error("The following field is invalid: Post") as Error & {
      status?: number;
    };
    err.status = 400;
    mockCreate.mockRejectedValue(err);

    const res = await client.api.comments.$post({
      json: { post: "p1", text: "Hi", authorId: "u1" },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});
