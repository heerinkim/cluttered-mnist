#!/usr/bin/env bash
#
# install-global-skill.sh
#
# Install a skill from a git repository as a *global* Claude Code skill, so it
# is available in every project instead of only one working directory.
#
# Global skills live at ~/.claude/skills/<skill-name>/SKILL.md
#
# By default the repository is cloned once into ~/.claude/skills-src/<repo-name>
# and the skill directory is symlinked into ~/.claude/skills, so a single
# `git pull` in the clone updates the installed skill.
#
# Run with --help for usage.

set -euo pipefail

# ---------------------------------------------------------------- defaults ---

DEFAULT_REPO_HTTPS="https://github.com/wonhp1/claude-skills.git"
DEFAULT_REPO_SSH="git@github.com:wonhp1/claude-skills.git"

REPO="$DEFAULT_REPO_HTTPS"
REPO_EXPLICIT=0
USE_SSH=0
REF=""
SRC_DIR="skills"
MODE="symlink"
DEST=""
CACHE=""
LIST_ONLY=0
UNINSTALL=0
OFFLINE=0
SKILLS=()

# Directory-name / name / description keywords that identify a "make me a
# homepage" style skill. Matched case-insensitively.
HOMEPAGE_PATTERN='homepage|home page|home-page|home_page|website|web site|web-site|webpage|web page|web-page|landing page|landing-page|landing|static site|홈페이지|웹사이트|웹 사이트|웹페이지|웹 페이지|랜딩'

# ---------------------------------------------------------------- plumbing ---

SCRIPT_NAME=$(basename "$0")

info() { printf '%s\n' "$*"; }
step() { printf '\n==> %s\n' "$*"; }
warn() { printf 'WARNING: %s\n' "$*" >&2; }
die() {
	printf 'ERROR: %s\n' "$*" >&2
	exit 1
}

usage() {
	cat <<EOF
${SCRIPT_NAME} - install a skill from a git repo as a global Claude Code skill

USAGE
  ${SCRIPT_NAME} [OPTIONS]

OPTIONS
  --repo <url>          Source repository.
                        Default: ${DEFAULT_REPO_HTTPS}
  --ssh                 Use the SSH URL instead of HTTPS (for private repos).
                        Default: ${DEFAULT_REPO_SSH}
  --ref <branch|tag>    Branch or tag to check out. Default: the repo's HEAD.
  --src-dir <path>      Directory inside the repo holding the skills.
                        Default: ${SRC_DIR}
  --skill <name>        Skill to install. Repeatable. If omitted, the script
                        auto-detects a homepage/website skill and refuses to
                        guess when the match is not unique.
  --mode symlink|copy   How to install. Default: ${MODE}
  --dest <path>         Global skills directory. Default: \$HOME/.claude/skills
  --cache <path>        Where to clone the repo.
                        Default: \$HOME/.claude/skills-src/<repo-name>
  --list                Print the skills found in the repo and exit.
  --offline             Do not clone or fetch; use an existing --cache as is.
  --uninstall           Remove skills previously installed by this script.
  -h, --help            Show this help.

EXAMPLES
  # See what is in the repo first (private repo over SSH)
  ${SCRIPT_NAME} --ssh --list

  # Auto-detect and install the homepage skill
  ${SCRIPT_NAME} --ssh

  # Install a specific skill by name
  ${SCRIPT_NAME} --ssh --skill homepage-builder

  # Copy instead of symlink (if your Claude Code build ignores symlinks)
  ${SCRIPT_NAME} --ssh --skill homepage-builder --mode copy

  # Remove it again
  ${SCRIPT_NAME} --uninstall --skill homepage-builder

Restart Claude Code after installing so the new skill is picked up.
EOF
}

# Expand a leading ~ and make the path absolute without requiring the path to
# exist (GNU `readlink -f` semantics are not portable to macOS).
abspath() {
	local p="$1"
	case "$p" in
	"~") p="$HOME" ;;
	"~/"*) p="$HOME/${p#\~/}" ;;
	esac
	case "$p" in
	/*) ;;
	*) p="$PWD/$p" ;;
	esac
	# Strip a trailing slash (but keep "/" itself intact).
	while [ "${#p}" -gt 1 ] && [ "${p%/}" != "$p" ]; do p="${p%/}"; done
	printf '%s' "$p"
}

lower() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]'; }

# Print the value of a YAML frontmatter key from a SKILL.md, or nothing.
# Only looks inside the leading `---` ... `---` block.
frontmatter_value() {
	local file="$1" key="$2"
	awk -v key="$key" '
		NR == 1 && $0 != "---" { exit }
		NR == 1 { inside = 1; next }
		inside && $0 == "---" { exit }
		inside {
			if (index($0, key ":") == 1) {
				v = substr($0, length(key) + 2)
				sub(/^[ \t]+/, "", v)
				sub(/[ \t]+$/, "", v)
				# strip one layer of matching quotes
				if (v ~ /^".*"$/ || v ~ /^'"'"'.*'"'"'$/) v = substr(v, 2, length(v) - 2)
				print v
				exit
			}
		}
	' "$file"
}

# Guard every destructive path: it must sit directly inside $DEST.
assert_inside_dest() {
	local path="$1"
	local base
	base=$(basename "$path")
	[ "$path" != "$DEST" ] || die "refusing to operate on the destination root: $path"
	[ "$(dirname "$path")" = "$DEST" ] || die "refusing to touch a path outside $DEST: $path"
	case "$base" in
	"" | "." | ".." | "/") die "refusing to operate on suspicious path: $path" ;;
	esac
}

# ------------------------------------------------------------------- args ---

while [ $# -gt 0 ]; do
	case "$1" in
	--repo)
		[ $# -ge 2 ] || die "--repo needs a value"
		REPO="$2"
		REPO_EXPLICIT=1
		shift 2
		;;
	--ssh)
		USE_SSH=1
		shift
		;;
	--ref)
		[ $# -ge 2 ] || die "--ref needs a value"
		REF="$2"
		shift 2
		;;
	--src-dir)
		[ $# -ge 2 ] || die "--src-dir needs a value"
		SRC_DIR="$2"
		shift 2
		;;
	--skill)
		[ $# -ge 2 ] || die "--skill needs a value"
		SKILLS[${#SKILLS[@]}]="$2"
		shift 2
		;;
	--mode)
		[ $# -ge 2 ] || die "--mode needs a value"
		MODE="$2"
		shift 2
		;;
	--dest)
		[ $# -ge 2 ] || die "--dest needs a value"
		DEST="$2"
		shift 2
		;;
	--cache)
		[ $# -ge 2 ] || die "--cache needs a value"
		CACHE="$2"
		shift 2
		;;
	--list)
		LIST_ONLY=1
		shift
		;;
	--offline)
		OFFLINE=1
		shift
		;;
	--uninstall)
		UNINSTALL=1
		shift
		;;
	-h | --help)
		usage
		exit 0
		;;
	*) die "unknown option: $1 (try --help)" ;;
	esac
done

case "$MODE" in
symlink | copy) ;;
*) die "--mode must be 'symlink' or 'copy' (got: $MODE)" ;;
esac

if [ "$USE_SSH" -eq 1 ]; then
	if [ "$REPO_EXPLICIT" -eq 1 ]; then
		warn "--ssh ignored because --repo was given explicitly"
	else
		REPO="$DEFAULT_REPO_SSH"
	fi
fi

[ -n "$DEST" ] || DEST="$HOME/.claude/skills"
DEST=$(abspath "$DEST")

if [ -z "$CACHE" ]; then
	repo_name=$(basename "$REPO")
	repo_name="${repo_name%.git}"
	[ -n "$repo_name" ] || repo_name="claude-skills"
	CACHE="$HOME/.claude/skills-src/$repo_name"
fi
CACHE=$(abspath "$CACHE")

RECEIPT="$DEST/.install-global-skill.receipt"

# ---------------------------------------------------------------- receipt ---
#
# Records what this script installed, so --uninstall never deletes a skill it
# did not create. Format: <skill><TAB><mode><TAB><source-path>

receipt_lookup_mode() {
	local name="$1"
	[ -f "$RECEIPT" ] || return 1
	awk -F '\t' -v n="$name" '$1 == n { print $2; found = 1; exit } END { exit !found }' "$RECEIPT"
}

receipt_record() {
	local name="$1" mode="$2" src="$3" tmp
	mkdir -p "$DEST"
	tmp="$RECEIPT.tmp.$$"
	if [ -f "$RECEIPT" ]; then
		awk -F '\t' -v n="$name" '$1 != n' "$RECEIPT" >"$tmp"
	else
		: >"$tmp"
	fi
	printf '%s\t%s\t%s\n' "$name" "$mode" "$src" >>"$tmp"
	mv "$tmp" "$RECEIPT"
}

receipt_forget() {
	local name="$1" tmp
	[ -f "$RECEIPT" ] || return 0
	tmp="$RECEIPT.tmp.$$"
	awk -F '\t' -v n="$name" '$1 != n' "$RECEIPT" >"$tmp"
	mv "$tmp" "$RECEIPT"
}

# ------------------------------------------------------------- uninstall ----

do_uninstall() {
	[ "${#SKILLS[@]}" -gt 0 ] || die "--uninstall needs at least one --skill <name>"

	local name target mode removed=0
	for name in "${SKILLS[@]}"; do
		target="$DEST/$name"
		assert_inside_dest "$target"

		if [ ! -e "$target" ] && [ ! -L "$target" ]; then
			info "not installed, nothing to do: $target"
			receipt_forget "$name"
			continue
		fi

		if [ -L "$target" ]; then
			local link
			link=$(readlink "$target")
			case "$link" in
			"$CACHE"/*)
				rm -f "$target"
				info "removed symlink: $target"
				removed=$((removed + 1))
				;;
			*)
				warn "$target is a symlink to '$link', which this script did not create - leaving it alone"
				continue
				;;
			esac
		else
			mode=$(receipt_lookup_mode "$name" || true)
			if [ "$mode" = "copy" ]; then
				rm -rf "$target"
				info "removed copy: $target"
				removed=$((removed + 1))
			else
				warn "$target is a real directory that this script did not install - leaving it alone"
				warn "delete it by hand if you are sure: rm -rf '$target'"
				continue
			fi
		fi
		receipt_forget "$name"
	done

	local backups
	backups=$(find "$DEST" -maxdepth 1 -name '*.bak.*' 2>/dev/null || true)
	if [ -n "$backups" ]; then
		info ""
		info "Backups from earlier runs are still here (not touched):"
		printf '%s\n' "$backups" | sed 's/^/  /'
	fi

	if [ "$removed" -gt 0 ]; then
		info ""
		info "Restart Claude Code for the change to take effect."
	fi
}

if [ "$UNINSTALL" -eq 1 ]; then
	do_uninstall
	exit 0
fi

# ------------------------------------------------------------ clone/update ---

command -v git >/dev/null 2>&1 || die "git is required but was not found on PATH"

clone_help() {
	cat >&2 <<EOF

Could not reach the repository. Common causes:

  * It is private and your git has no credentials for it.
      - HTTPS: run 'gh auth login' (GitHub CLI) or configure a credential helper
      - SSH:   re-run this script with --ssh and make sure 'ssh -T git@github.com' works
  * The default branch is not what you expected -> pass --ref <branch>
  * You are offline. If you already have a clone somewhere, point at it:
      ${SCRIPT_NAME} --offline --cache /path/to/claude-skills
EOF
}

sync_repo() {
	if [ "$OFFLINE" -eq 1 ]; then
		[ -d "$CACHE" ] || die "--offline given but cache does not exist: $CACHE"
		step "Offline mode - using existing checkout at $CACHE"
		return 0
	fi

	if [ ! -e "$CACHE" ]; then
		step "Cloning $REPO"
		info "  into $CACHE"
		mkdir -p "$(dirname "$CACHE")"
		if [ -n "$REF" ]; then
			git clone --depth 1 --branch "$REF" "$REPO" "$CACHE" || {
				clone_help
				die "git clone failed"
			}
		else
			git clone --depth 1 "$REPO" "$CACHE" || {
				clone_help
				die "git clone failed"
			}
		fi
		return 0
	fi

	[ -d "$CACHE/.git" ] || die "cache path exists but is not a git clone: $CACHE (remove it or pass a different --cache)"

	local ref="$REF"
	if [ -z "$ref" ]; then
		ref=$(git -C "$CACHE" rev-parse --abbrev-ref HEAD 2>/dev/null || true)
		[ -n "$ref" ] && [ "$ref" != "HEAD" ] || ref="HEAD"
	fi

	step "Updating existing checkout at $CACHE (ref: $ref)"
	if git -C "$CACHE" fetch --depth 1 origin "$ref" 2>/dev/null; then
		git -C "$CACHE" reset --hard FETCH_HEAD >/dev/null
		info "  updated to $(git -C "$CACHE" rev-parse --short HEAD)"
	else
		warn "could not fetch from origin; continuing with the checkout as it is"
	fi
}

sync_repo

SKILL_ROOT="$CACHE/$SRC_DIR"
[ -d "$SKILL_ROOT" ] || die "no '$SRC_DIR' directory in the repo (looked at $SKILL_ROOT) - pass --src-dir"

# ------------------------------------------------------------- discovery ----

AVAILABLE=()
DESCRIPTIONS=()

discover() {
	local dir name desc skillfile
	for dir in "$SKILL_ROOT"/*/; do
		[ -d "$dir" ] || continue
		skillfile="${dir}SKILL.md"
		[ -f "$skillfile" ] || continue
		name=$(basename "$dir")
		desc=$(frontmatter_value "$skillfile" description || true)
		[ -n "$desc" ] || desc="(no description)"
		AVAILABLE[${#AVAILABLE[@]}]="$name"
		DESCRIPTIONS[${#DESCRIPTIONS[@]}]="$desc"
	done
}

discover

[ "${#AVAILABLE[@]}" -gt 0 ] || die "no skills found under $SKILL_ROOT (a skill is a directory containing SKILL.md)"

print_available() {
	local i name desc
	i=0
	while [ "$i" -lt "${#AVAILABLE[@]}" ]; do
		name="${AVAILABLE[$i]}"
		desc="${DESCRIPTIONS[$i]}"
		# Keep the listing scannable.
		if [ "${#desc}" -gt 100 ]; then desc="${desc:0:97}..."; fi
		printf '  %-28s %s\n' "$name" "$desc"
		i=$((i + 1))
	done
}

if [ "$LIST_ONLY" -eq 1 ]; then
	step "Skills found in $SRC_DIR/ (${#AVAILABLE[@]})"
	print_available
	exit 0
fi

# --------------------------------------------------------- pick the skill ---

skill_exists() {
	local want="$1" n
	for n in "${AVAILABLE[@]}"; do
		[ "$n" = "$want" ] && return 0
	done
	return 1
}

if [ "${#SKILLS[@]}" -eq 0 ]; then
	step "No --skill given, auto-detecting a homepage/website skill"
	CANDIDATES=()
	i=0
	while [ "$i" -lt "${#AVAILABLE[@]}" ]; do
		name="${AVAILABLE[$i]}"
		hay=$(lower "$name ${DESCRIPTIONS[$i]}")
		if printf '%s' "$hay" | grep -qE "$HOMEPAGE_PATTERN"; then
			CANDIDATES[${#CANDIDATES[@]}]="$name"
		fi
		i=$((i + 1))
	done

	if [ "${#CANDIDATES[@]}" -eq 1 ]; then
		SKILLS[0]="${CANDIDATES[0]}"
		info "  matched: ${SKILLS[0]}"
	else
		if [ "${#CANDIDATES[@]}" -eq 0 ]; then
			info "  no skill matched the homepage keywords."
		else
			info "  ${#CANDIDATES[@]} skills matched, which is ambiguous:"
			printf '    %s\n' "${CANDIDATES[@]}"
		fi
		info ""
		info "Skills available in $SRC_DIR/:"
		print_available
		info ""
		info "Re-run naming the one you want:"
		info "  ${SCRIPT_NAME} --skill <name>"
		exit 2
	fi
fi

for want in "${SKILLS[@]}"; do
	if ! skill_exists "$want"; then
		info "Skills available in $SRC_DIR/:"
		print_available
		die "no such skill: $want"
	fi
done

# ----------------------------------------------------------------- install ---

mkdir -p "$DEST"

install_one() {
	local name="$1"
	local src="$SKILL_ROOT/$name"
	local target="$DEST/$name"

	assert_inside_dest "$target"

	# Decide whether the existing target is ours (safe to replace) or the
	# user's (must be backed up, never silently clobbered).
	if [ -L "$target" ]; then
		local link
		link=$(readlink "$target")
		case "$link" in
		"$CACHE"/*) rm -f "$target" ;;
		*)
			local backup="$target.bak.$(date +%Y%m%d%H%M%S)"
			mv "$target" "$backup"
			warn "$target was a symlink to '$link' - moved to $backup"
			;;
		esac
	elif [ -e "$target" ]; then
		if [ "$(receipt_lookup_mode "$name" || true)" = "copy" ]; then
			rm -rf "$target"
		else
			local backup="$target.bak.$(date +%Y%m%d%H%M%S)"
			mv "$target" "$backup"
			warn "$target already existed - moved to $backup"
		fi
	fi

	if [ "$MODE" = "symlink" ]; then
		ln -s "$src" "$target"
	else
		cp -R "$src" "$target"
	fi

	receipt_record "$name" "$MODE" "$src"

	# Verify the installed skill is actually readable through the target.
	local installed="$target/SKILL.md"
	[ -f "$installed" ] || die "install verification failed: $installed is not readable"

	local fm_name fm_desc
	fm_name=$(frontmatter_value "$installed" name || true)
	fm_desc=$(frontmatter_value "$installed" description || true)
	if [ -z "$fm_name" ] || [ -z "$fm_desc" ]; then
		warn "$installed has no 'name:'/'description:' YAML frontmatter - Claude Code may ignore it"
	fi

	if [ "$MODE" = "symlink" ]; then
		info "  $name -> $target -> $src"
	else
		info "  $name -> $target (copy of $src)"
	fi
}

step "Installing into $DEST (mode: $MODE)"
for name in "${SKILLS[@]}"; do
	install_one "$name"
done

# ------------------------------------------------------------------- done ---

step "Done"
info "Installed: ${SKILLS[*]}"
info ""
info "Next steps:"
info "  1. Restart Claude Code - skills are discovered at startup."
info "  2. The skill now loads in every project, not just one repo."
info ""
if [ "$MODE" = "symlink" ]; then
	info "To update later:"
	if [ "$REPO_EXPLICIT" -eq 1 ]; then
		info "  ${SCRIPT_NAME} --repo $REPO --skill ${SKILLS[0]}"
	elif [ "$USE_SSH" -eq 1 ]; then
		info "  ${SCRIPT_NAME} --ssh --skill ${SKILLS[0]}"
	else
		info "  ${SCRIPT_NAME} --skill ${SKILLS[0]}"
	fi
	info "  (or just: git -C '$CACHE' pull)"
	info ""
	info "If the skill still does not show up after a restart, your Claude Code"
	info "build may not follow symlinks - re-run with --mode copy."
else
	info "To update later, re-run this script (it re-copies from the repo)."
fi
info ""
info "To remove:"
info "  ${SCRIPT_NAME} --uninstall --skill ${SKILLS[0]}"
