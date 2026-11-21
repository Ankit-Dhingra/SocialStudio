# Zomato Surge Pricing Architecture

## hook
Why did your delivery fee suddenly jump from thirty to eighty rupees? [#fee] It is not distance. [#map] It is a real-time spatial auction.

## hexagons
Zomato divides the entire city into Uber H3 hexagons. [#hex] Each hex has a unique ID. [#imbalance] When fifty orders land with only four available riders, surge triggers instantly.

## architecture
A naive SQL query on Postgres takes over one second, [#crash] crashing the connection pool. [#redis] So the read path hits in-memory Redis in four milliseconds, [#kafka] while Kafka streams rider GPS in the background.

## lock
When rain hits and thousands order at once, [#rain] Redis distributed lock uses SET NX with TTL [#lock] to eliminate race conditions and avoid server deadlocks.

## tradeoff
In an interview, explain the tradeoff: [#scale] Micro-hexagons give exact pricing but high RAM, [#macro] while macro-zones save memory but cause border anomalies.

## outro {hold=1.5}
Master real-world system design. Follow for more senior engineering breakdowns.
