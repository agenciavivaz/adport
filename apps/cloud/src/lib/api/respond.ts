/** Envelope de resposta/erro da API — PRD §14.1. */
import { NextResponse } from 'next/server';

let counter = 0;
export function requestId(): string {
  counter = (counter + 1) % 1_000_000;
  return `req_${Date.now().toString(36)}_${counter.toString(36)}`;
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, { status: 200, ...init });
}

export function created<T>(data: T) {
  return NextResponse.json({ data }, { status: 201 });
}

export interface ApiErrorBody {
  code: string;
  message: string;
  request_id: string;
  details?: unknown;
  retry_after?: number;
}

export function fail(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): NextResponse {
  const body: ApiErrorBody = { code, message, request_id: requestId() };
  if (details !== undefined) body.details = details;
  return NextResponse.json({ error: body }, { status });
}

/** 404 para objeto fora do escopo, sem revelar existência (§14.1). */
export function notFound() {
  return fail(404, 'not_found', 'Recurso não encontrado.');
}

export function unauthorized() {
  return fail(401, 'unauthorized', 'Sessão inválida.');
}

export function forbidden(reason = 'forbidden') {
  return fail(403, reason, 'Ação não permitida no seu escopo.');
}
