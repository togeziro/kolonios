#!/bin/sh
# Strip the CommandCodeBot co-author trailer from commit messages.
# Defense-in-depth behind the Command Code bundle patch
# (~/bin/command-code-no-trailer.sh): even if the bundle patch is lost after
# an update, no commit gets the trailer.
#
# Installed via simple-git-hooks ("prepare-commit-msg" in package.json), so
# `bun run prepare` re-installs it automatically.

if [ "$SKIP_SIMPLE_GIT_HOOKS" = "1" ]; then
    exit 0
fi

COMMIT_MSG_FILE="$1"

# Only strip for real commit messages, not templates/messages/merges/squashes
# that git pre-fills from elsewhere.
case "$2" in
    message|template|merge|squash)
        exit 0
        ;;
esac

if [ -f "$COMMIT_MSG_FILE" ]; then
    grep -v '^Co-authored-by: CommandCodeBot <noreply@commandcode.ai>$' "$COMMIT_MSG_FILE" > "$COMMIT_MSG_FILE.tmp"
    mv "$COMMIT_MSG_FILE.tmp" "$COMMIT_MSG_FILE"
fi

exit 0
