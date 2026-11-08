Game Design Document (GDD): Perigee Industries
Version: 0.2 (Pre-Alpha Spec: fleet, production and map interface)

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

2.7 Contracts vs. Building the Base (Moon-base phase, planned)
The central tension of the game: the same Skyship capacity can carry a paying customer's payload or the company's own base modules. Customer contracts fund the base, and every flight spent on the base is a flight not earning money. Base modules are delivered to a chosen landing site on the Moon map, and the base is built up there following the dependencies in 2.4. Mars follows the same pattern after the Mars Transfer tech.

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
Later phase: a Lunar Outpost view for the isometric base grid at the selected landing site.
5. Sound & Visual Style Guide
Visual Style: Vector-based 2D flat isometric UI with clean line art, high-contrast HUD overlays, and subtle particle telemetry effects for launches.

Audio Direction: Synthesized Web Audio soundtrack featuring ambient synth-wave music during planning phases and punchy, low-frequency sound effects for rocket engine ignition, stage separation, and docking confirmation.

6. Implementation Status
Built: Earth operations, contract board, manifest stacking, Skylink constellation and revenue, R&D tree through the Operational Skyship and Orbital Tanker, LEO depot, save/load.
This phase: fleet inventory, pads, factory queue, destinations, Earth/Moon/Mars map interface with flight trails.
Next: Moon base modules (habitat, reactor, ISRU), contracts-vs-base tension, Mars Transfer and Mars sites, Web Audio.
