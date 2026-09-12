/** Bootstrap do servidor: registra adapters conforme a configuração do ambiente. */
import { registerConfiguredAdapters } from '@ai/adport-adapter';

let done = false;
export function ensureAdaptersRegistered(): void {
  if (done) return;
  registerConfiguredAdapters();
  done = true;
}
