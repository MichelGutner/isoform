import type { ModuleName } from '../config';
import { warnOnce } from './dev';

/**
 * Aviso de dev quando um módulo desligado é usado. O componente não quebra:
 * renderiza um espaço vazio com o mesmo estilo (o layout não pula).
 */
export function warnModuleDisabled(name: ModuleName): void {
  warnOnce(
    `module-off:${name}`,
    `módulo "${name}" desligado. Ligue com configure({ modules: { ${name}: true } }).`,
  );
}
