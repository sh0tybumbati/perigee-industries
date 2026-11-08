Game Design Document (GDD): Perigee Industries
Version: 0.1 (Pre-Alpha Spec)

Genre: Space Logistics & Base-Building Tycoon Sim

Target Platform: PC (Web HTML5 / Desktop)

Engine & Tech: Phaser 3 / HTML5 Canvas + Web Audio API (or Godot 4)

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
     [ Stainless Hull ]  [ Harrier V3 ]  [ Heat Shield Tiles ]
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
The primary screen uses a dual-viewport dashboard:

+------------------------------------+------------------------------------+
|  VIEWPORT A: EARTH & FLEET OPS     |  VIEWPORT B: LUNAR OUTPOST         |
|  - Active Launch Pads (Pad 39A/BC) |  - Isometric Base Grid (Shackleton)|
|  - Production Queue (Booster/Ship) |  - Power & Life Support Gauges     |
|  - Global Skylink Heatmap Layer   |  - Incoming Cargo Drop Vectors     |
+------------------------------------+------------------------------------+
|  LOGISTICS & MANIFEST CONTROLLER                                        |
|  - Contract Selection Board (Mass, Volume, Destination, Payout)        |
|  - Payload Stacking Drag-and-Drop Interface                             |
|  - LEO Propellant Depot Tonnage Bar                                    |
+-------------------------------------------------------------------------+
5. Sound & Visual Style Guide
Visual Style: Vector-based 2D flat isometric UI with clean line art, high-contrast HUD overlays, and subtle particle telemetry effects for launches.

Audio Direction: Synthesized Web Audio soundtrack featuring ambient synth-wave music during planning phases and punchy, low-frequency sound effects for rocket engine ignition, stage separation, and docking confirmation.