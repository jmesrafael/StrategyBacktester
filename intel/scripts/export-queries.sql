-- Two READ-ONLY queries that refresh the trade record without any database key of our own.
-- Run each one in the Supabase SQL editor, or through the Supabase MCP tool execute_sql (project "Backtester"), and save the
-- result text to a file. Then:  node scripts/make-export.js <result1-file> <result2-file>   and   node run.js all
-- They only SELECT. Do not run anything else from here. (bot_wallets: key hashes are deliberately NOT selected.)

-- QUERY 1: events, closed trades, wallet list, row counts
select json_build_object(
 'exported_at', now(),
 'bot_events', (select json_agg(json_build_object('event_id',event_id,'type',type,'ts_ms',ts_ms,'mode',mode,'symbol',symbol,'side',side,'data',data,'received_at',received_at) order by ts_ms, event_id) from bot_events where type in ('entry','exit','signal','compare')),
 'closed_trades', (select json_agg(to_jsonb(c) order by closed_at, id) from closed_trades c),
 'bot_wallets', (select json_agg(json_build_object('label',label,'active',active,'wallet',wallet,'created_at',created_at)) from bot_wallets),
 'counts', json_build_object('bot_events_all',(select count(*) from bot_events),'bot_events_exported',(select count(*) from bot_events where type in ('entry','exit','signal','compare')),'closed_trades',(select count(*) from closed_trades),'wallet_snapshots',(select count(*) from wallet_snapshots))
) as export;

-- QUERY 2: wallet snapshots (large: the tool may save the result to a file, pass that file to make-export.js)
select json_build_object('exported_at', now(), 'columns', json_build_array('wallet','reported_at_s','equity_usdt','unrealized_usdt','open_positions','suspect'),
 'wallet_snapshots', (select json_agg(json_build_array(wallet, extract(epoch from reported_at)::bigint, equity_usdt, unrealized_usdt, open_positions, coalesce(suspect,false)) order by reported_at, id) from wallet_snapshots)) as export;
