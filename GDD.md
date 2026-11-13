Game Design Document (GDD): Perigee Industries
Version: 1.2 (Pre-Alpha Spec: documentation brought in line with the build at save v10, satellite generations and mobile markets)

Genre: Space Logistics & Base-Building Tycoon Sim

Target Platform: PC (Web HTML5 / Desktop)

Engine & Tech: Phaser 3 (UI, 2D layers) + Three.js (3D planet maps) / HTML5 Canvas + Web Audio API

1. Executive Summary
1.1 Core Concept
Perigee Industries is a heavy-lift logistics and off-world base-building management game. Players start as an early commercial space launch firm operating small workhorse rockets, managing launch schedules, taking customer satellite contracts, and building a low-Earth orbit (LEO) broadband constellation for passive income.

As revenue scales, players fund heavy-lift R&D to unlock fully reusable super-heavy launch vehicles, establish orbital fuel depots, and execute high-tonnage cargo drops to construct a self-sustaining lunar base, and then a base on Mars.

1.2 Core Gameplay Loop
[ Early Commercial Launches & Skylink Deployment ]
                       │
                       ▼
         [ High Profit & Passive Cash Flow ]
                       │
                       ▼
       [ Heavy-Lift R&D & Booster Reusability ]
                       │
                       ▼
        [ Orbital Propellant Transfer Depots ]
                       │
                       ▼
    [ Specialized Skyship Drops (Cargo/Crew/Power) ]
                       │
                       ▼
    [ Lunar Base Construction & Resource Self-Sufficiency ]
1.3 Key Pillars
Payload Tonnage & Volume Puzzle: Launching isn't just "click to ship." Every vessel has maximum payload tonnage and cubic fairing volume. Players must optimize rideshare stacking.

Multi-Stage Logistics Chain: Reaching deep space requires LEO refueling runs using dedicated tanker variants.

Dual-Sphere Economy: Earth funds early research and hardware manufacturing; Moon provides high-tier raw materials and deep-space mission infrastructure.

2. Core Game Systems & Mechanics
2.1 Fleet & Launch Operations
Vehicle Progression & Specs
Rocket Class	Mass to LEO	Turnaround Time	Refurbish Cost	Primary Purpose
Peregrine 9	22 t	7 Days	Low	Commercial LEO, Rideshare, Skylink Gen-1
Peregrine Heavy	64 t	14 Days	Medium	GTO Commercial Satellites, Heavy Science Probes
Behemoth Prototype	100 t	21 Days	High	Initial Orbital Flight & Heat Shield Testing
Operational Skyship	150 t	3 Days (Rapid)	Very Low	Orbital Refueling, Heavy Logistics
booster Reusability & Refurbishment Cycle
Booster Recovery: After each launch, players choose landing trajectories (Droneship vs. RTLS Landing Pad). RTLS saves refurbish time but costs 
20% total payload tonnage due to fuel reservation.

Core Degradation: Every booster launch accumulates wear and tear. Players can spend cash/time to refurbish or decommission worn cores.

Vehicle Classes: Boosters, Upper Stages and Recovery
The Peregrine family is a two-stage rocket. Its first-stage booster is reusable, and its upper stage is expendable: every launch burns one (about $0.4M for the Peregrine 9, $0.8M for the Heavy). The Behemoth and the Skyship are different. They are the first vehicles with a reusable upper stage, and both stages are caught by the launch tower. A Skyship is also the one hull that can be its own payload (tanker, depot and Moon-base modules).
In January 2010 nobody has landed a booster yet, so the company starts with expendable boosters and has to research reuse (see 2.11). Booster recovery has three modes for Peregrine launches, and each is unlocked by research:
- RTLS (return to launch site), unlocked by Booster Landing: -20% payload, and the booster is back at the pad at once.
- Droneship, unlocked by Droneship Recovery: full payload, but it needs a free droneship, which is out at sea and busy for 4 days, and the booster reaches its hangar 2 days later.
- Expend (the only mode at the start): the booster is thrown away for +15% payload. The hull is lost and needs no refit, and a new one has to be built for the next flight ($3M and 30 t of aluminum for a Peregrine 9).

2.2 Broadband Constellation Network (Passive Income)
The constellation is one global pool of satellites that serves every market the company is licensed in. The full rules are in 2.19 (markets, licences, capacity, service plans) and 2.20 (satellite generations and mobile service). The original six-region model (regional coverage percentages and per-region income) no longer exists.

Satellites decay over a 5 to 7 year life depending on generation, so replenishment launches are needed to keep capacity. A hull carries as many as its payload mass and fairing volume allow (a Peregrine 9 about 66 Gen-1 or 24 Gen-2; a Skyship about 440 Gen-1 or 72 Gen-3), in whole batches of 6; how much each one adds depends on the generation (Gen-1 0.3k subscribers, Gen-2 Mini 1.2k, Gen-3 5k, and Gen-3 flies only on a Skyship).

2.3 Orbital Logistics & Refueling
To send a 150-ton payload to the Lunar surface, a single Skyship launch does not retain enough fuel after LEO insertion.

Depot Placement: Launch a dedicated Depot Skyship into LEO.

Tanker Runs: Launch 3 to 5 Tanker Skyships to dock with the LEO Depot and transfer Liquid Methane (
CH 
4
​
 ) and Liquid Oxygen (
LOX).

Trans-Lunar Injection (TLI): The target payload vessel docks with the LEO Depot, tops off its propellant tanks, and performs the TLI burn for the Moon.

2.4 Lunar Base Development
The Moon Base is constructed on an isometric grid located at the Lunar South Pole (Shackleton Crater).

Specialized Vehicle Variants & Unlocks
Cargo Skyship: Delivers raw construction supplies, solar arrays, and surface vehicles.

Habitat Skyship: High mass (
110 t payload hit), brings life-support systems and engineers to staff the base.

Nuclear Reactor Variant: Non-returnable, single-use variant that deploys a megawatt-class fission reactor core directly onto the surface.

ISRU Tanker Variant: Equips landing gear with thermal drills to extract lunar water ice and convert it into fuel (
CH 
4
​
 /LOX). Once active, Skyships can refuel on the Moon to return to Earth without requiring Earth-side tanker support.

Base Module Dependencies
[ Fission Reactor Core ] ───► [ Solar/Power Grid ]
                                     │
                                     ▼
[ Life Support Habitat ] ◄─── [ Water Ice Mining Rig ]
          │                          │
          ▼                          ▼
[ Base Crew Capacity ]      [ ISRU Propellant Depot ] ───► [ Full Reusability ]
2.5 Fleet, Pads & Production
Vehicles are not an unlimited resource. Every rocket and ship is an individual hull that the company builds, flies, refits and eventually retires. The fleet is the company's capital, and the factory queue is how it grows.

Fleet Inventory
Each hull has a serial (P9-01, SKY-03), a flight count and a state: Building, Ready, In Flight, or Refit (post-flight turnaround).
A hull is retired after its rated number of flights (Peregrine 9: 10, Peregrine Heavy: 10, Behemoth: 4, Skyship: 40). The retirement happens after its last refit, and a replacement has to be built.
A failed launch destroys the hull and closes that pad for 14 days (28 for tower-catch vehicles).
Failure risk is per hull: a base rate plus a wear term that grows with flights. The Behemoth Prototype starts at about 12% risk, and each successful Behemoth flight lowers it toward a 4% floor.

Launch Pads
The company starts with one pad (Pad 39A). A pad launches one vehicle, then needs 2 days before the next launch. More pads (Pad 39B, SLC-40) can be bought, up to three. Extra hulls without extra pads queue behind the pad. Extra pads without extra hulls sit idle.

Factory & Production Queue
The factory has production lines (start with 1, up to 4; each extra line is a cash purchase). The player queues hulls, and each line works on one queue item at a time. Cost is paid when the item is queued, and cancelling an item that has not started refunds 50%.

| Vehicle | Build cost | Build time | Notes |
| Peregrine 9 | $12M | 8 days | Rated 10 flights |
| Peregrine Heavy | $25M | 16 days | Rated 10 flights |
| Behemoth Prototype | $30M | 30 days | Rated 4 flights, tower catch, high early risk |
| Skyship (Cargo) | $60M | 24 days | Rated 40 flights, tower catch |
| Skyship Tanker | $50M | 20 days | Carries 100 t of propellant to the LEO depot |
| Skyship Depot | $75M | 30 days | Single use: it stays in LEO and becomes the depot |
| Module ships (Habitat, Reactor, Drone Bay, Smelter, Fabricator, Ice Miner, Refinery) | see 2.8 and 2.9 | see 2.8 and 2.9 | Skyship hulls that become base modules; they unlock with the base techs |

Soft-lock protection: if the company has no hulls, nothing queued and not enough cash to build a Peregrine 9, investors fund one. Purchases must leave a small cash floor.

2.6 Destinations, Maps & Flight Planning
Every launch has a destination: an orbit or a landing site on Earth, the Moon or Mars. Destinations are chosen on the maps, not from a dropdown.

Destination Table
| Destination | Body | Kind | One-way days | Propellant per t of payload | Unlock |
| LEO (28.5 deg) | Earth | Orbit | 1 | none | Start |
| Polar LEO | Earth | Orbit | 1 | none | Start |
| Sun-synchronous (SSO) | Earth | Orbit | 1 | none | Start |
| GTO | Earth | Orbit | 1 | none | Start |
| Low Lunar Orbit | Moon | Orbit | 4 | 2 t | Skyship + depot propellant |
| Shackleton Crater | Moon | Site (south pole) | 5 | 3 t | Skyship + depot propellant |
| Mare Tranquillitatis | Moon | Site | 5 | 3 t | Skyship + depot propellant |
| Oceanus Procellarum | Moon | Site | 5 | 3 t | Skyship + depot propellant |
| Mars orbit, Jezero Crater, Utopia Planitia | Mars | Orbit / Sites | about 180 | 5 t (direct route) | Mars Transfer Vehicle tech (see 2.9 and 2.17) |

Planning Flow
1. Select a destination by clicking its orbit ring or landing-site pin on the Earth, Moon or Mars map.
2. Select a vehicle type from the fleet. The next ready hull of that type is used (least worn first).
3. Stack the manifest. Only contracts for the selected destination can be loaded (rideshare stacking within one orbit is the puzzle). Skylink satellite batches can ride along to LEO or Polar LEO.
4. Launch. A free pad, a ready hull, cash for launch costs and, for lunar flights, enough depot propellant are all required.

Flights as Records
A launch creates a trip: launch day, arrival day, destination, and status (en route, done, lost). Contract payouts and satellite deployments happen on arrival, so far destinations delay cash. The hull is unavailable for the round trip plus its refit turnaround. Lunar flights burn depot propellant at launch.

Map Interface
The primary screen is the map view. Earth, Moon and Mars each get a 3D planet model the player can drag to rotate.
Orbits are drawn as 3D rings around the planet. Landing sites are 2D pins on the surface. Both are clickable.
Active flights are 2D pins with a dashed trail from the launch site (or the arrival direction) to their destination.
Past flights stay on the map as faded dashed lines, so the history of the company's flights is readable at a glance. Lost flights are drawn in red.
A transit lane (2.25) shows flights between bodies, as a ribbon along the top of the map once a flight has first gone beyond Earth orbit.

2.7 Contracts vs. Building the Base
The central tension of the game: the same Skyship capacity can carry a paying customer's payload or the company's own base modules. Customer contracts fund the base, and every flight spent on the base is a flight not earning money. Base modules are delivered to a chosen landing site on the Moon map, and the base is built up there following the dependencies in 2.4. Mars follows the same pattern after the Mars Transfer tech.

Reputation: every successful flight builds the company's reputation. New contracts arrive every 6 days and the board holds 8; at 40 flights every 3 days and 10; at 120 flights every 2 days and 12. A bigger fleet, more pads and more hangars only pay off when there is more work, and this is how the work grows.

2.8 Lunar Base Construction (Phase 4a)
Choosing the site: the first module ship the player launches to a Moon landing site founds the base there. Every later module ship must land at that same site. Sites differ in terrain and in the contracts and propellant economics around them.

Zooming in: when a module arrives, the Moon map offers a Base button. Pressing it turns the Moon model to the site and zooms the camera in, then fades to the close-up base grid. A back button zooms out again.

Modules are starships on their sides: each module is a Skyship hull built in the factory, flown to the site (burning depot propellant like any lunar cargo), and delivered as a pending module. The player places it on the base grid as a horizontal or vertical tube.

| Module | Role | Power | Crew needed | Notes |
| Habitat | Houses 6 crew | uses 0.15 MW | 0 | The place crew live and breathe |
| Reactor | Fission power | makes 1.0 MW | 0 | Powers everything in its connected network |
| Drone Bay | Houses 4 construction drones | uses 0.2 MW | 1 | Drones dig regolith and bury modules |
| Smelter | Makes oxygen, iron and silica from regolith | uses 0.5 MW | 2 | Eats 2 t of regolith per day at full output |
| Fabricator | Builds new modules on the Moon from local materials | uses 0.3 MW | 2 | Needs smelter output and imported components |

Ducts: each module has a port at each end. Rubber ducts connect ports on different modules (an Earth-supplied part, $1.5M each, up to 10 tiles long). Only connected modules form a network. Power and crew are shared inside a network and not across separate ones. A module that is not connected to a reactor has no power.

Power and staffing: each network balances reactor output against its demand, and when demand is higher everything in it runs at a reduced rate. Smelters, drone bays and the fabricator need crew from a habitat in the same network, and without enough crew they run at a reduced rate. A habitat with no power loses crew.

Construction drones and burial: drones dig regolith from the surface (leaving visible pits) and place it over modules. Each module has a burial level from 0 to 100%, and a Habitat needs about 30 t of regolith to be fully buried (a Drone Bay needs 20 t). The player sets a drone focus: Bury (modules first), Mine (feed the smelters) or Balanced.

Radiation: solar particle events strike about once every 50 days with varying severity. Crew in habitats are lost with a probability that falls sharply with burial, so an unburied habitat is a real risk. Each lost crew member costs $5M, and replacements cost $1M each. Burying habitats first is the central early-game decision.

Smelters and stockpile: the base keeps a stockpile of regolith, oxygen, iron and silica. The player can sell surplus above a reserve (oxygen $0.10M per t, iron $0.24M per t, silica $0.08M per t) or keep it for local construction.

Local construction: a powered, staffed Fabricator can build Habitat, Reactor, Smelter and Drone Bay modules on the Moon. Each recipe uses stockpiled iron, silica and oxygen plus a smaller cash cost for imported components. The finished module appears as a pending module ready to place. This is how the base grows without paying Earth launch and propellant costs.

The tension: every module ship competes with customer contracts for depot propellant, Skyship pad time and cash. Customers pay for deliveries now, and the base only pays back once smelters and the Fabricator are running.

2.9 Lunar Ice, Moon-Built Ships and Mars (Phase 4b)
Ice mining: water ice only exists at Shackleton Crater, so the ice chain only works for a base founded there. Two new module ships (Lunar Ice Mining tech) extend the base:

| Module | Role | Power | Crew needed | Notes |
| Ice Miner | Drills ice | uses 0.4 MW | 2 | 1.2 t of ice per day at full output. Only works at Shackleton |
| Refinery | Turns ice into methalox | uses 0.6 MW | 2 | Eats 3 t of ice per day and makes 2 t of methalox |

The base stockpile now also holds ice (up to 300 t) and lunar methalox (up to 600 t). Lunar methalox fuels ships that leave from the Moon, so they need no Earth tankers.

Ships built on the Moon: the Fabricator can build a Skyship hull from stockpiled iron, silica and oxygen (300 t, 150 t and 50 t) plus $35M of imported engines, in 30 days. The hull appears in the fleet marked as based at the Moon. A Moon-based hull can only fly from the Moon, and an Earth hull can never fly from there.

Mars: the Mars Transfer Vehicle tech (needs Lunar Ice Mining and the Habitat tech) unlocks Mars orbit, Jezero Crater and Utopia Planitia, and Mars cargo contracts. Mars contracts are large (30 to 100 t) and pay roughly four times what lunar cargo pays per tonne, but the cash only arrives when the flight does, about 6 months later. Mars hulls are single use until a Mars base exists; 2.17 adds Mars fuel, Mars-based hulls and return flights.
Launch windows: Mars flights can only launch in the real windows listed in 2.11, about 30 days every 26 months (the first opens on 25 Nov 2011). Outside a window no Mars flight can launch, so the player has to plan ahead. Mars contracts last 200 days to give time to prepare.
Two routes to Mars:
- Direct from Earth: any Earth Skyship with a catch tower. It burns depot propellant (5 t per tonne of payload plus the usual launch fuel). It is risky: +12% risk on ascent and 15% risk of being lost on arrival. 180 days.
- From the Moon: a Moon-built Skyship leaves the base. It burns the base's lunar methalox (450 t plus 4 t per tonne of payload) and needs no Earth pad, tanker or depot. The arrival risk is 6%. 175 days. It needs the whole chain: a base at Shackleton, ice miners, refineries and a Fabricator.
Arrival can fail: a Mars-bound flight that survives launch can still be lost entering the Martian atmosphere.


2.10 Launch Sites, Infrastructure & Supply (Phase 5)
The company no longer owns a generic pad. It uses launch sites, and a site is either leased or owned.

Rent first, buy later: the company starts by leasing Pad 39A and a rented hangar at Cape Canaveral. Leasing keeps early capital free but costs a fee on every launch ($0.15M per leased launch) and every refit ($0.08M per rented hangar refit), and a leased site cannot expand. Buying a site removes the fees and lets it grow.

| Site | Role | Pads | Acquire | Notes |
| Cape Canaveral | Home site: LEO, GTO, lunar | 3 | Starts leased, buy for $60M | No polar or sun-synchronous launches (overflight rules) |
| Vandenberg | The only polar and sun-synchronous launches | 2 | Lease for $15M, buy for $85M | LEO family only, and no factory |
| Boca Chica (Starbase) | Super-heavy site | up to 8 | Buy for $220M | Bare land: the purchase includes no pads, hangars, tanks, plants, towers or factory line. Everything is built out from nothing (see below). Catch vehicles (Behemoth, Skyship) cost 15% less and build 15% faster here |
| Vermilion Parish (L) | Gulf Coast greenfield | up to 24 | Buy for $100M, only after you own Boca Chica | Starbase proves the catch-tower design first, then the company expands to Louisiana. Bare land with room for dozens of pads, no factory. Sits on natural gas deposits that must be extracted: gas wells ($20M each, up to 3) feed its methalox plants, which then make methane at half the usual production cost |

Greenfield sites (Boca Chica and Vermilion Parish): buying only gets the land. The site starts with no pads, no hangars, zero tank capacity, no plants and no factory line. Costs to build out:
| Item | Boca Chica | Vermilion Parish |
| Pad | $40M each, up to 8 | $25M each, up to 24 |
| Catch tower | $40M per pad | $40M per pad |
| Megahangar (refit bay) | $60M each, up to 8 | $50M each, up to 12 |
| Factory line | $40M, $80M, $120M (up to 3) | none (no factory) |
| Tanks and plants | usual prices, starting from zero capacity | usual prices |
| Gas wells | none | $20M each, up to 3 |
Two ways to make fuel: propellant plants (research Propellant Plants) synthesize kerolox or methalox at any site you own, at about 30% of the base price per tonne. Vermilion Parish adds a second mechanism, extraction: its gas wells tap the on-site natural gas, and each well lets one level of methalox plant run at half the production cost (15% of base price). Wells only help methalox (Starship-class fuel); kerolox (RP-1, used by Peregrine) is unaffected. Wells do nothing without a plant, and a plant without wells is an ordinary plant.

A reusable vehicle needs a megahangar for its refit at its launch site, so a greenfield site cannot launch reusable hulls until one is built. The auto site choice skips sites with no suitable pad. With dozens of pads, the Sites tab shows a summary and one build button instead of a row per pad.

Propellant is stored as separate tanks: RP-1 (kerosene, for Peregrine), methane (CH4, for Starship-class hulls) and liquid oxygen (LOX), which both share. A launch draws its fuel and its oxygen from their tanks in the real mass ratios: kerolox is 28% RP-1 and 72% LOX, methalox is 22% methane and 78% LOX. A Peregrine 9 launch (50 t) burns 14 t of RP-1 and 36 t of LOX. Shortages of either tank are bought at spot plus the rush premium. Base prices per tonne: RP-1 $0.0246M, methane $0.0129M, LOX $0.0015M, so LOX is cheap but you need a lot of it, and a single oxygen tank (and an air-separation plant) serves every vehicle. Plants exist for all three (RP-1 11 t/day per level, methane 9, LOX 30). Gas wells at Vermilion Parish cheapen methane only. Moon and Mars bases still make methalox directly from ice. Old saves convert their blended tanks into the three tanks at these ratios.

Rapid R&D at Boca Chica: Starbase is the prototype yard. Test articles built at Boca Chica take half the days and cost 25% less; a test flown from a Boca Chica pad turns the pad around in 1 day (2 elsewhere), a failed test closes the pad for only 5 days (14 elsewhere), and each failure teaches 50% more (+18% odds instead of +12% on the next attempt). The R&D tab shows the Boca Chica numbers on the Build and Fly buttons when that site is selected. Building articles at Boca Chica needs a factory line there; flying them needs a pad and the launch site set to Boca Chica.

Leased site limits: 1 pad, up to 2 rented hangars, no towers, no plants, no extra factory lines.
Owned site options: more pads ($25M and $40M for the 2nd and 3rd), up to 3 owned hangars ($15M each), catch towers ($40M per pad), tank expansion, propellant plants and factory lines.

Pads: a pad launches one vehicle and then needs 2 days. A failed launch closes that pad for 14 days (28 for tower-catch vehicles). Behemoth and Skyship launches need a pad with a catch tower.

Hangars (refit bays): after a flight, a hull needs a free hangar for its refit. With one hangar, only one hull refits at a time, so extra hulls wait. Hangars are the thing that limits a growing fleet, along with pads. A leased site rents a hangar for $3M and $0.08M per refit. An owned site buys one for $15M with no fee.

Droneships: the company starts with one and can buy up to 3 ($20M each). Each can take one landing, then needs 4 days to return. Droneship landings add 2 days before the refit can start, in exchange for full payload.

Commodities and the market: three commodities are traded in tonnes. Kerolox (RP-1/LOX) fuels the Peregrine family, methalox (CH4/LOX) fuels the Behemoth, the Skyship and tankers, and stainless steel is the raw material for hulls. Each has a spot price that drifts day to day (60% to 180% of its base price), so there are cheap and expensive periods.
Each site has storage tanks and a steel yard with a capacity. Bulk purchases of up to the free capacity cost 10% less than spot. A launch draws its propellant from the site's tanks first, and any shortage is bought automatically at spot plus a 10% rush premium. Owned sites can expand their storage.
Launch cost breakdown: propellant (from the tanks, or bought), the expended upper stage, refurbishment parts, operations, the pad lease fee, the hangar fee and the droneship fee. The breakdown is shown before launching.

Plants: with the Propellant Plants tech, an owned site can build kerolox and methalox plants (3 levels each, $25M per level, 40 t per day per level). A plant fills the site's tanks at about 30% of the spot price, so it pays for itself on fuel-hungry fleets.

Factory sites: each site with a factory has its own production lines and queue. Hulls are built at a chosen factory site and consume steel from that site's yard (the shortage is bought at spot plus the rush premium). Hulls can launch from any site.

Why this matters: fuel, pads, hangars and factories all become real capacity limits and real investments. The growth path is rent, then buy, then expand: more hulls need more hangars, more hangars need more pads, and a bigger fleet needs cheaper fuel from its own plants.

2.11 The Calendar and the 2010 Start (Phase 6)
The game now runs on a real calendar. Day 1 is 1 January 2010, and the top bar shows the date (for example "14 Mar 2012") next to the day count. The date is a clock for the player, not a lock on progress: the tech tree is still decided by research and cash, so a good player can be ahead of SpaceX and a slow one behind.

Why 2010: it is the year the Falcon 9 first flew, and at that point nobody has landed a booster. The player starts where a young launch company really starts.
- Seed funding: the company starts with $60M from its founding round, one leased pad at Cape Canaveral, one rented hangar, one Peregrine 9 and no Skylink satellites. There is no passive income yet, only the $0.12M per day of overhead, so the first contracts matter.
- Expendable boosters: with no landing tech, a Peregrine 9 booster is thrown away on every flight. Each launch therefore costs a new hull ($3M and 8 days in the factory, plus 30 t of aluminum), on top of fuel, upper stage and operations. A full manifest still turns a profit, but only a thin one, and a half-empty rocket loses money.
- Reuse is the first big research goal. Booster Landing ($30M) lets the booster return to the pad (RTLS) and be flown again. Rapid Reflight (Fast Turnaround Cores) now needs it, and Droneship Recovery ($40M) adds ocean landings at full payload. The Peregrine Heavy needs Rapid Reflight, so it is also a reuse-era vehicle. Skylink Gen-1 stays a cheap early unlock that builds passive income.
- Pace: contract offers and the flight rate are tuned to about twice the real SpaceX record for the matching stage of growth (see 2.7). The real company flew 26 launches in 2020, 61 in 2022 and 165 in 2025.

Real Mars launch windows: windows follow the real Earth to Mars transfer opportunities, with real dates for the ones that have already happened.
| Window opens | Closes | Flown by |
| 25 Nov 2011 | 18 Dec 2011 | Mars Science Laboratory |
| 18 Nov 2013 | 7 Dec 2013 | MAVEN and Mangalyaan |
| 4 Mar 2016 | 25 Mar 2016 | ExoMars TGO |
| 5 May 2018 | 8 Jun 2018 | InSight |
| 17 Jul 2020 | 15 Aug 2020 | Perseverance, Tianwen-1, Hope |
After 2020 the windows are predicted from the 779.94-day synodic period (late 2022, late 2024, late 2026, early 2029 and so on), each lasting about 30 days. Real windows are short, so a Mars mission must be planned months ahead. Mars contracts still last 200 days.

Saves from before this change keep their day count (which becomes a date from 2010) and are given the landing techs they already had access to.

2.12 Prototype Test Flights and Aluminum (Phase 6)
Some research cannot be finished in a lab. A tech marked "needs a test flight" is funded in two steps, and the second one is a dice roll.
1. Fund the research (the usual cost). The tech moves to "testing".
2. Build a test article in a factory. It is an item in the production queue with its own cost, build time and metal, and it counts toward the same lines as hulls.
3. Fly the test from a free pad on a site the company can launch from. The test costs operations money and uses the pad. It succeeds or fails on a roll. On success the tech unlocks. On failure the test article is lost, the pad is closed for repairs (14 days, as for any failed launch) and the team tries again with a new article.
Every failure teaches something: each failed attempt adds 12% to the odds of the next one (up to 90%), so persistence always pays, but it costs time and cash.

| Test | Tech | Base odds | Test article |
| Landing test | Booster Landing | 50% | $3M, 6 days, 20 t aluminum |
| Ocean landing test | Droneship Recovery | 55% | $4M, 8 days, 25 t aluminum |
| Heavy static fire and flight | Peregrine Heavy | 60% | $9M, 14 days, 60 t aluminum |
| Hull pressure test flight | Stainless Hull | 50% | $14M, 12 days, 120 t steel |
| Engine test flight | Harrier V3 | 45% | $18M, 14 days, 100 t steel |
| Heat shield re-entry test | Heat Shield Tiles | 50% | $16M, 12 days, 100 t steel |
| Orbital transfer demo | Orbital Tanker | 60% | $22M, 14 days, 150 t steel |
The Operational Skyship keeps its own gate: 3 successful Behemoth flights.

Aluminum: Peregrine rockets are built from aluminum-lithium alloy, where the Behemoth and Skyship use stainless steel. Aluminum is a fourth commodity ($0.035M per tonne, three times the price of steel and with a wider price swing). A Peregrine 9 hull uses 30 t, a Heavy 150 t, and aluminum test articles 20 to 60 t, so a company that burns a hull on every flight, as the player does at the start, is a real buyer of aluminum. Each site has an aluminum yard next to its steel yard, with its own capacity (150 t at the start) that bulk buys and expansion work on, and a shortage at build time is bought at spot plus the rush premium.

2.13 Game Feel and Interface Polish (Phase 7)
The aim is a tycoon game that reacts to the player: things move, make noise and celebrate or hurt. Everything here is presentation and quality of life, and none of it changes the simulation rules.

Launch sequence: pressing LAUNCH starts a short countdown (3, 2, 1) over the map with a beep for each step, and time holds while it runs. At zero the launch happens. A successful launch shows the rocket climbing from the launch-site pin with a smoke trail and plays an ignition rumble. A failed launch shows an explosion, a red screen flash, a bigger camera shake, an "ANOMALY" banner and a low failure sting. A test flight failure gets the same treatment, and a test flight success gets a chime.

Cash that moves: any change of $0.5M or more floats out of the cash counter as "+$8.0M" in green or "-$6.7M" in red. A positive change plays a soft coin ping. Next to the cash figure there is a sparkline of the last 90 days of cash, and under the net income figure a runway line: "Runway 42 days" while the company is losing money (amber under 60 days, red under 20) or "Profitable" when net income is positive.

Launch receipt: while the Mission tab is open, the launch costs are listed as a receipt on the map: every cost item, the total, the expected payout (which arrives on arrival) and the estimated profit. The hover hint stays for the button.

Milestones: some events are recorded once as company milestones and shown as a banner at the top of the map with a fanfare: the first successful flight, the first reflown booster, every research completion (including test-flight successes), the first lost vehicle ("First anomaly"), 10, 50, 100 and 250 successful flights, the first cargo on the Moon and on Mars, founding the Moon base, deploying the LEO depot, owning a launch site, and having $100M, $500M and $1000M in cash. Each stores its date, and the Skylink tab shows the last four in a Company Timeline.

Notifications: important log lines also appear as toasts at the top-left of the map (good news green, warnings amber, bad news red) for a few seconds, up to four at a time. The mission log stays as the history. Mars windows add two warnings: 30 days before a window opens and when it opens.

Auto-pause: the game pauses itself when something needs a decision: a test article is ready for its flight, a Mars window is 30 days away or has opened, investors had to step in, or a flight is lost on arrival. A toast says why, and Space resumes at the previous speed. Auto-pause can be switched off.

Sound: all sounds are synthesized with Web Audio (no files): a click on every button, countdown beeps, an ignition rumble, success and failure stings, a coin ping, a milestone fanfare and a quiet ambient pad. A mute button in the top bar and the M key silence everything, and the setting is remembered.

Keyboard: Space pauses and resumes, 1, 2 and 3 pick 1x, 3x and 8x speed, M mutes, P toggles auto-pause, R and Esc keep their base-building roles.

Later (not in this phase): save slots and a settings panel. (Fleet art, site scenes, the tutorial and base undo were built in 2.16.)

2.14 Customers, Shipping and Automatic Launch-Site Choice (Phase 8)
Contracts now come from somewhere. Each contract has a customer region (North America, Europe, Asia-Pacific, South America, Africa or Maritime & Air), and its payload has to be shipped to the launch site before it can fly.

Shipping: when a contract is accepted (first loaded into the manifest) the customer starts shipping the payload. The days it takes depend on the region and the launch site:
| Customer region | Cape (C) | Vandenberg (V) | Boca Chica (B) | Vermilion Parish (L) |
| North America | 2 | 2 | 2 | 2 |
| Europe | 6 | 7 | 6 | 6 |
| Asia-Pacific | 9 | 6 | 9 | 10 |
| South America | 5 | 6 | 4 | 4 |
| Africa | 8 | 9 | 8 | 7 |
| Maritime & Air | 3 | 3 | 3 | 2 |
A launch is blocked until every payload in the manifest has arrived ("Payload for Orion Media arrives in 3 days"). Shipping time counts from the day the contract was accepted, and unloading it withdraws the acceptance, so loading it again restarts the clock, and changing the launch site recomputes the arrival for the new site. Contracts from before this change have no region and ship instantly. Moon-route Mars flights and tanker, depot and module launches are not affected.

Site letters: every launch site has a letter code, used on the contract board and the map: C for Cape Canaveral, V for Vandenberg and B for Boca Chica and L for Vermilion Parish.

Automatic launch site: loading a contract chooses the best launch site for the whole manifest. A site is eligible when it is open to the company (leased or owned), it can reach the orbit (Vandenberg is the only polar and sun-synchronous site) and it has a pad the vehicle can use (a catch tower for Behemoth and Skyship). Eligible sites are ranked by the earliest day the launch could happen, which is the latest of the payloads' arrival day, the next free pad and today. Ties go to the lower cost (the lease fee and any propellant that would have to be bought at spot), and then to the current site. The Mission tab's launch site changes by itself, and picking a site by hand (map pin or site list) overrides it until the next contract is loaded.

Contract board scrolling: the board shows five contracts at a time. When there are more, the mouse wheel over the Mission tab scrolls it, and two arrow buttons by the heading do the same on touch screens, with a "2-6 of 9" counter.

Contract board: each row has a site badge, for example [V] now or [C] 3d, showing the best site for that contract alone and how many days the payload will take to ship once you load it (for example [C] 6d ship). Nothing ships until the contract is accepted. Hovering shows the customer region and the shipping time to each open site. The map pins show their letters too.

2.15 Phones and Touch (Phase 9)
The game has to be playable from a phone browser. The canvas is a fixed 1280 by 720 landscape layout that scales to fit, so on a phone it is shrunk and needs help.
- Pinch and pan: two fingers pinch to zoom the whole screen (1x to 3x) and drag to pan, and a single finger still taps, drags the globe and presses buttons. Buttons act when the finger is lifted, and not while a two-finger gesture is running, so zooming never presses anything by accident. A Zoom button in the top bar returns to the full view.
- Tips mode: touch screens have no hover, so a Tips button in the top bar turns on a mode where tapping any button or row shows its hint instead of doing its action.
- Fullscreen: a Full button enters fullscreen.
- Portrait: in portrait the page asks the player to rotate the phone.
- Hosting: the game is published as a static site on GitHub Pages (built from the main branch by a workflow), so it can be played away from the home network. Saves live in each browser's own storage.

2.16 Tutorial, Fleet Art, Site Scenes and Undo (Phase 9)
Tutorial: a new company gets a short guided tutorial, shown as a coach card on the map with the next thing to do and a pulsing outline on the dock tab to open. Steps: load a contract, launch, build a replacement Peregrine 9 (the booster was expended), research Skylink Gen-1, fund Booster Landing and build its test article, and fly the test. Each step completes by itself when the player does it. The card can be skipped, and saves from before the tutorial skip it.
Fleet art: every vehicle type has a small drawn silhouette: the Peregrine 9 as a slim white two-stage rocket with grid fins, the Heavy with three cores, the Behemoth and Skyship in stainless steel, the tanker with a stripe, the depot with a ring and module ships as capsules lying on their side. The silhouettes appear on the vehicle buttons, the fleet list and the factory build buttons.
Site scenes: while the Sites or Factory tab is open, a small illustrated card on the map shows the viewed site: its pads with towers (and a catch arm if there is one), a rocket standing on a pad for each ready hull, a glow on a pad that is busy and a red mark on a pad closed for repairs, the hangars with a hull inside while it is being refit, and the tank farm with fill levels.
Undo for the Moon base: placing a module or building a duct can be undone with an Undo button in the Base tab or Z. A duct refunds its cost. A module goes back to the pending list, but only while drones have not started burying it. The last 10 actions are remembered.

2.17 Mars Bases, Mars Fuel and Return Flights (Phase 10)
Mars gets the same kind of base as the Moon, and with fuel made on Mars a ship no longer has to be thrown away there.

Mars base: module ships (the same Habitat, Reactor, Drone Bay, Smelter, Fabricator, Ice Miner and Refinery ships) can now be flown to a Mars landing site, Jezero Crater or Utopia Planitia. The first one founds the base at that site, and every later one has to land at the same site. They fly direct from Earth in a Mars launch window, burn depot propellant (5 t per tonne of ship mass) and take the full direct-route risk: +12% on ascent and 15% on landing. The Moon and Mars each have their own base, with their own grid, modules, power, crew and stockpile. The Moon tab and the Mars tab each get a Base button that zooms into that base. Mars looks different from the Moon: a red dusty surface, and thin air.
- Jezero Crater: delta clays and minerals. No ice, so no fuel production, but a good place for a first base.
- Utopia Planitia: ice under the surface. Ice Miners only work here (and at Shackleton on the Moon).
- Dust storms: about once every 90 days a storm lasts 12 to 30 days. Everything that moves or digs (drones, smelters, ice miners, refineries, the Fabricator) runs at half speed. Reactors are nuclear and keep running. A banner and a toast announce the storm.
- Solar particle events strike as on the Moon, and there is no magnetic field, so the burial rules are the same.

Mars fuel: Mars has carbon dioxide in its air, which the Moon lacks. A Refinery on Mars turns 3 t of ice into 4 t of methalox (the Moon makes 2 t). The Mars stockpile holds 400 t of ice and 1500 t of methalox (the Moon holds 300 and 600).

Mars-based ships and return flights:
- A Skyship that lands at a Mars base (a payload flight to the base's own landing site) is no longer lost. It stays at the base as a Mars-based hull, ready after a 15-day refit. Skyships that land anywhere else on Mars are still one-way.
- The Fabricator on Mars can build a Skyship hull from stockpiled iron, silica and oxygen (the same recipe as the Moon, $35M of imported engines). It appears as a Mars-based hull.
- A Mars-based Skyship can fly home to LEO. This is a return flight: it burns the Mars base's methalox (500 t plus 5 t per tonne of cargo), needs no Earth pad or depot, and takes 200 days. It risks 8% on ascent from Mars and 4% on Earth arrival. It also needs a return window. The Mars-to-Earth windows come about 60 days before each Earth-to-Mars window (the same 26-month cycle, with the stay on Mars of about 15 months in between), and each lasts 30 days. The hull comes back at Cape Canaveral and can fly again.
- Return contracts: once a Mars base has modules, customers on Earth offer Mars return contracts (samples, equipment and crew rotation) at about $3 to $4 per tonne plus a large flat fee, lasting 300 days. They can only be loaded on a flight that leaves from the Mars base.
- Flight origin: with a Mars-based hull ready and LEO selected, a From Earth | From Mars base switch appears in the Mission tab.

Mars experience: every successful arrival at Mars lowers the risks for the next one. The direct route's extra ascent risk falls by 1.5 points per landing (from 12% to a floor of 3%), its landing risk by 2 points (from 15% to 5%), and the Moon route's landing risk by 1 point (from 6% to 3%). The Mission tab shows the current figures.

Milestones: first module on Mars, Mars base founded, first Mars methalox, first return flight home.

2.18 Phone Layout and Depot Docking (Phase 11)
Phone layout: on a short landscape screen (a phone, under about 560 pixels of height) the layout changes so that everything is larger.
- The canvas is shortened from 720 to 530 pixels, which enlarges everything by about a third. The depot and the mission log are dock tabs (2.25), so a phone needs no separate status panel.
- The top bar drops the sparkline and the day count to make room, and the smallest text and buttons are made a little bigger.
- Tablets and desktops keep the full layout.
- View buttons (all devices): Split, Map and Dock sit at the right end of the map's tab row. Split is the usual map-and-dock layout. Map gives the globe or base grid the whole width and hides the dock. Dock hides the map and centres the dock panel, and the buttons move to the free margin on its left. The choice is not saved. The globe, its clip and the base grid are resized to the panel, so pins, rings and the base view all stay lined up.

Depot docking: refueling is shown as a short scene on the map at the LEO pin.
- A tanker arriving: the tanker drifts in from the side, docks with the depot (a flash and a clunk), and propellant dots stream across while "+100 t" floats up and the depot's total is shown.
- A Moon or Mars flight: after the ascent, the ship meets the depot and takes its propellant: the dots flow the other way and "-400 t" floats up with what is left.
- The scene is cosmetic. The depot rules do not change. It plays on the Earth map, and when another body is on screen it plays as a toast only.

Base hints: a waiting Habitat shows a warning in the Base tab until the base has a power source ("place a reactor first, or this habitat's crew will die"), and a habitat with crew and no power shows a red "Crew at risk" line with the fix (connect it to a reactor or solar array with a duct).

2.19 Skylink Rethought: One Constellation, Licensed Markets (Phase 12)
Satellites orbit the whole planet, so the constellation is one global pool, not six regional ones. A batch launched to LEO or Polar LEO joins the pool, and the pool serves every market the company is licensed to sell in. Regions still exist for contract customers (shipping times), but satellites no longer have a target region.

Capacity and demand: each satellite adds 0.3k subscribers of capacity. Each licensed market has subscribers that grow towards a demand ceiling. When total subscribers exceed capacity the network is congested: quality is capacity divided by subscribers, revenue per subscriber falls by that factor, and subscribers start to churn. Satellites decay over 5 years, so capacity shrinks if launches stop.

Markets are unlocked in two ways:
1. Density: a market can only be applied for once the constellation has enough satellites in orbit (the number is its density requirement).
2. Licensing: the company pays a one-time licensing fee to that country or bloc, then waits for approval (days, shown in the tab). Subscribers start arriving once the license is active.

| Market | Density needed | License | Approval | Subscribers at saturation | Revenue per subscriber per month |
| United States | 12 | $3M | 10 d | 36k | $110 |
| Canada & Mexico | 24 | $4M | 20 d | 8k | $95 |
| Maritime & Aviation | 60 | $10M | 90 d | 6k | $300 |
| European Union | 70 | $25M | 120 d | 26k | $100 |
| United Kingdom | 70 | $8M | 60 d | 7k | $110 |
| Australia & New Zealand | 80 | $6M | 60 d | 6k | $105 |
| Latin America | 80 | $12M | 90 d | 14k | $60 |
| Africa | 90 | $14M | 150 d | 24k | $30 |
| Japan & Korea | 100 | $15M | 120 d | 14k | $95 |
| India | 110 | $20M | 240 d | 12k | $25 |
| Southeast Asia | 120 | $10M | 150 d | 10k | $40 |

Service plan (the balancing lever): Budget (price x0.7, demand x1.5), Standard (x1, x1) and Premium (price x1.4, demand x0.6). A thin constellation can run Premium to earn from fewer users without congestion; a dense one runs Budget to fill its capacity. Changing plan moves each market's subscribers towards the new ceiling over time.

The Skylink tab shows satellites, capacity against subscribers with a congestion bar, the three plans, and one row per market with its status (locked with the density needed, approval pending, or active with subscribers and revenue) and a License button. Old saves have their regional satellites pooled and the markets in the regions they covered licensed for free. Milestones: first licensed market and 50k and 100k subscribers.

2.20 Satellite Generations and Mobile Service (Phase 13)
Skylink satellites come in generations, each its own batch type on the Mission tab (a Gen button next to the +/- buttons cycles through the ones researched). The constellation pool tracks how many of each generation are in orbit, and capacity is the sum.
| | Gen-1 | Gen-2 Mini | Gen-3 |
| Capacity per satellite | 0.3k subscribers | 1.2k | 5k |
| Mass / volume | 0.27 t / 0.9 m3 | 0.8 t / 1.8 m3 | 2.0 t / 3.5 m3 |
| Cost | $0.35M | $0.7M | $2M |
| Life | 5 years | 5 years | 7 years |
| Rides on | any payload vehicle | any payload vehicle | Skyship only |
| Research | Skylink Gen-1 ($5M) | Skylink Gen-2 ($60M, needs Rapid Reflight) | Skylink Gen-3 ($300M, needs Skyship and Gen-2) |
Gen-2 Mini matches the real V2 Mini, which flies on a Falcon 9: a Peregrine 9 carries 24 of them (about four times the capacity of a Gen-1 batch). Gen-3 is the full-size satellite that needs a Starship-class vehicle.

Mobile service (direct-to-cell): a separate research, Direct-to-Cell ($80M, needs Skylink Gen-2), opens a second tab of markets, mobile carriers, licensed the same way as broadband (density, a fee and an approval wait) but with a carrier agreement per country or bloc. Two differences: the density requirement counts only Gen-2 and Gen-3 satellites, and a mobile subscriber is light (text and data), so each one loads the network at a fraction of a broadband subscriber. Mobile is many subscribers at a low price, so it fills capacity quickly and rewards the higher-capacity generations. Mobile markets: US, EU, UK, Australia & NZ, Japan & Korea, Latin America, Africa and India carriers. Congestion is shared: mobile and broadband compete for the same capacity.

Old saves keep their satellites as Gen-1 (save version 10).

2.21 Goals and Endgame (Phase 14)
Until now the game has no aim: every system adds income and nothing says what the income is for. This phase adds a ladder of goals, a final win and an ending screen. There is still no way to lose (investors fund a new hull if the company is stuck, see 2.5), so goals are about direction, not pressure.

Objectives: the goals are grouped into seven chapters. Exactly one chapter is current, and its unfinished objectives are listed with progress ("Skylink subscribers 31k / 50k"). Objectives can be finished in any order within a chapter. Only the current chapter's objectives are ticked, so a later chapter's objective that is already true counts the moment its chapter opens. Each objective is a pure test of the game state, so the game never needs extra bookkeeping to tell whether it is done.

| Chapter | Objectives (all must be done) |
| 1. Orbit | First successful flight; 10 successful flights; first booster landing; first reflown booster |
| 2. Pay the Bills | Research Skylink Gen-1; first licensed market; net income positive for 30 days in a row; 50k Skylink subscribers |
| 3. Own the Pads | Buy Cape Canaveral; own two launch sites; run three pads (pads at owned sites, counted together) |
| 4. Super-Heavy | Operational Skyship; LEO depot online; buy Boca Chica; 50 flights with a catch-tower vehicle |
| 5. The Moon | First cargo on the Moon; Moon base founded; a habitat with crew on a powered base; lunar methalox in the stockpile |
| 6. The Red Planet | First delivery to Mars; Mars base founded; first flight home from Mars |
| 7. A Colony | Hold the colony conditions below for 180 days in a row |

The colony conditions (chapter 7) are all true at once on the Mars base: at least three habitats with crew (18 people), every habitat powered, an Ice Miner and a Refinery both running (so the base makes its own methalox), and a Mars-based Skyship that has already flown home. If any condition fails the 180-day counter resets, and the Goals panel names the condition that broke it. Dust storms make this a real test, since drones, miners and refineries slow down in one.

Rewards: finishing a chapter pays an investor grant, sized to about 5% of what that era costs so that it speeds the game up slightly and never decides it: Orbit $5M, Pay the Bills $10M, Own the Pads $25M, Super-Heavy $60M, The Moon $120M, The Red Planet $250M. Each finished objective shows a toast and goes in the mission log with its date. Finishing a chapter shows the milestone banner and pays the grant.

Victory: when the 180 days are held, the game pauses on an ending screen with the company's record: date reached and years taken, flights flown and lost, total satellites launched, peak Skylink subscribers, cash and the Moon and Mars base crew. The best (earliest) finish is kept in the browser and shown on the next ending screen. Play can then continue as a sandbox, and the goal strip reads "Colony won".

Screen: a one-line goal strip sits at the bottom of the map panel and shows the current objective with its progress. Pressing it opens the Goals panel over the map, with all seven chapters, finished ones ticked with the day they were done, and the current chapter expanded. The strip is hidden while the tutorial coach is on screen.

Saves: goals are stored as { id: day } in the save (version 11). Loading an older save marks every objective that is already true as done, dated to the day of loading, so nobody has to repeat what they have achieved.

Balance check: tools/campaign-bot.mjs plays the whole game (sites, Moon base, Mars colony) and reports the day each chapter completes (GOALS=1 on the pacing bot lists every objective). After satellite capacity moved to hull mass and volume (2.23), the bot's Pay the Bills chapter fell from about 1520 to 1280 days (631 with GEN=1, which researches Gen-2 and Gen-3 early), and the later chapters did not move beyond run-to-run noise (colony 7290, or 6510 with GEN=1). Eight runs, medians with the range, in game days: Orbit 166, Pay the Bills 1521 (640 to 2911), Own the Pads 2177, Super-Heavy 2323, The Moon 2746, The Red Planet 6350 (4796 to 7910) and the colony win 6529 (4975 to 8089), which is about 18 years (13.6 to 22). The bot ends with $40B or more, so money is not the limit after the Moon: the Mars build is paced by the launch windows (30 days every 26 months), the 500 t depot (one module ship burns 400 t, so four tanker flights per module) and the loss rate on Mars arrivals. The target for a human is chapters 1 to 3 inside the first four years and the colony win in game year 14 to 16, so the bot is a little slow at the end, which fits a bot that never optimises.

2.22 Loadouts: Draft, Lock In and Automatic Launch (Phase 15)
Accepting a contract and loading a rocket are now two separate steps, and the launch happens by itself.

1. Draft: clicking contracts (and adding Skylink satellite batches) builds a draft loadout on the selected rocket. Nothing ships yet, and the draft can be changed freely. The board shows each contract's shipping time as "6d ship", which is what it will take once the loadout is locked.
2. Lock in: the LOCK IN LOADOUT button (in place of LAUNCH for payload rockets) accepts every contract in the draft at once and moves the loadout off the draft, remembering its rocket, destination, launch site, contracts and satellites. The draft is empty again, so another rocket can be loaded and locked straight away: any number of loadouts can be locked at once. Each contract's payload ships to its loadout's launch site (2.14), and a satellite batch ships from the plant at Cape Canaveral. A locked loadout is fixed: only cancelling changes it, and its contracts no longer expire.
3. Skylink shipping time by site: Cape Canaveral 0 days, Boca Chica 2, Vermilion Parish 2, Vandenberg 3.
4. Indicator: a contract in a locked loadout shows a padlock on the board in place of its site badge, with the days left until its payload arrives ("3d", or "ready"). It cannot be drafted again. With the draft empty, the space under the manifest bars lists the locked loadouts (rocket, destination, satellites and what each is waiting for) with a Cancel button each.
5. Automatic launch: every day each locked loadout is checked. Once every payload and satellite batch has arrived and nothing else blocks it (a ready hull of that rocket, a free pad, cash, depot propellant, the Mars window), it launches without a click, with the usual launch effect. Two loadouts on the same rocket type need two ready hulls, and they take turns on the pads. Launch costs and propellant are charged at launch, not when locking, so loadouts compete for the same cash and depot propellant and one can wait for another.
6. Cancel: the Cancel button, or clicking any padlocked contract, withdraws that whole loadout. Its contracts go back to the board as ordinary offers, the shipping clock is forgotten and nothing is charged.

The manual LAUNCH button still works for tankers, depot and module ships (no contracts, never locked) and for a draft that needs no shipping (no region, or satellites only at Cape Canaveral). Old saves load with no locked loadouts.

2.23 The Satellite Plant: Build Before You Launch (Phase 15)
Skylink satellites used to appear from nowhere and be paid for at launch. They are now built first and kept in stock.

- The plant: Skylink satellites are built at the company's plant beside the Cape Canaveral factory, on a line of their own that never competes with the rocket lines. It runs three batches at once (3 lines), in the order queued. Each generation can be queued once its research is done: Gen-1 $2.1M and 1 day per batch, Gen-2 Mini $4.2M and 2 days, Gen-3 $12M and 3 days (6 satellites at the generation's unit price, from the SATS table). The cost is paid when the batch is queued, so building ahead ties cash up. A batch that has not started can be cancelled for a 50% refund. Up to 30 batches can be queued, and a x5 button queues five at once. A hull's satellite capacity is min(payload mass / satellite mass, fairing volume / satellite volume) after any contracts on the manifest, rounded down to a batch; RTLS landing cuts it with the payload. The loadout row has -30, -6, +6, +30 and Fill (everything built that fits). Finished satellites go into the stock of their generation. The Factory tab has a SATELLITE PLANT strip with stock, the batch in work and a button to queue a batch of each generation.
- Using them: a draft loadout can only carry satellites that are in stock, so the +6 button stops at the stock and the Mission tab shows how many of the current generation are built. The cost of satellites is no longer part of the launch cost or the launch receipt: it was paid when they were built. Locking a loadout takes its satellites out of the stock (so two loadouts cannot use the same ones) and cancelling it puts them back. A draft that is launched by hand takes them at launch. A satellite that is lost with a failed launch is lost.
- Shipping: satellites travel from the plant to the launch site as set out in 2.22 (0 days to Cape Canaveral, up to 3 to Vandenberg).
- Saves: old saves start with no satellites in stock. A draft or locked loadout from an earlier build loses its satellite count.
- Pacing: building ahead is a real decision now (cash tied up in stock, a Gen-1 batch costs less than one launch), and Gen-3 takes the longest, so a stream of Skyship launches with Gen-3 is limited by the plant (60 satellites is 10 batches, 30 days) unless stock was built ahead.

2.24 Longer-Lived Boosters, Hull Locations and Shipping Hulls (Phase 15)
Three changes that go together: boosters can be made to last, a hull is in one place at a time, and the automatic launch-site pick knows where the hulls are.

Core Life research (R&D): the Peregrine 9 and Peregrine Heavy are rated for 10 flights. Three techs, bought one after another, raise the rating and make an old core less likely to fail (the failure risk added per flight flown is multiplied by the factor shown). They apply to every Peregrine hull, existing ones included.
| Tech | Cost | Needs | Rated flights | Wear risk per flight |
| Core Life I | $45M | Rapid Reflight | 20 | x0.6 |
| Core Life II | $140M | Core Life I, Peregrine Heavy | 35 | x0.4 |
| Core Life III | $350M | Core Life II, Operational Skyship | 50 | x0.3 |
The Skyship family (40 flights), the Behemoth (4) and the single-use hulls are not changed.

Hull locations: every hull is at one place: a launch site, or the Moon or Mars base. A launch from a site needs a ready hull of that type at that site. A hull comes back to the site it launched from (it lands there) and a newly built hull appears at the factory site it was built in. The Fleet tab shows each hull's site, and a hull that is being moved shows "shipping" and its destination.
Shipping a hull: a ready Earth hull can be shipped to another site you can launch from, by road or barge. It costs money and takes days, and the hull cannot fly until it arrives.
| Between | Days |
| Cape Canaveral and Vermilion Parish | 4 |
| Cape Canaveral and Boca Chica | 5 |
| Boca Chica and Vermilion Parish | 2 |
| Vandenberg and Cape Canaveral | 7 |
| Vandenberg and Boca Chica, or Vermilion Parish | 6 |
The cost is 2% of the hull's build cost, at least $0.2M (about $1.2M for a Skyship). In the Fleet tab each ready hull has a button that sends it to the next open site.
Automatic shipping: when a loadout is locked in for a site that has no hull of that type (counting hulls already on the way, and one per other locked loadout waiting for the same type there), the game ships the least worn ready hull from another site by itself, and keeps trying each day until one is free to go. The loadout's launch waits for the hull as it waits for the payloads, and says so ("Peregrine 9 arrives in 4 days"). A manual launch from a site with no hull says where the nearest one is.
Launch-site pick: the automatic pick (2.14) now also counts the day a hull of the selected type could be at each site (now if one is there, else when one could arrive) and the days Skylink satellites need to ship, so with a hull at Boca Chica and none at Cape it prefers Boca Chica. It also works for a satellites-only draft. It runs when you load or unload a contract or change the satellite count, and a site picked by hand sticks until then.

3. Technology Tree
Costs are in $M. "Flight" means the tech needs a prototype test flight (2.12). Prerequisites are as built.

| Era | Tech | Cost | Needs | Notes |
| Peregrine | Booster Landing | 30 | none | Flight test. RTLS recovery |
| Peregrine | Droneship Recovery | 40 | Booster Landing | Flight test |
| Peregrine | Rapid Reflight | 25 | Booster Landing | |
| Peregrine | Propellant Plants | 70 | Rapid Reflight | Owned sites can build plants |
| Peregrine | Skylink Gen-1 | 5 | none | Starts passive income |
| Peregrine | Skylink Gen-2 | 60 | Rapid Reflight, Gen-1 | Gen-2 Mini satellites (2.20) |
| Peregrine | Direct-to-Cell | 80 | Skylink Gen-2 | Mobile carrier markets (2.20) |
| Peregrine | Peregrine Heavy | 60 | Rapid Reflight | Flight test |
| Super-Heavy | Stainless Hull | 120 | Peregrine Heavy, Gen-1 | Flight test |
| Super-Heavy | Harrier V3 | 150 | Peregrine Heavy, Gen-1 | Flight test |
| Super-Heavy | Heat Shield Tiles | 140 | Peregrine Heavy, Gen-1 | Flight test |
| Super-Heavy | Operational Skyship | 400 | Stainless Hull, Harrier V3, Heat Shield Tiles | Also needs 3 successful Behemoth flights. The three techs above unlock the Behemoth Prototype |
| Super-Heavy | Skylink Gen-3 | 300 | Operational Skyship, Gen-2 | Gen-3 satellites (2.20) |
| Lunar | Orbital Tanker | 600 | Operational Skyship | Flight test |
| Lunar | Moon Habitat Core | 900 | Operational Skyship | |
| Lunar | Lunar ISRU Mining | 1200 | Operational Skyship | |
| Lunar | Lunar Ice Mining | 700 | Lunar ISRU Mining | |
| Mars | Mars Transfer Vehicle | 2000 | Lunar Ice Mining, Moon Habitat Core | Mars orbit, sites, bases and routes (2.9, 2.17) |

4. User Interface Architecture
The primary screen is the map view with a docked control panel. There is no bottom strip: both panels run to the foot of the screen (2.25).

+------------------------------------------------+-----------------------------------------+
|  [ Earth | Moon | Mars ]        [Split|Map|Dock]|  [ icon tabs: Mission Fleet Factory Sites |
|  +- transit lane ribbon (after first lunar -+  |   Base R&D Skylink Depot Log ]          |
|  |  flight): Earth --- Moon --- Mars        |  |                                         |
|  3D planet, drag to rotate                      |  The tab's panel, full height           |
|  Orbit rings + landing-site pins (click)        |                                         |
|  Site card (Sites/Factory)        Goal strip    |                                         |
+------------------------------------------------+-----------------------------------------+

Map layers: the 3D planet model (Three.js, rendered to a texture inside Phaser), 2D pins and labels, and 2D dashed flight trails. Pins on the back of the planet are hidden.
Dock tabs: Mission (planning and launch), Fleet (hulls and pads), Factory (queue and lines), Sites (launch sites, infrastructure and supply), R&D (tech tree), Skylink (constellation, service plan and markets), once a base exists, Base, once the LEO depot is deployed, Depot, and Log.
Base view: once a base exists the Moon tab gains a Base button. It zooms the 3D Moon into the landing site and fades to a top-down grid of the base, where modules are drawn as tubes, ducts as ribbed hoses, buried modules under regolith and drones moving between pits and modules. A Base tab in the dock shows power, crew, stockpile, pending modules, drone focus and the Fabricator queue.
5. Sound & Visual Style Guide
Visual Style: Vector-based 2D flat isometric UI with clean line art, high-contrast HUD overlays, and subtle particle telemetry effects for launches.

Audio Direction: Synthesized Web Audio soundtrack featuring ambient synth-wave music during planning phases and punchy, low-frequency sound effects for rocket engine ignition, stage separation, and docking confirmation.

6. Implementation Status
Built: Earth operations, contract board with reputation, manifest stacking, Skylink constellation and revenue, R&D tree, LEO depot, save/load, fleet, factory queue per site, destinations, Earth/Moon/Mars map with flight trails, Moon base (module ships, base view, ducts, burial drones, smelters, local fabrication), launch sites, hangars, droneships, recovery modes, fuel market and plants.
This phase (4b): ice miners and refineries, lunar methalox, Moon-built Skyships, the Mars Transfer tech, Mars contracts and launch windows, direct and Moon-based Mars routes, arrival risk.
Phase 6a: the 2010 start with seed funding, expendable boosters and landing research, the calendar and real Mars windows, prototype test flights with dice-roll research, and aluminum for Peregrine hulls.
Phase 7: launch sequence, floating cash, sparkline and runway, launch receipt, milestones, toasts, auto-pause, synthesized sound and keyboard shortcuts.
Phase 8: customer regions, payload shipping time, site letters and automatic launch-site choice.
Phase 9: touch and phone support, GitHub Pages hosting, tutorial, fleet art, site scenes and base undo.
Phase 10: Mars bases, dust storms, Mars methalox, Mars-based Skyships and return flights.
Phase 11: phone layout (hidden status strip, shorter canvas), view buttons and the depot docking scene.
Phase 12: Skylink as one global constellation, licensed markets, capacity versus subscribers and service plans (2.19). Also in this stretch: the Boca Chica prototype yard and Vermilion Parish (2.10), and separate RP-1, methane and LOX tanks.
Phase 13: satellite generations Gen-1/2/3 and mobile carrier markets (2.20). Save version 10.
Playtest numbers (pacing bot, 10 runs, medians; day 1 is 1 Jan 2010): Booster Landing day 131, Rapid Reflight 629, Behemoth 1642, Operational Skyship 1970, first lunar flight 2291. About 52 launches a year, about 9 lost vehicles in 2500 days. With the Gen-2 path (GEN=1) the first mobile market only opens near day 2731.
Phase 14: goals and an endgame (2.21): seven chapters, a goal strip and Goals panel, the 180-day colony win and an ending screen. Save version 11.
2.25 Screen Layout: Lane, Depot and Log (Phase 15)
The bottom strip is gone. The map and the dock each run the full height of the screen, which gives the Mission tab a contract board that grows from five to nine rows with the number of contracts and up to four locked-loadout rows at once (a phone keeps five and two), the Fleet tab twelve hull rows that scroll like the contract board, and the other tabs use the height too: taller R&D and Skylink rows, a five-row build queue and taller build buttons in the Factory, taller tank rows in Sites, six waiting modules and nine placed ones in the Base tab and the map more space.
- Transit lane: a translucent ribbon along the top of the map (Earth, Moon and Mars, with flights gliding between them). It stays hidden until a flight first goes beyond Earth orbit (saved as farFlown, and set from past trips on old saves), and is hidden in the Dock-only view. The Moon and Mars buttons above the map show how many flights are heading there.
- Dock tabs are icons (rocket, rockets, factory, pin, dome, flask, satellite, tank, list) in a row of 56 px buttons, so up to nine fit. Hovering one shows its name in a small tooltip under the tab. The tutorial still highlights the tab it wants.
- Depot tab: appears only once the depot is deployed. It shows the stored propellant big, a tank gauge with a division per tanker load, boil-off, tankers en route, and what the selected mission needs.
- Log tab: flights in transit on top, then the mission log, newest first, colour-coded (red problems, amber warnings, green good news), with All / Good news / Problems filters, mouse wheel or arrow scrolling, and an amber dot on the tab when new entries arrived. The log keeps the last 200 entries.

Next (design in progress): a launch-cadence and Direct-to-Cell gating retune, and crew (a capsule, crew contracts and base crew rotation).
