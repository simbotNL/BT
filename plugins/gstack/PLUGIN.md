# gstack — Claude Code plugin

This directory wraps the upstream [`garrytan/gstack`](https://github.com/garrytan/gstack)
skill pack as a Claude Code plugin so it can be loaded directly from a plugin
marketplace or pointed at with `--plugin`.

## Layout

```
plugins/gstack/
  .claude-plugin/plugin.json   # plugin manifest
  commands/<name>.md           # one slash command per skill (53)
  skills/<name>/ -> ../<name>  # symlinks to each upstream skill folder
  <upstream gstack tree>       # README.md, CLAUDE.md, lib/, bin/, browse/, ...
```

The upstream gstack repo keeps each skill at the repo root (e.g. `review/SKILL.md`).
Claude Code discovers skills under `skills/` and slash commands under `commands/`,
so this plugin:

- Mirrors every `*/SKILL.md` directory into `skills/<name>` via a symlink (so the
  upstream files are not duplicated and internal paths like `./lib/` still resolve).
- Generates a thin `commands/<name>.md` wrapper for each skill so users get the
  same `/review`, `/ship`, `/qa`, etc. surface advertised in the upstream README.

## Install

From the project that wants to use it:

```bash
/plugin install ./plugins/gstack         # local
# or, if published:
/plugin install gstack@<marketplace>
```

Then run any of the 53 commands, e.g. `/review`, `/ship`, `/qa`, `/investigate`,
`/plan-eng-review`, `/cso`, `/design-shotgun`, `/learn`, `/retro`.

## Upstream setup steps that are NOT auto-run

The upstream `setup` script wires up gbrain, supabase, the Playwright browser, and
shell hooks. Those side-effects are intentionally **not** triggered by plugin
install — run `./setup` manually inside `plugins/gstack/` if you want the full
environment (browser automation, gbrain memory, etc.).

## License

MIT, same as upstream gstack. See `LICENSE`.
