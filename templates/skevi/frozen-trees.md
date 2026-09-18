# Árboles congelados: código que no se edita

> Plantilla de adopción (PROP-009; ADR-033). Copia este archivo a tu
> `.skevi/` **sólo si tu proyecto tiene árboles congelados**; si no,
> no lo copies. Reemplaza cada `<...>` con el dato real.

## Cuándo aplica

Un **árbol congelado** es código que no se edita en sitio: el export de
una herramienta generadora (FlutterFlow y similares), una entrega de
tercero, un baseline de release sellado. La autoría es irrelevante —
humano, agente de IA o generador—: lo define el régimen, no quién lo
escribió. Si el árbol se edita y se mantiene como parte de tu proyecto,
no es congelado y esta plantilla no aplica.

## Relación con §3.1: régimen, no autoría

En los árboles editables de tu proyecto, la regla del estándar §3.1
vale completa para cualquiera que escriba código nuevo — humano o
agente de IA: el código nuevo se parece al código que lo rodea.

En el árbol congelado la regla es **la opuesta**: el código vecino no
se imita ni se toca. Trabaja en tu copia canónica, nunca sobre el
export.

## Baseline por derivación (gate mínimo)

Protege el árbol con una línea base **derivada por comando**, nunca
editada a mano:

1. **Default deny:** nada muta el árbol congelado salvo lo que la
   allowlist permite explícitamente.
2. **Baseline derivado:** listado de rutas + SHA-256 por archivo,
   generado y versionado:

   ```bash
   git ls-tree -r <commit> --name-only <ruta-del-arbol>   # rutas
   find <ruta-del-arbol> -type f -exec sha256sum {} \;    # digests
   ```

3. **Fallo cerrado** ante alta, baja, symlink o drift de cualquier
   archivo del árbol.
4. **Cuarentena y promoción:** los cambios permitidos (parches de la
   allowlist) se aplican sobre la copia canónica, se verifican contra
   el baseline y se promueven con registro — nunca en silencio.

## Parche frágil

Los re-exports de la herramienta generadora destruyen los parches
manuales. Por eso: los parches viven documentados en la copia
canónica, se reaplican tras cada re-export, y cada reaplicación se
verifica contra el baseline de arriba.

## Convivencia con el gate de Skevi

Declara en tu `skevi-gate.json`:

```json
{
  "skip_dirs": ["<ruta-del-arbol-congelado>"],
  "exempt_paths": ["<ruta-del-arbol-congelado>/...si aplica"]
}
```

La contención de tamaño no significa nada sobre código congelado: lo
protege tu gate de integridad, no el límite de líneas.

## Procedencia

Aterriza la iniciativa A-2 de PROP-002 (decisión 2026-08-15) y el caso
flutterFlow @ `2e0f9cf` (issue #43). Encuadre: el régimen del árbol, no
la autoría del código (instrucción directa del humano, 2026-09-13).
