#!/usr/bin/env bash
# is-ilani-radari installer
#
# Copies the Turkish portal skills (kariyernet-search, youthall-search) into one or
# more ai-job-search clones and, with --config, prepares the people config and the
# scheduled-task prompt. Idempotent: running it twice changes nothing. Existing files
# are never overwritten unless --force is given.
#
# Works with the bash 3.2 that ships with macOS.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORTALS=(kariyernet-search youthall-search)

FORCE=0
DO_CONFIG=0
DO_PERMISSIONS=0
DRY_RUN=0
CONFIG_DIR="${IS_ILANI_RADARI_CONFIG_DIR:-$HOME/.config/is-ilani-radari}"
PYTHON_BIN="${PYTHON:-}"
CLONES=()

usage() {
  cat <<'EOF'
Kullanım / Usage:
  ./install.sh [seçenekler] [<ai-job-search-klonu> ...]

Her verilen klonun .agents/skills/ klasörüne kariyernet-search ve youthall-search
portallarını kopyalar.

Seçenekler:
  --config            ~/.config/is-ilani-radari/people.json dosyasını (yoksa) örnekten
                      oluşturur ve scheduled-task/SKILL.md dosyasını şablondan üretir.
  --permissions       Her klonda .claude/settings.json "allow" listesine ve
                      tools/security_guards.py ALLOWED_PERMISSIONS kümesine iki portalın
                      `bun run` iznini ekler (zaten varsa dokunmaz). Gözetimsiz
                      zamanlanmış görevin izin sormadan çalışması için gerekir.
  --python PATH       Zamanlanmış görevde kullanılacak Python (>= 3.10). Varsayılan:
                      PYTHON ortam değişkeni, yoksa PATH'te bulunan ilk python3.1x.
  --config-dir DIR    Yapılandırma klasörü (varsayılan: ~/.config/is-ilani-radari,
                      ya da IS_ILANI_RADARI_CONFIG_DIR).
  --force             Var olan portal klasörlerinin, people.json'un ve SKILL.md'nin
                      üzerine yazar.
  --dry-run           Hiçbir şey yazmadan ne yapılacağını gösterir.
  -h, --help          Bu yardımı gösterir.

Örnek:
  ./install.sh --permissions ~/Projeler/ai-job-search-deniz ~/Projeler/ai-job-search-ece
  ./install.sh --config --python "$(command -v python3.12)"
EOF
}

log()  { printf '%s\n' "$*"; }
warn() { printf 'UYARI: %s\n' "$*" >&2; }
die()  { printf 'HATA: %s\n' "$*" >&2; exit 1; }

run() {
  # Print the command in dry-run mode, otherwise execute it.
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '[dry-run]'; printf ' %q' "$@"; printf '\n'
  else
    "$@"
  fi
}

while [ $# -gt 0 ]; do
  case "$1" in
    --config) DO_CONFIG=1 ;;
    --permissions) DO_PERMISSIONS=1 ;;
    --force) FORCE=1 ;;
    --dry-run) DRY_RUN=1 ;;
    --python)
      [ $# -ge 2 ] || die "--python bir yol ister"
      PYTHON_BIN="$2"; shift ;;
    --python=*) PYTHON_BIN="${1#--python=}" ;;
    --config-dir)
      [ $# -ge 2 ] || die "--config-dir bir yol ister"
      CONFIG_DIR="$2"; shift ;;
    --config-dir=*) CONFIG_DIR="${1#--config-dir=}" ;;
    -h|--help) usage; exit 0 ;;
    --) shift; while [ $# -gt 0 ]; do CLONES+=("$1"); shift; done; break ;;
    -*) usage >&2; die "bilinmeyen seçenek: $1" ;;
    *) CLONES+=("$1") ;;
  esac
  shift
done

if [ "${#CLONES[@]}" -eq 0 ] && [ "$DO_CONFIG" -eq 0 ]; then
  usage >&2
  die "en az bir klon yolu veya --config gerekli"
fi

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Any python3 is enough for the small JSON/text edits this script makes.
helper_python() {
  if command -v python3 >/dev/null 2>&1; then
    command -v python3
  else
    die "python3 bulunamadı (yapılandırma adımları için gerekli)"
  fi
}

python_ok() {
  # True when "$1" runs and is Python >= 3.10.
  "$1" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' >/dev/null 2>&1
}

detect_python() {
  local c p
  if [ -n "$PYTHON_BIN" ]; then
    python_ok "$PYTHON_BIN" || die "$PYTHON_BIN çalışmıyor veya Python 3.10'dan eski"
    printf '%s\n' "$PYTHON_BIN"; return
  fi
  for c in python3.14 python3.13 python3.12 python3.11 python3.10 python3; do
    p="$(command -v "$c" 2>/dev/null || true)"
    if [ -n "$p" ] && python_ok "$p"; then
      printf '%s\n' "$p"; return
    fi
  done
  for p in "$HOME"/.local/bin/python3.1[0-9]; do
    if [ -x "$p" ] && python_ok "$p"; then
      printf '%s\n' "$p"; return
    fi
  done
  warn "Python >= 3.10 bulunamadı; şablona 'python3' yazılıyor. Kurduktan sonra --python ile yeniden üretin."
  printf 'python3\n'
}

# Show paths under $HOME as $HOME/... so the rendered prompt is portable and
# does not spell out the local user name.
home_relative() {
  case "$1" in
    "$HOME") printf '$HOME\n' ;;
    "$HOME"/*) printf '$HOME/%s\n' "${1#"$HOME"/}" ;;
    *) printf '%s\n' "$1" ;;
  esac
}

# ---------------------------------------------------------------------------
# 1. Portal skills
# ---------------------------------------------------------------------------

install_portals() {
  local clone="$1" skills portal src dest
  [ -d "$clone" ] || die "klasör yok: $clone"
  clone="$(cd "$clone" && pwd)"
  [ -f "$clone/.claude/skills/job-scraper/SKILL.md" ] \
    || die "$clone bir ai-job-search klonu gibi görünmüyor (.claude/skills/job-scraper/SKILL.md yok)"
  skills="$clone/.agents/skills"
  [ -d "$skills" ] || die "$skills yok; upstream ai-job-search klonu mu?"

  log "== $clone"
  for portal in "${PORTALS[@]}"; do
    src="$SCRIPT_DIR/portals/$portal"
    dest="$skills/$portal"
    [ -f "$src/SKILL.md" ] || die "paket eksik: $src"
    if [ -e "$dest" ]; then
      if diff -rq -x node_modules -x bun.lock -x .DS_Store "$src" "$dest" >/dev/null 2>&1; then
        log "  $portal: zaten güncel"
        continue
      fi
      if [ "$FORCE" -ne 1 ]; then
        log "  $portal: zaten var ve farklı, atlandı (üzerine yazmak için --force)"
        continue
      fi
      log "  $portal: --force ile değiştiriliyor"
      run rm -rf "$dest"
    else
      log "  $portal: kopyalanıyor"
    fi
    run cp -R "$src" "$dest"
  done

  if [ "$DO_PERMISSIONS" -eq 1 ]; then
    add_permissions "$clone"
  else
    log "  izinler: atlandı (gözetimsiz çalışma için --permissions ile tekrar çalıştırın)"
  fi
}

add_permissions() {
  local clone="$1" py
  py="$(helper_python)"
  if [ "$DRY_RUN" -eq 1 ]; then
    log "  [dry-run] izinler eklenecek: $clone/.claude/settings.json, $clone/tools/security_guards.py"
    return
  fi
  "$py" - "$clone" "${PORTALS[@]}" <<'PYEOF'
import json, re, sys
from pathlib import Path

clone = Path(sys.argv[1])
entries = [f"Bash(bun run .agents/skills/{p}/cli/src/cli.ts:*)" for p in sys.argv[2:]]

settings = clone / ".claude" / "settings.json"
if settings.is_file():
    data = json.loads(settings.read_text(encoding="utf-8"))
    allow = data.setdefault("permissions", {}).setdefault("allow", [])
    missing = [e for e in entries if e not in allow]
    if missing:
        # Insert after the last existing portal entry to keep the list grouped.
        idx = max((i for i, e in enumerate(allow) if e.startswith("Bash(bun run .agents/skills/")), default=len(allow) - 1) + 1
        allow[idx:idx] = missing
        settings.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"  settings.json: {len(missing)} izin eklendi")
    else:
        print("  settings.json: izinler zaten var")
else:
    print("  settings.json: bulunamadı, atlandı")

guards = clone / "tools" / "security_guards.py"
if guards.is_file():
    text = guards.read_text(encoding="utf-8")
    m = re.search(r"ALLOWED_PERMISSIONS = \{(.*?)\n\}", text, re.S)
    if not m:
        print("  security_guards.py: ALLOWED_PERMISSIONS bulunamadı, elle ekleyin")
    else:
        block = m.group(1)
        missing = [e for e in entries if f'"{e}"' not in block]
        if missing:
            lines = block.split("\n")
            last = max((i for i, l in enumerate(lines) if '"Bash(bun run .agents/skills/' in l), default=len(lines) - 1)
            indent = re.match(r"\s*", lines[last]).group(0) if lines[last].strip() else "    "
            lines[last + 1:last + 1] = [f'{indent}"{e}",' for e in missing]
            new_block = "\n".join(lines)
            text = text[:m.start(1)] + new_block + text[m.end(1):]
            guards.write_text(text, encoding="utf-8")
            print(f"  security_guards.py: {len(missing)} izin eklendi")
        else:
            print("  security_guards.py: izinler zaten var")
else:
    print("  security_guards.py: bulunamadı, atlandı")
PYEOF
}

# ---------------------------------------------------------------------------
# 2. Config + scheduled-task prompt
# ---------------------------------------------------------------------------

setup_config() {
  local people="$CONFIG_DIR/people.json" out="$SCRIPT_DIR/scheduled-task/SKILL.md"
  local tpl="$SCRIPT_DIR/scheduled-task/SKILL.template.md" py hp cfg_shown py_shown

  log "== yapılandırma: $(home_relative "$CONFIG_DIR")"
  if [ ! -d "$CONFIG_DIR" ]; then
    run mkdir -p "$CONFIG_DIR"
    run chmod 700 "$CONFIG_DIR"
  fi

  if [ -e "$people" ] && [ "$FORCE" -ne 1 ]; then
    log "  people.json: zaten var, dokunulmadı"
  else
    log "  people.json: örnekten oluşturuluyor (düzenlemeyi unutmayın)"
    run cp "$SCRIPT_DIR/people.example.json" "$people"
    run chmod 600 "$people"
  fi

  hp="$(helper_python)"
  if [ "$DRY_RUN" -eq 0 ] && [ -f "$people" ]; then
    "$hp" - "$people" <<'PYEOF' || true
import json, re, sys
path = sys.argv[1]
try:
    data = json.load(open(path, encoding="utf-8"))
except Exception as exc:
    print(f"  UYARI: people.json okunamadı: {exc}"); sys.exit(0)
if not isinstance(data, list) or not data:
    print("  UYARI: people.json boş olmayan bir JSON dizisi olmalı"); sys.exit(0)
seen = set()
for i, p in enumerate(data, 1):
    missing = [k for k in ("key", "name", "email", "repo_path") if not str(p.get(k, "")).strip()]
    if missing:
        print(f"  UYARI: kayıt {i}: eksik alan(lar): {', '.join(missing)}")
    key = str(p.get("key", ""))
    if key and not re.fullmatch(r"[a-z0-9_-]+", key):
        print(f"  UYARI: kayıt {i}: key yalnızca a-z, 0-9, - ve _ içermeli")
    if key in seen:
        print(f"  UYARI: kayıt {i}: key tekrarlanıyor")
    seen.add(key)
    if str(p.get("email", "")).endswith("@example.com"):
        print(f"  not: kayıt {i} hâlâ örnek adres kullanıyor; görev bu kişiyi atlar")
print(f"  people.json: {len(data)} kayıt kontrol edildi")
PYEOF
  fi

  py="$(detect_python)"
  cfg_shown="$(home_relative "$CONFIG_DIR")"
  py_shown="$(home_relative "$py")"
  if [ -e "$out" ] && [ "$FORCE" -ne 1 ]; then
    log "  scheduled-task/SKILL.md: zaten var, dokunulmadı (yeniden üretmek için --force)"
  elif [ "$DRY_RUN" -eq 1 ]; then
    log "  [dry-run] scheduled-task/SKILL.md üretilecek (CONFIG_DIR=$cfg_shown, PYTHON=$py_shown)"
  else
    "$hp" - "$tpl" "$out" "$cfg_shown" "$py_shown" <<'PYEOF'
import sys
tpl, out, cfg, py = sys.argv[1:5]
text = open(tpl, encoding="utf-8").read()
text = text.replace("{{CONFIG_DIR}}", cfg).replace("{{PYTHON}}", py)
open(out, "w", encoding="utf-8").write(text)
PYEOF
    log "  scheduled-task/SKILL.md: üretildi (PYTHON=$py_shown)"
  fi
}

# ---------------------------------------------------------------------------

for c in ${CLONES[@]+"${CLONES[@]}"}; do
  install_portals "$c"
done

if [ "$DO_CONFIG" -eq 1 ]; then
  setup_config
fi

log ""
log "Bitti. Sonraki adımlar README.md'de: profilleri doldurun, people.json'u düzenleyin,"
log "scheduled-task/SKILL.md içeriğiyle Claude uygulamasında zamanlanmış görev oluşturun."
