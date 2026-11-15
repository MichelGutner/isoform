import { updateTheme } from 'omnistyle';
// Mesma configuração dos outros exemplos (provider 'auto'); depois troca para o tema do Dende.
import '../omni.config';
import { tokens } from './theme';

updateTheme(tokens);
