# events: event ledger, reactions, event study

Answers: what did the market do after price shocks, scheduled releases, owner-tagged events and strong headlines?

## Inputs

Datasets `market` and `headlines` (optional). The Pulse calendar file (config `pulseEvents`). `inputs\owner-tags.csv` (config `ownerTags`). Config `shock` and `marketCoins`.

## Outputs

| Dataset | File | Built by |
|---|---|---|
| `events` | `events.jsonl` (append-only, hash chained) | `buildLedger()` |
| `derived/event-reactions` | `reactions.csv` | `buildReactions()` |
| `derived/event-study` | `study.csv` | `buildStudy()` |
| report | `reports\events.md` | `report()` |

Columns: `DATA-DICTIONARY.md`.

## How to run

```
node run.js reports               # runs this engine in the chain
node engines/events/index.js      # this engine alone
node --test test/events.test.js
```

## Method in plain words

- Shock: a 1h bar whose open-to-close log return is at least `shock.minZ` times the normal size (root mean square of the previous `shock.lookbackBars` returns), on at least `shock.minVolRatio` times the median volume of those bars. The shock time is the bar close. Run for every coin in `marketCoins`.
- Episode: shocks of one coin less than 24 hours apart. Only the first starts a study sample.
- Scheduled releases come from the Pulse calendar. Owner tags come from the CSV. Headlines come from the archive when impact is set, strength is 60 or more and the bias is not neutral.
- An event enters the ledger only after it happened (`first_seen_at` not later than now). Rows are appended once per `event_id`.
- Reactions: percent move of BTC and of the event coin, from the last price known at `first_seen_at`, for 1h, 24h, 72h, 7d. A horizon not finished at the as-of time stays empty.
- Study: each group is compared with every hour of the same coin (the baseline). The difference has a 95 percent bootstrap interval. A verdict needs 30 non-overlapping samples. Results are split before and from 2024.
- As-of: `buildReactions({asOf})` ignores later events and horizons. The ledger uses `opts.now`.

## Tests

`test\events.test.js` covers `detectShocks`, `withEpisodes`, `schedType`. The ledger, reactions and study are not covered by a test file.

## Limits

- Back-filled rows (`backfilled = true`) were written after the fact. Shock times are exact. Owner tags written later have approximate hours.
- Headlines exist only from the first Pulse brief.
- Events closer than the horizon overlap. Pooled alt-coin groups are not independent. Treat them as indicative.
