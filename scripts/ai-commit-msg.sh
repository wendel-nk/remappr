#!/usr/bin/env bash
# Rewrites a commit message into a Conventional Commit.
#
# Primary path: ask Claude (claude CLI) to rewrite using staged diff + draft.
# Fallback path: when Claude is unavailable or fails, a rules-based formatter
# infers a type from the draft + changed paths and produces a valid header.
#
# Usage: ai-commit-msg.sh <commit-msg-file> [<source>] [<sha>]
# Invoked from .husky/prepare-commit-msg.
#
# Skip rules (no rewrite at all):
#   - SKIP_AI_COMMIT=1 in env
#   - source is merge/squash/commit (amend with -c)/template
#   - draft already matches Conventional Commit prefix
#   - no staged diff and no draft

set -euo pipefail

MSG_FILE="${1:-}"
SOURCE="${2:-}"

[[ -z "$MSG_FILE" ]] && exit 0
[[ "${SKIP_AI_COMMIT:-0}" == "1" ]] && exit 0
# Never run inside CI / automated bots / release-please etc. The hook would
# pipe staged diffs to an external CLI under an automation identity that
# the user never opted in to.
[[ -n "${CI:-}" || -n "${GITHUB_ACTIONS:-}" ]] && exit 0

case "$SOURCE" in
    merge | squash | commit | template) exit 0 ;;
esac

CONVENTIONAL_RE='^(feat|fix|chore|docs|style|refactor|perf|test|build|ci|revert)(\([^)]+\))?!?: .+'

# --- Read draft + diff ---
DRAFT_RAW="$(grep -v '^#' "$MSG_FILE" || true)"
DRAFT="$(printf '%s' "$DRAFT_RAW" | sed -e 's/[[:space:]]*$//' | awk 'NF || p{print; p=NF}')"
DRAFT="$(printf '%s' "$DRAFT" | head -c 4000)"

if printf '%s' "$DRAFT" | head -n1 | grep -Eq "$CONVENTIONAL_RE"; then
    exit 0
fi

DIFF_STAT="$(git diff --cached --no-color --no-ext-diff --stat -- 2>/dev/null || true)"
DIFF_BODY="$(git diff --cached --no-color --no-ext-diff -U2 -- 2>/dev/null | head -c 60000 || true)"
CHANGED_PATHS="$(git diff --cached --name-only -- 2>/dev/null || true)"
NAME_STATUS="$(git diff --cached --name-status -- 2>/dev/null || true)"

if [[ -z "$DIFF_STAT" && -z "$DIFF_BODY" && -z "$DRAFT" ]]; then
    exit 0
fi

# --- Rules-based formatter (fallback) ---
# Infer type from draft text + changed paths. Output: "type(scope): subject"
fallback_format() {
    local draft="$1"
    local paths="$2"
    local name_status="$3"
    local first
    first="$(printf '%s' "$draft" | head -n1)"

    # Normalize: trim, drop trailing period, collapse whitespace.
    local subject
    subject="$(printf '%s' "$first" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/\.$//' | tr -s '[:space:]' ' ')"
    [[ -z "$subject" ]] && subject="update project files"

    # Imperative: rewrite common past-tense / -ing leading verbs.
    subject="$(printf '%s' "$subject" | sed -E \
        -e 's/^[Ff]ixed /fix /' \
        -e 's/^[Aa]dded /add /' \
        -e 's/^[Rr]emoved /remove /' \
        -e 's/^[Dd]eleted /delete /' \
        -e 's/^[Uu]pdated /update /' \
        -e 's/^[Cc]hanged /change /' \
        -e 's/^[Rr]efactored /refactor /' \
        -e 's/^[Rr]enamed /rename /' \
        -e 's/^[Ii]mproved /improve /' \
        -e 's/^[Ii]mplemented /implement /' \
        -e 's/^[Ff]ixing /fix /' \
        -e 's/^[Aa]dding /add /' \
        -e 's/^[Rr]emoving /remove /' \
        -e 's/^[Uu]pdating /update /')"

    # Lowercase first letter.
    subject="$(printf '%s' "$subject" | awk '{ first=substr($0,1,1); rest=substr($0,2); print tolower(first) rest }')"

    # Type detection: draft keywords first.
    local lower_draft
    lower_draft="$(printf '%s' "$draft" | tr '[:upper:]' '[:lower:]')"
    local type=""

    if   [[ "$lower_draft" =~ (fix|bug|resolve|correct|patch|broken|issue|hotfix|crash|error|prevent\ ) ]]; then type="fix"
    elif [[ "$lower_draft" =~ (add|added|adding|adds|introduce|introduces|implement|implements|implementing|feature|new\ |support\ |allow\ |enable|expose) ]]; then type="feat"
    elif [[ "$lower_draft" =~ (test|spec|coverage) ]]; then type="test"
    elif [[ "$lower_draft" =~ (readme|docstring|jsdoc|tsdoc|changelog|comment) ]]; then type="docs"
    elif [[ "$lower_draft" =~ (refactor|rename|cleanup|clean\ up|reorganize|reorganise|simplif|extract|inline|move\ |split|consolidate|dedupe|deduplicate) ]]; then type="refactor"
    elif [[ "$lower_draft" =~ (perf|optim|faster|speed\ up|cache|memoiz|throttle|debounce) ]]; then type="perf"
    elif [[ "$lower_draft" =~ (format|prettier|lint|whitespace|reformat) ]]; then type="style"
    elif [[ "$lower_draft" =~ revert ]]; then type="revert"
    elif [[ "$lower_draft" =~ (bump|upgrade|upgrad|deps|dependency|dependencies|pnpm|npm\ install|lockfile) ]]; then type="chore"
    elif [[ "$lower_draft" =~ (workflow|github\ action|pipeline|gha|runner) ]]; then type="ci"
    elif [[ "$lower_draft" =~ (webpack|vite|rollup|tsconfig|build\ system|bundler) ]]; then type="build"
    fi

    # Path-based heuristic if draft was inconclusive.
    if [[ -z "$type" && -n "$paths" ]]; then
        local only_workflows=1 only_md=1 only_tests=1 only_deps=1 has_any=0
        while IFS= read -r p; do
            [[ -z "$p" ]] && continue
            has_any=1
            [[ "$p" == .github/workflows/* ]] || only_workflows=0
            [[ "$p" == *.md ]] || only_md=0
            [[ "$p" == *.test.* || "$p" == *.spec.* || "$p" == *__tests__* ]] || only_tests=0
            [[ "$p" == package.json || "$p" == pnpm-lock.yaml || "$p" == package-lock.json || "$p" == yarn.lock ]] || only_deps=0
        done <<< "$paths"

        if [[ $has_any -eq 1 ]]; then
            if [[ $only_workflows -eq 1 ]]; then type="ci"
            elif [[ $only_md -eq 1 ]]; then type="docs"
            elif [[ $only_tests -eq 1 ]]; then type="test"
            elif [[ $only_deps -eq 1 ]]; then type="chore"
            fi
        fi
    fi

    # Status-based heuristic: inspect A/M/D markers across source paths.
    # Only added code under src-like dirs → feat. Only deletions → refactor.
    if [[ -z "$type" && -n "$name_status" ]]; then
        local n_add=0 n_mod=0 n_del=0 n_src_add=0
        while IFS=$'\t' read -r status path _rest; do
            [[ -z "$status" ]] && continue
            case "$status" in
                A*) n_add=$((n_add+1));
                    case "$path" in
                        src/*|app/*|lib/*|electron/*|packages/*) n_src_add=$((n_src_add+1)) ;;
                    esac ;;
                M*) n_mod=$((n_mod+1)) ;;
                D*) n_del=$((n_del+1)) ;;
                R*) n_mod=$((n_mod+1)) ;;
            esac
        done <<< "$name_status"

        if   (( n_src_add > 0 && n_del == 0 )); then type="feat"
        elif (( n_del > 0 && n_add == 0 && n_mod == 0 )); then type="refactor"
        elif (( n_mod > 0 && n_add == 0 && n_del == 0 )); then type="fix"
        fi
    fi

    [[ -z "$type" ]] && type="chore"

    # Strip leading "<type>: " from subject if author already wrote it.
    subject="$(printf '%s' "$subject" | sed -E "s/^(feat|fix|chore|docs|style|refactor|perf|test|build|ci|revert)(\([^)]+\))?!?:[[:space:]]+//I")"

    # Drop leading verb that duplicates the type (e.g. type=fix subject="fix the bug" -> "the bug").
    case "$type" in
        fix)      subject="$(printf '%s' "$subject" | sed -E 's/^(fix|fixed|fixes|fixing)[[:space:]]+//I')" ;;
        feat)     subject="$(printf '%s' "$subject" | sed -E 's/^(add|added|adds|adding|implement|implemented|implements|implementing)[[:space:]]+//I')" ;;
        refactor) subject="$(printf '%s' "$subject" | sed -E 's/^(refactor|refactored|refactors|refactoring|rename|renamed|renames|renaming)[[:space:]]+//I')" ;;
        chore)    subject="$(printf '%s' "$subject" | sed -E 's/^(update|updated|updates|updating|bump|bumped|bumps|bumping)[[:space:]]+//I')" ;;
        docs)     subject="$(printf '%s' "$subject" | sed -E 's/^(document|documented|documents|documenting)[[:space:]]+//I')" ;;
    esac
    subject="$(printf '%s' "$subject" | sed -E 's/^[[:space:]]+//')"
    [[ -z "$subject" ]] && subject="update project files"

    # Truncate to 72 chars (header budget = 72 minus "type: " prefix).
    local prefix_len=$(( ${#type} + 2 ))
    local max_subject=$(( 72 - prefix_len ))
    if (( ${#subject} > max_subject )); then
        subject="${subject:0:$max_subject}"
        subject="$(printf '%s' "$subject" | sed -E 's/[[:space:]]+$//')"
    fi

    local header="${type}: ${subject}"

    # Body: drop the first line (used as subject) and keep the rest if non-empty.
    local body
    body="$(printf '%s' "$draft" | awk 'NR>1')"
    body="$(printf '%s' "$body" | awk 'NF{p=1} p')"

    if [[ -n "$body" ]]; then
        printf '%s\n\n%s\n' "$header" "$body"
    else
        printf '%s\n' "$header"
    fi
}

# --- Try Claude (primary path) ---
RESULT=""
if command -v claude >/dev/null 2>&1; then
    PROMPT_FILE="$(mktemp -t ai-commit-prompt.XXXXXX)"
    OUT_FILE="$(mktemp -t ai-commit-out.XXXXXX)"
    trap 'rm -f "$PROMPT_FILE" "$OUT_FILE"' EXIT

    cat >"$PROMPT_FILE" <<EOF
You are generating a Conventional Commit message.

Strict rules:
- First line: "type(scope): subject" — type from {feat, fix, chore, docs, style, refactor, perf, test, build, ci, revert}. Scope optional, lowercase, kebab-case.
- Subject: imperative mood, no trailing period, <= 72 chars.
- Blank line, then optional body (wrap at 72 cols) explaining WHY when not obvious.
- No code fences, no preamble, no trailing commentary. Output ONLY the commit message.
- Do not add Co-Authored-By or sign-off lines.

Author's draft (intent hint, may be vague — rewrite, don't quote verbatim):
---
$DRAFT
---

Staged diff stat:
$DIFF_STAT

Staged diff:
$DIFF_BODY
EOF

    if claude -p --bare --output-format text --model haiku <"$PROMPT_FILE" >"$OUT_FILE" 2>/dev/null; then
        RESULT="$(sed -e 's/^```.*$//' "$OUT_FILE" | awk 'NF{p=1} p' | awk '{a[NR]=$0} END{last=NR; while(last>0 && a[last]=="") last--; for(i=1;i<=last;i++) print a[i]}')"

        # Validate header.
        if ! printf '%s' "$RESULT" | head -n1 | grep -Eq "$CONVENTIONAL_RE"; then
            RESULT=""
        fi
    fi
fi

# --- Fallback if Claude missing or output invalid ---
if [[ -z "$RESULT" ]]; then
    RESULT="$(fallback_format "$DRAFT" "$CHANGED_PATHS" "$NAME_STATUS")"
fi

# Final sanity check; if even the fallback failed validation, leave the
# original draft alone so commitlint can complain in the normal way.
if ! printf '%s' "$RESULT" | head -n1 | grep -Eq "$CONVENTIONAL_RE"; then
    exit 0
fi

{
    printf '%s\n' "$RESULT"
    grep '^#' "$MSG_FILE" || true
} >"$MSG_FILE.new"

mv "$MSG_FILE.new" "$MSG_FILE"
