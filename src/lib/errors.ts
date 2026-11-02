export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function errorResponse(err: unknown): Response {
  if (err instanceof AppError) {
    return Response.json({ error: err.code, message: err.message }, { status: err.status });
  }
  console.error(err);
  return Response.json({ error: "internal", message: "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง" }, { status: 500 });
}
