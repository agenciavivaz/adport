import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/context';
import { ok, fail, unauthorized } from '@/lib/api/respond';

const schema = z.object({ token: z.string().min(10) });

/** Aceita convite via RPC SECURITY DEFINER (valida digest, expiração e email). */
export async function POST(request: Request) {
  const { supabase, user } = await getCurrentUser();
  if (!user) return unauthorized();

  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) return fail(422, 'validation_error', 'Token ausente.');

  const { data, error } = await supabase.rpc('accept_invitation', { p_token: parsed.data.token });
  if (error) {
    return fail(400, 'invitation_invalid', 'Convite inválido, expirado ou email divergente.');
  }
  return ok({ membership_id: data });
}
