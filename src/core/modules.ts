import type { ModuleName } from '../config';
import { warnOnce } from './dev';

/**
 * Aviso de dev quando um módulo desligado é usado. O componente não quebra:
 * renderiza um espaço vazio com o mesmo estilo (o layout não pula).
 */
export function warnModuleDisabled(name: ModuleName): void {
  warnOnce(
    `module-off:${name}`,
    `ISO009: module "${name}" is off. Turn it on with configure({ modules: { ${name}: true } }).`,
  );
}
