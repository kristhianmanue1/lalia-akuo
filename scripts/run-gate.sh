#!/bin/sh
# Gate local de lalia-akuo: los tres componentes, con intérprete fijado.
#
# El gate exige Python >= 3.12 (decisión del operador del 13-oct-2026).
# Prefiere el venv del proyecto; GATE_PYTHON lo rebasa —sólo para pruebas.
# Procedencia: docs/estandar-diseno-software-github.md §5.4; el CI de este
# proyecto es local (17-oct-2026: GitHub sin créditos para Actions).
set -eu

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

PY="${GATE_PYTHON:-}"
if [ -z "$PY" ]; then
  if [ -x .venv/bin/python ]; then
    PY=.venv/bin/python
  else
    PY=python3
  fi
fi

# Falla cerrado si el intérprete es menor que 3.12: el requisito no se
# negocia en silencio ni se degrada a «cualquiera que haya».
"$PY" - "$PY" <<'EOF'
import sys
executable = sys.argv[1]
if sys.version_info < (3, 12):
    print(
        "BLOQ — el gate exige Python >= 3.12 y {} es {}. Usa el .venv del "
        "proyecto o instala 3.12+ (GATE_PYTHON sólo para pruebas).".format(
            executable, sys.version.split()[0]),
        file=sys.stderr,
    )
    raise SystemExit(1)
EOF

"$PY" scripts/check_sizes.py
"$PY" -m unittest discover -s tests
npm test
