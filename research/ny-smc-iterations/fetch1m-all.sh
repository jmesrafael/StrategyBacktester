#!/bin/sh
# Binance futures 1m, one file per Oct–Oct year (for validating v7+1m outside the tuning year)
for y in 2024 2023 2022 2021 2020 2019; do
  n=$((y+1))
  [ $y -ge 2020 ] && node fetchBinance.js SOLUSDT 1m $y-10-01 $n-10-18 data/binance-sol1-$y.json
  node fetchBinance.js ETHUSDT 1m $y-10-01 $n-10-18 data/binance-eth1-$y.json
done
