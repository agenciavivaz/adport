import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/context';
import { ok, created, fail, unauthorized } from '@/lib/api/respond';

const createSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(62)
    .regex(/^[a-z0-9](?:[a-z0-9-]{0,60}[a-z0-9])?$/, 'slug inválido'),
});

/** Lista as organizações do usuário (RLS limita ao membership). */
export async function GET() {
  const { supabase, user } = await getCurrentUser();
  if (!user) return unauthorized();

  const { data, error } = await supabase
    .from('organizations')
    .select('id, slug, name, status')
    .order('name');
  if (error) return fail(500, 'db_error', 'Falha ao listar organizações.');
  return ok(data ?? []);
}

/** Cria uma organização (usuário vira owner) via RPC atômica. */
export async function POST(request: Request) {
  const { supabase, user } = await getCurrentUser();
  if (!user) return unauthorized();

  const json = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return fail(422, 'validation_error', 'Dados inválidos.', parsed.error.flatten());
  }

  const { data, error } = await supabase.rpc('create_organization', {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
  });
  if (error) {
    if (error.message.includes('duplicate') || error.code === '23505') {
      return fail(409, 'slug_taken', 'Este slug já está em uso.');
    }
    return fail(500, 'db_error', 'Falha ao criar organização.');
  }
  return created({ id: data, slug: parsed.data.slug });
}
