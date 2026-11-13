HOOK OPTIONS:
1. Zomato khola? "Surge fee ₹30" dikha? <break time="0.4s"/> Kabhi socha, itni jaldi kaise calculate hota hai?
2. Raat ke 12 baje, baarish ho rahi hai. Zomato pe surge dikha? <break time="0.4s"/> Par ye har minute change kaise hota hai?
3. Girlfriend ke liye late night biryani order ki, ₹50 surge dikha. <break time="0.4s"/> Zomato ko kaise pata chala, is area mein demand high hai?
4. Interview mein pucha: "Zomato surge pricing kaise kaam karta hai?" <break time="0.4s"/> Tumne bola SQL query. REJECTED!
5. Subah 9 baje office ke liye nikal rahe ho. Zomato pe "surge" dikha. <break time="0.4s"/> Iska system design kya hoga?
Recommended: Option 4. Ye developer audience ko directly hit karta hai, interview scenario common hai, aur 'REJECTED!' ka shock factor bhi hai.

SCRIPT:

**Act 1 (0-6s) Relatable Hook:**
Interview mein pucha: "Zomato surge pricing kaise kaam karta hai?" <break time="0.4s"/> Tumne bola SQL query. REJECTED! <break time="0.4s"/> Itni jaldi, har request pe DB query? IMPOSSIBLE.

**Act 2 (6-12s) Counter-Intuitive Paradox:**
Socho, Zomato ko kaise pata chalta hai ki tumhare exact location pe **surge** lagana hai, <break time="0.4s"/> aur woh bhi har second update hota hai? <break time="0.4s"/> Poore city ka data ek saath?

**Act 3 (12-50s) Architecture Flow:**
Jab tum Zomato app kholte ho, tumhari **GPS location** send hoti hai. <break time="0.4s"/> Ye location backend pe jaake **H3 Hex Bin** mein convert hoti hai. <break time="0.4s"/> H3 Hex Bin matlab, poore city ko chote-chote hexagons mein divide kar dete hain. <break time="0.4s"/> Har hexagon ka ek unique ID. <break time="0.4s"/> Tumhara phone jis hexagon mein hai, uski ID mil gayi. <break time="0.4s"/> Ab, Zomato ke paas ek high-speed **in-memory cache** hai, jaise **Redis**. <break time="0.4s"/> Is **Redis** mein har **H3 Hex Bin ID** ke against, current **demand-supply ratio** stored hai. <break time="0.4s"/> Kitne users hain, kitne delivery partners online hain. <break time="0.4s"/> Jaise hi tumhari request aati hai, system tumhari **H3 Hex Bin ID** leta hai, <break time="0.4s"/> aur directly **Redis** se ratio fetch karta hai. <break time="0.4s"/> Agar ratio high hai, matlab demand zyada, supply kam, toh **surge price** calculate hota hai.

**Act 4 (50-70s) Aha Reveal:**
Par ye ratio update kaun karta hai? <break time="0.4s"/> Background mein, dedicated **worker services** continuously data aggregate karte hain. <break time="0.4s"/> Har **H3 Hex Bin** ke liye, woh dekhte hain kitne orders aa rahe hain, kitne riders available hain. <break time="0.4s"/> Aur har few seconds mein, ye **worker services** **Redis** mein us **H3 Hex Bin** ka **demand-supply ratio** update kar dete hain. <break time="0.4s"/> Isse tumhari request ko kabhi DB hit karna hi nahi padta! <break time="0.4s"/> Sab kuch **in-memory** hota hai, super fast.

**Act 5 (70-90s) Tradeoff Dilemma:**
Ye **H3 Hex Bin** approach granular pricing deta hai, <break time="0.4s"/> par **Redis** ko bahut frequent updates aur storage chahiye. <break time="0.4s"/> Ya phir, tum bade geographic areas use kar sakte ho, <break time="0.4s"/> less granular, par **Redis** pe load kam. <break time="0.4s"/> Ab system tumhara hai: High accuracy aur high load? Ya low accuracy aur low load? <break time="0.4s"/> Kya choose karoge? <break time="0.4s"/> Save this reel, aur apne dev dosto ko tag karo!

SCENE JSON:
```json
{
  "template": "linear_pipeline",
  "nodes": [
    {"id":"client","label":"Zomato App","type":"client"},
    {"id":"gateway","label":"API Gateway","type":"server"},
    {"id":"h3service","label":"H3 Service","type":"server"},
    {"id":"redis","label":"Redis Cache","type":"cache"},
    {"id":"workers","label":"Workers","type":"worker"},
    {"id":"db","label":"Data Store","type":"db"}
  ],
  "edges": [
    {"from":"client","to":"gateway"},
    {"from":"gateway","to":"h3service"},
    {"from":"h3service","to":"redis"},
    {"from":"workers","to":"redis"},
    {"from":"workers","to":"db", "label":"(for aggregation)"}
  ],
  "beats": [
    {"act":1,"anchor_word":"REJECTED","action":"stamp_rejected","target":"client"},
    {"act":2,"anchor_word":"surge","action":"waveform","target":"client"},
    {"act":3,"anchor_word":"GPS location","action":"packet","target":"client"},
    {"act":3,"anchor_word":"H3 Hex Bin","action":"node_pop","target":"h3service"},
    {"act":3,"anchor_word":"Redis","action":"node_pop","target":"redis"},
    {"act":3,"anchor_word":"H3 Hex Bin ID","action":"packet","target":"redis"},
    {"act":3,"anchor_word":"surge price","action":"waveform","target":"client"},
    {"act":4,"anchor_word":"worker services","action":"node_pop","target":"workers"},
    {"act":4,"anchor_word":"demand-supply ratio","action":"packet","target":"redis"},
    {"act":4,"anchor_word":"in-memory","action":"check","target":"redis"}
  ],
  "callouts": [
    {"anchor_word":"REJECTED!","type":"stamp_rejected"},
    {"anchor_word":"impossible","type":"stamp_rejected"}
  ]
}
```

FACT CHECK LIST:
- "Interview mein pucha: 'Zomato surge pricing kaise kaam karta hai?' Tumne bola SQL query. REJECTED!" - Generic/safe (common interview scenario, SQL query for real-time high-scale pricing is indeed a bad answer).
- "Zomato ko kaise pata chalta hai ki tumhare exact location pe surge lagana hai, aur woh bhi har second update hota hai?" - Generic/safe (problem statement).
- "Jab tum Zomato app kholte ho, tumhari GPS location send hoti hai." - Confirmed source chahiye (standard app behavior, but good to ensure Zomato explicitly uses client GPS for this, not just IP-based geo-location).
- "Ye location backend pe jaake H3 Hex Bin mein convert hoti hai." - Confirmed source chahiye (H3 is a known spatial indexing system, but Zomato's specific use of it for surge pricing needs confirmation from their engineering blogs/talks).
- "H3 Hex Bin matlab, poore city ko chote-chote hexagons mein divide kar dete hain. Har hexagon ka ek unique ID." - Confirmed source chahiye (accurate description of H3).
- "Zomato ke paas ek high-speed in-memory cache hai, jaise Redis." - Confirmed source chahiye (Redis is a common choice, but Zomato's specific use for this needs confirmation).
- "Is Redis mein har H3 Hex Bin ID ke against, current demand-supply ratio stored hai." - Confirmed source chahiye (design choice, common pattern).
- "Background mein, dedicated worker services continuously data aggregate karte hain. Har H3 Hex Bin ke liye, woh dekhte hain kitne orders aa rahe hain, kitne riders available hain. Aur har few seconds mein, ye worker services Redis mein us H3 Hex Bin ka demand-supply ratio update kar dete hain." - Confirmed source chahiye (common pattern for real-time aggregation and cache updates).
- "Isse tumhari request ko kabhi DB hit karna hi nahi padta! Sab kuch in-memory hota hai, super fast." - Generic/safe (the core benefit of this architecture).
- "H3 Hex Bin approach granular pricing deta hai, par Redis ko bahut frequent updates aur storage chahiye. Ya phir, tum bade geographic areas use kar sakte ho, less granular, par Redis pe load kam." - Generic/safe (standard tradeoff for spatial indexing granularity vs. system load).