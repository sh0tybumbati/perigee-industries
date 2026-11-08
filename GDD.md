Game Design Document (GDD): Perigee Industries
Version: 0.5 (Pre-Alpha Spec: lunar ice, Moon-built ships and Mars)

Genre: Space Logistics & Base-Building Tycoon Sim

Target Platform: PC (Web HTML5 / Desktop)

Engine & Tech: Phaser 3 (UI, 2D layers) + Three.js (3D planet maps) / HTML5 Canvas + Web Audio API

1. Executive Summary
1.1 Core Concept
Perigee Industries is a heavy-lift logistics and off-world base-building management game. Players start as an early commercial space launch firm operating small workhorse rockets, managing launch schedules, taking customer satellite contracts, and building a low-Earth orbit (LEO) broadband constellation for passive income.

As revenue scales, players fund heavy-lift R&D to unlock fully reusable super-heavy launch vehicles, establish orbital fuel depots, and execute high-tonnage cargo drops to construct a self-sustaining lunar base.

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
Booster recovery has three modes for Peregrine launches:
- RTLS (return to launch site): -20% payload, and the booster is back at the pad at once.
- Droneship: full payload, but it needs a free droneship, which is out at sea and busy for 4 days, and the booster reaches its hangar 2 days later.
- Expend: the booster is thrown away for +15% payload. The hull is lost and needs no refit.

2.2 Broadband Constellation Network (Passive Income)
Orbital Shells: Earth orbit is split into 4 distinct latitude/altitude shells (LEO Equatorial, LEO Polar, MEO, GEO).

Deployment Cadence: Peregrine 9 carries up to 24 satellites per launch; Skyship carries up to 60 Gen-2 satellites.

Regional Market Grid: Earth is divided into 6 market regions (North America, Europe, Asia-Pacific, South America, Africa, Maritime/Aviation).

Bandwidth & Churn: Satellites slowly decay over a 5-year operational lifecycle. Players must maintain satellite replenishment launches to prevent regional service blackouts and revenue loss.

+-----------------------------------------------------------------------+
|                       SKYLINK COVERAGE MATRIX                        |
+-------------------+-+-------------------+-----------------------------+
| Region            | | Coverage (%)      | Daily Passive Revenue       |
+-------------------+-+-------------------+-----------------------------+
| North America     | | [██████████] 100% | $450,000 / day              |
| Europe            | | [████████░░]  80% | $310,000 / day              |
| Asia-Pacific      | | [██████░░░░]  60% | $220,000 / day              |
| Maritime & Air    | | [████░░░░░░]  40% | $140,000 / day              |
+-------------------+-+-------------------+-----------------------------+
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
| Habitat / Reactor / ISRU Skyship | TBD | TBD | Moon-base phase (see 2.4); shown locked in the factory |

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
| Mars orbit, Jezero Crater, Utopia Planitia | Mars | Orbit / Sites | about 180 | TBD | Mars Transfer tech (planned, shown locked) |

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
A transit lane along the bottom shows flights that are between bodies, with their arrival times.

2.7 Contracts vs. Building the Base
The central tension of the game: the same Skyship capacity can carry a paying customer's payload or the company's own base modules. Customer contracts fund the base, and every flight spent on the base is a flight not earning money. Base modules are delivered to a chosen landing site on the Moon map, and the base is built up there following the dependencies in 2.4. Mars follows the same pattern after the Mars Transfer tech.

Reputation: every successful flight builds the company's reputation. At 40 flights new contracts arrive every 2 days and the board holds 10, and at 120 flights they arrive daily and the board holds 12. A bigger fleet, more pads and more hangars only pay off when there is more work, and this is how the work grows.

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

Mars: the Mars Transfer Vehicle tech (needs Lunar Ice Mining and the Habitat tech) unlocks Mars orbit, Jezero Crater and Utopia Planitia, and Mars cargo contracts. Mars contracts are large (30 to 100 t) and pay roughly four times what lunar cargo pays per tonne, but the cash only arrives when the flight does, about 6 months later. Mars hulls are single use because there is no fuel at Mars yet.
Launch windows: the planets line up for about 60 days every 780 days (the first window opens on day 420). Outside a window no Mars flight can launch, so the player has to plan ahead. Mars contracts last 200 days to give time to prepare.
Two routes to Mars:
- Direct from Earth: any Earth Skyship with a catch tower. It burns depot propellant (5 t per tonne of payload plus the usual launch fuel). It is risky: +12% risk on ascent and 15% risk of being lost on arrival. 180 days.
- From the Moon: a Moon-built Skyship leaves the base. It burns the base's lunar methalox (450 t plus 4 t per tonne of payload) and needs no Earth pad, tanker or depot. The arrival risk is 6%. 175 days. It needs the whole chain: a base at Shackleton, ice miners, refineries and a Fabricator.
Arrival can fail: a Mars-bound flight that survives launch can still be lost entering the Martian atmosphere.

Later (phase 6): Mars bases, Mars ice and fuel, and return flights.

2.10 Launch Sites, Infrastructure & Supply (Phase 5)
The company no longer owns a generic pad. It uses launch sites, and a site is either leased or owned.

Rent first, buy later: the company starts by leasing Pad 39A and a rented hangar at Cape Canaveral. Leasing keeps early capital free but costs a fee on every launch ($0.15M per leased launch) and every refit ($0.08M per rented hangar refit), and a leased site cannot expand. Buying a site removes the fees and lets it grow.

| Site | Role | Pads | Acquire | Notes |
| Cape Canaveral | Home site: LEO, GTO, lunar | 3 | Starts leased, buy for $60M | No polar or sun-synchronous launches (overflight rules) |
| Vandenberg | The only polar and sun-synchronous launches | 2 | Lease for $15M, buy for $85M | LEO family only, and no factory |
| Boca Chica (Starbase) | Super-heavy site | 2 | Buy for $120M | Pads come with catch towers. Catch vehicles (Behemoth, Skyship) cost 15% less and build 15% faster here |

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

3. Technology Tree
                      [ PEREGRINE ERA ]
                              │
               ┌──────────────┴──────────────┐
               ▼                             ▼
    [ Fast Turnaround Cores ]      [ Skylink Gen-1 Satellites ]
               │                             │
               └──────────────┬──────────────┘
                              │
                              ▼
                  [ SUPER-HEAVY R&D ERA ]
                              │
               ┌──────────────┼──────────────┐
               ▼              ▼              ▼
     [ Stainless Hull ]  [ Harrier V3 ]  [ Heat Shield Tiles ]  ->  Behemoth Prototype
                              (3 successful Behemoth flights qualify the Operational Skyship)
               │              │              │
               └──────────────┼──────────────┘
                              │
                              ▼
                  [ LUNAR LOGISTICS ERA ]
                              │
      ┌───────────────────────┼───────────────────────┐
      ▼                       ▼                       ▼
[ Orbital Tanker ]    [ Moon Habitat Core ]   [ Lunar ISRU Mining ]
4. User Interface Architecture
The primary screen is the map view, with a docked control panel and a bottom strip for transit and logs.

+------------------------------------------------+-----------------------------------------+
|  MAP VIEW  [ Earth | Moon | Mars ]              |  DOCK  [ Mission | Fleet | Factory |     |
|  3D planet, drag to rotate                      |          R&D | Skylink ]                |
|  Orbit rings + landing-site pins (click)        |  Mission: destination, vehicle,          |
|  Active flights: pins with dashed trails        |   contracts for that destination,        |
|  Past flights: faded dashed lines               |   manifest bars, LAUNCH                  |
+------------------------------------------------+  Fleet: hulls, states, pads              |
|  TRANSIT LANE: Earth --- Moon --- Mars          |  Factory: production queue, lines        |
|  Flights en route and arrival times             +-----------------------------------------+
|                                                 |  LEO DEPOT BAR + MISSION LOG             |
+------------------------------------------------+-----------------------------------------+

Map layers: the 3D planet model (Three.js, rendered to a texture inside Phaser), 2D pins and labels, and 2D dashed flight trails. Pins on the back of the planet are hidden.
Dock tabs: Mission (planning and launch), Fleet (hulls and pads), Factory (queue and lines), R&D (tech tree), Skylink (regional coverage and satellite target).
Base view: once a base exists the Moon tab gains a Base button. It zooms the 3D Moon into the landing site and fades to a top-down grid of the base, where modules are drawn as tubes, ducts as ribbed hoses, buried modules under regolith and drones moving between pits and modules. A Base tab in the dock shows power, crew, stockpile, pending modules, drone focus and the Fabricator queue.
5. Sound & Visual Style Guide
Visual Style: Vector-based 2D flat isometric UI with clean line art, high-contrast HUD overlays, and subtle particle telemetry effects for launches.

Audio Direction: Synthesized Web Audio soundtrack featuring ambient synth-wave music during planning phases and punchy, low-frequency sound effects for rocket engine ignition, stage separation, and docking confirmation.

6. Implementation Status
Built: Earth operations, contract board with reputation, manifest stacking, Skylink constellation and revenue, R&D tree, LEO depot, save/load, fleet, factory queue per site, destinations, Earth/Moon/Mars map with flight trails, Moon base (module ships, base view, ducts, burial drones, smelters, local fabrication), launch sites, hangars, droneships, recovery modes, fuel market and plants.
This phase (4b): ice miners and refineries, lunar methalox, Moon-built Skyships, the Mars Transfer tech, Mars contracts and launch windows, direct and Moon-based Mars routes, arrival risk.
Next: Mars bases and Mars fuel, return flights, Web Audio.
