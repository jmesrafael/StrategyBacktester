# Who does what

You said you will give me full admin access. This file separates what that lets me do from what stays with you, and what I still ask about even with access.

## 🤖 What I can do (given the access in the next section)

**On this PC (already works today, no setup)**
- Edit code, run all tests (1,117 checks), run the backtests and replays.
- Build the two deploy bundles and check them (checksum, secret scan).
- Write and update every document, including this folder.
- Commit in the four repos (`bb-core`, `i-core`, `ledger`, `StrategyBacktester`).

**On GitHub** (the stored login works for reading; I have not tested a push)
- Push commits to the four repos.

**On the VPS** (once you give me SSH, see below)
- Read-only checks: services, timers, `status`, `check`, config values, logs, open positions, the readiness and preflight scripts.
- Copy the bundle, verify its checksum, run the state backup.
- Run the preflight and the installer (`setup-vps.sh`), which restarts the bot.
- Edit `bot-config.json` (pin or change the risk settings), with a backup first.
- Roll back (`deploy/rollback.sh`), set or remove the kill switch.

**On Vercel and Supabase** (connectors are available in this session)
- Vercel: see deployments, check a deploy is live, roll back to the previous one.
- Supabase: read-only checks (which migrations are applied, table contents).

## 🧑 What only you can do

| Only you | Why |
|---|---|
| **Look at the MEXC app** and confirm each open trade shows its TP/SL (and no stray orders) | I cannot see your MEXC screen; the bot's own checks use the API, yours is the independent check |
| Decide **go / no-go** on each decision in `02-DECISIONS.md` | They change real-money behaviour |
| **Give me access**: add my SSH key to the VPS, allow `sudo` for the upgrade window | Only you control the server |
| **Create or approve GitHub / Vercel / Supabase logins** if any is missing or expired, and 2FA prompts | They are your accounts |
| Anything on **MEXC itself**: API keys, IP allow-list, transfers in or out, changing wallets | I never touch exchange accounts directly |
| Decide **investor-facing things**: telling investors, the 10% to 20% fee migration, the terms version | Business decision |
| Confirm **Telegram** messages arrive (you see your phone, I do not) | |
| Decide the **timing** (which candle window) | You know when you can watch |

## ⛔ What I do only after a fresh, explicit "go" from you, even with admin access

I stop and ask before each of these. A general "do everything" does not cover them; a specific "go" for that phase does.

1. **Pushing to GitHub** (the bots' code lives there; whoever can push can change what trades).
2. **Restarting a live bot** (Phases 4 and 6).
3. **Turning on the new risk or removing the cap** (Phase 7): this changes how much money each trade risks.
4. **Rolling back** a live bot, unless a restart left it not running (then I roll back at once and tell you).
5. **Anything that opens or closes a trade by hand**, or the bot's `test-trade` (it spends real cents).

## ❌ What I will not do, with or without access

- Print, copy, or move your secrets (`mexc-keys.json`, `.env`, Telegram token, API keys). I check that they exist, never their value.
- Switch a bot between paper and live.
- Delete `state/`, `journal/` or backups.
- Disable the kill switch or the drawdown halt to "get a trade through".
- Change risk, coin list or strategy outside what you decided in `02-DECISIONS.md`.

## Access I need (the one thing blocking the VPS steps today)

This PC has **no SSH key and has never connected to the VPS** (only `known_hosts` exists, without the server). Choose one:

**Option A: I run the VPS steps (fastest).**
1. 🤖 I generate a dedicated key on this PC (`ssh-keygen -t ed25519 -f ~/.ssh/claude_vps`) and show you the **public** key.
2. 🧑 You add that public key to the VPS user `admin`: `echo "<public key>" >> ~/.ssh/authorized_keys`.
3. 🧑 You allow `sudo` without a password **only for the upgrade window**: `echo 'admin ALL=(ALL) NOPASSWD:ALL' | sudo tee /etc/sudoers.d/90-claude-upgrade`
4. 🧑 When we finish, remove both: delete the key line from `authorized_keys` and run `sudo rm /etc/sudoers.d/90-claude-upgrade`. I will remind you in Phase 9.

**Option B: you run the VPS steps, I prepare and check.**
I give you the exact commands (all in `06-COMMANDS.md`), you paste them in your own terminal and paste the output back to me. Slower, same safety, no access to give.

You can also mix: I do the read-only steps (A), you run the two restart steps (B).
