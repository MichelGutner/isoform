/**
 * Babel plugin (optional): marks the style functions that never read the theme, so the isoform JSX
 * runtime can render those components without their wrapper component.
 *
 *   // babel.config.js
 *   presets: [['babel-preset-expo', { jsxImportSource: '@michelgutner/isoform' }]],
 *   plugins: ['@michelgutner/isoform/babel'],
 *
 * Only files that import from the library are touched. In them, a function passed to `engine()`,
 * `.style()`, `.when()` or `.attrs()` (or as `style` inside an attrs object) is wrapped in `themeFree()`
 * when the code proves it cannot read the theme: it takes no argument, destructures only `props` and
 * `platform`, or uses its argument only as `ctx.props` / `ctx.platform`, and it never mentions
 * `getTheme`, `useTheme` or `themeStore`. Anything else is left as is, and keeps its wrapper.
 */
const LIBRARY = '@michelgutner/isoform';

/** Builder methods whose arguments can hold style functions. */
const METHODS = new Set(['style', 'when', 'attrs']);

/** What a style function may read from its argument without depending on the theme. */
const CONTEXT_KEYS = new Set(['props', 'platform']);

/** Ways to reach the theme without the style argument. */
const THEME_ACCESS = new Set(['getTheme', 'useTheme', 'themeStore', 'arguments']);

module.exports = function isoformBabelPlugin({ types: t }) {
  const keyName = (key) => (t.isIdentifier(key) ? key.name : t.isStringLiteral(key) ? key.value : null);

  /** `({ props })`, `({ props: { size }, platform })`: only keys that cannot be the theme. */
  const patternIsThemeFree = (pattern) =>
    pattern.properties.every(
      (property) => t.isObjectProperty(property) && !property.computed && CONTEXT_KEYS.has(keyName(property.key)),
    );

  /** `(ctx) => ctx.props.size`: the argument is only ever read as `ctx.props` or `ctx.platform`. */
  const identifierIsThemeFree = (fn, name) => {
    const binding = fn.scope.getBinding(name);
    if (!binding || binding.constantViolations.length) return false;
    return binding.referencePaths.every((ref) => {
      const parent = ref.parentPath;
      return (
        parent.isMemberExpression() &&
        parent.node.object === ref.node &&
        !parent.node.computed &&
        CONTEXT_KEYS.has(keyName(parent.node.property))
      );
    });
  };

  /** The body (nested functions included) never names a way to reach the theme. */
  const bodyIsThemeFree = (fn) => {
    let free = true;
    fn.traverse({
      Identifier(id) {
        if (THEME_ACCESS.has(id.node.name) && id.isReferencedIdentifier()) {
          free = false;
          id.stop();
        }
      },
    });
    return free;
  };

  const paramIsThemeFree = (fn) => {
    const { params } = fn.node;
    if (params.length === 0) return true;
    if (params.length > 1) return false;
    const [param] = params;
    if (t.isObjectPattern(param)) return patternIsThemeFree(param);
    if (t.isIdentifier(param)) return identifierIsThemeFree(fn, param.name);
    return false;
  };

  const isFunction = (path) => path.isArrowFunctionExpression() || path.isFunctionExpression();

  return {
    name: 'isoform',
    visitor: {
      Program(program) {
        const imports = program.node.body.filter((node) => t.isImportDeclaration(node) && node.source.value === LIBRARY);
        if (!imports.length) return;

        const engineNames = new Set();
        for (const declaration of imports) {
          for (const specifier of declaration.specifiers) {
            if (t.isImportSpecifier(specifier) && keyName(specifier.imported) === 'engine') {
              engineNames.add(specifier.local.name);
            }
          }
        }

        let helper = null;
        const mark = (fn) => {
          if (!isFunction(fn) || !paramIsThemeFree(fn) || !bodyIsThemeFree(fn)) return;
          helper ??= program.scope.generateUidIdentifier('isoThemeFree');
          fn.replaceWith(t.callExpression(t.cloneNode(helper), [fn.node]));
        };

        /** `{ style: ({ props }) => … }` inside an attrs object. */
        const markObject = (object) => {
          for (const property of object.get('properties')) {
            if (property.isObjectProperty() && !property.node.computed && keyName(property.node.key) === 'style') {
              mark(property.get('value'));
            }
          }
        };

        const isStyleCall = (call) => {
          const callee = call.node.callee;
          if (t.isIdentifier(callee)) return engineNames.has(callee.name);
          return t.isMemberExpression(callee) && !callee.computed && METHODS.has(keyName(callee.property));
        };

        program.traverse({
          CallExpression(call) {
            if (!isStyleCall(call)) return;
            for (const argument of call.get('arguments')) {
              if (argument.isObjectExpression()) markObject(argument);
              else mark(argument);
            }
          },
        });

        if (helper) {
          program.unshiftContainer(
            'body',
            t.importDeclaration([t.importSpecifier(helper, t.identifier('themeFree'))], t.stringLiteral(LIBRARY)),
          );
        }
      },
    },
  };
};
