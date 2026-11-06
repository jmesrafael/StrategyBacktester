# T-CORE LIVE: go-live steps (prepared Nov 6, 2026)

**For the owner and for Claude Code.** T-CORE is the third live bot (TRI-CORE = BB-CORE + I-CORE + T-CORE). The owner chose on Nov 6, 2026 to go live **before** the paper gates in `LIVE-READINESS-TCORE.md` (no paper trades yet), at the smallest size, on the **old I-Core MEXC sub-account**, counted in the investor pool. The paper lab (`bbtrail`) keeps running next to it as the clean comparison.

| Piece | Name |
|---|---|
| VPS service / user | `tcore` (paper lab stays `bbtrail`) |
| Code / state + keys | `/opt/tcore` (root-owned) / `/var/lib/tcore` (`mexc-keys.json`, journal, state) |
| Dashboard tag | `tcore` ("T-CORE" in the bot selector, live) |
| Ledger wallet | `tcore` (closed trades and wallet reports count in the pool) |
| Telegram label | `[CORE 3]` |
| Size | about $40, 2.5% risk per trade (about $1), steps 2.5 / 2 / 1.5% at $0 / $500 / $1000, $500 cap, halt at -45R |
| Build | `bash build-tcore-live.sh` → `dist/tcore-live.tar.gz` (a patched copy of this folder; the paper source is never changed) |

## Risks the owner accepted (read once)

- No paper evidence yet. 79% of trades lose and 26 losses in a row happened in the backtest; the worst drop was 29.7R (about 74% of a 2.5%-risk account). At $40 one trade risks about $1.
- The old account had MEXC's **6002 "position-opening restricted"** block on Nov 1-2. If it is still there, the test trade fails with code 6002 and nothing else can be done in code: check MEXC email / in-app messages.
- Small-account sizing: one minimum contract can be more than 2.5% risk on some coins (ZEC is 0.01 ZEC a contract). The bot skips a coin when the minimum would risk too much, as I-Core does.

## Steps

### 1. MEXC (owner, in the app or website, on the OLD I-Core sub-account)

1. **Old SOL short** (I-Core's, frozen stop 102.29): close it in the app if it is still open, and cancel any old orders. T-CORE must start flat, or its SOL trades would mix with it. Note the realised P&L: it is I-Core's old trade and is booked in the ledger by hand (it was opened before the tcore wallet existed).
2. Futures → settings: position mode **Hedge**.
3. **Delete the old I-Core API key** on this account. Make a **new** key: View Account, View Order, Order Placing. **Never Withdraw.** Link it to IP `193.181.221.91`.
4. Futures wallet of this account: about **$40**. Tell Claude where the money comes from: new money is a **capital addition** in the ledger (booked as such, so it is not counted as profit); money already in the pool (for example the old account's leftover balance) is not.

### 2. VPS: install (Claude can do this; the bot stays stopped)

```
scp dist/tcore-live.tar.gz dist/tcore-live.tar.gz.sha256 admin@193.181.221.91:/tmp/
ssh admin@193.181.221.91
cd /tmp && sha256sum -c tcore-live.tar.gz.sha256 && rm -rf /tmp/tcore && mkdir /tmp/tcore && tar -xzf tcore-live.tar.gz -C /tmp/tcore && sudo bash /tmp/tcore/deploy-tcore/install-tcore-live.sh
```

Expect: checks passed, units installed, "bot stopped", other bots' start times unchanged: YES. Dashboard and Telegram values are copied from BB-Core's env file (not shown).

### 3. VPS: keys (owner types them; hidden prompts)

```
sudo bash /opt/tcore/deploy-tcore/make-keys.sh
```

MEXC apiKey, apiSecret (hidden), "linked to IP" = y. Press **Enter** at the ledger wallet key: a new one is made on the server. It prints one SQL statement with only the key's hash.

### 4. Ledger: register the wallet (Claude can run the SQL with the owner's OK)

Run the printed `insert into public.bot_wallets …` statement, then:

```
update public.ledger_settings set value = '3' where key = 'wallet_expected_count';
```

(Only matters when wallet valuation is switched on; today `wallet_nav_mode = off` and the pool rolls forward from closed trades, `auto_pool_mode = trades`, which counts every registered wallet.) Book the $40 as a capital addition if it is new money (step 1.4).

### 5. VPS: pre-flight (read only)

```
sudo bash /opt/tcore/deploy-tcore/status.sh check
```

Must show the account, hedge mode, the balance, no open positions, candles OK, "LIVE enabled".

### 6. VPS: test trade (real money, a few cents)

```
cd /opt/tcore && sudo -u tcore env ICORE_STATE_DIR=/var/lib/tcore ICORE_KEYS=/var/lib/tcore/mexc-keys.json ICORE_ALLOW_LIVE=1 ICORE_NO_NOTIFY=1 node icore.js test-trade ADA --yes
```

One minimum ADA contract LONG with a stop, checked on MEXC, the stop moved once (what the trail does), closed again. It must end with PASSED. **Code 6002** = the account is still restricted (stop here, ask MEXC). Then, only if it passed:

```
sudo touch /var/lib/tcore/test-trade-passed
```

### 7. VPS: start trading

```
sudo bash /opt/tcore/deploy-tcore/install-tcore-live.sh --start
```

It refuses without keys, without the ledger wallet key, without the passed test, or if the pre-flight fails. Then: bot running, daily comparison at 00:58 UTC, wallet report every 5 minutes.

### 8. Verify

- `sudo bash /opt/tcore/deploy-tcore/status.sh` : service active, balance about $40, flat.
- Dashboard: bot selector shows **T-CORE** (live). The paper lab stays as **T-CORE lab**.
- `tail /var/log/ledger-wallet-tcore.log` : "wallet snapshot (tcore): sent".
- First trade: Telegram `[CORE 3]`, dashboard Trades tab with MEXC's dollar figure.

## Stop / undo

- Stop trading: `sudo bash /opt/tcore/deploy-tcore/install-tcore-live.sh --stop` (open positions stay on MEXC with their stop: close them in the app if you want out completely).
- Remove: `--uninstall` (keeps `/var/lib/tcore`). The paper lab, BB-Core and I-Core are never touched by any of these.
