#!/bin/sh
set -eu

base_url="${GITTYPER_DOWNLOAD_URL:-__GITTYPER_BASE_URL__}"
install_prefix="${GITTYPER_INSTALL_PREFIX:-$HOME/.local}"
package_url="$base_url/gittyper.tgz"

fail() {
  printf 'gittyper: %s\n' "$1" >&2
  exit 1
}

command -v node >/dev/null 2>&1 || fail 'Node.js 20 or newer is required: https://nodejs.org/'
command -v npm >/dev/null 2>&1 || fail 'npm is required and normally ships with Node.js.'
command -v git >/dev/null 2>&1 || fail 'Git is required: https://git-scm.com/'

node_major="$(node -p "Number(process.versions.node.split('.')[0])")"
[ "$node_major" -ge 20 ] || fail "Node.js 20 or newer is required; found $(node --version)."

printf 'Installing GitTyper from %s\n' "$package_url"
npm install --global --prefix "$install_prefix" "$package_url"

gittyper_bin="$install_prefix/bin/gittyper"
[ -x "$gittyper_bin" ] || fail "installation completed but $gittyper_bin is missing"

printf '\nGitTyper installed successfully.\n'
printf 'Run it with: %s\n' "$gittyper_bin"

case ":$PATH:" in
  *":$install_prefix/bin:"*) ;;
  *)
    printf '\nAdd GitTyper to your PATH by placing this line in your shell profile:\n'
    printf '  export PATH="%s/bin:$PATH"\n' "$install_prefix"
    ;;
esac
