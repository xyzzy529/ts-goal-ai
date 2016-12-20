type MapMatrices = { [room: string]: CostMatrix };

/**
 * heat range is initialized at 0x80 + original cost * 8
 *
 * swamps > 208
 * plain > 136
 */
function heatRange(n: number) {
  return 0x80 + 8 * n;
}

export default class MapManager {
  public energySource: MapMatrices;
  public energySink: MapMatrices;
  private _loaded?: boolean;

  public load(mem: any) {
    if (this._loaded || !mem) {
      return;
    }

    this.energySink = {} as MapMatrices;
    this.energySource = {} as MapMatrices;

    const names = Object.getOwnPropertyNames(mem);
    for (let i = names.length - 1; i >= 0; i--) {
      const maps = mem[names[i]] as any;
      const mapsOut = (this as any)[names[i]];
      for (const map in maps) {
        mapsOut[map] = PathFinder.CostMatrix.deserialize(maps[map]);
      }
    }

    this._loaded = true;
  }

  // TODO dirty / elided serialization?

  public store(): any {
    const mem = {} as any;
    const names = Object.getOwnPropertyNames(this);
    for (let i = names.length - 1; i >= 0; i--) {
      if (!names[i].startsWith("_")) {
        const maps = (this as any)[names[i]] as MapMatrices;
        const mapsOut = mem[names[i]] = {} as any;
        for (const map in maps) {
          mapsOut[map] = maps[map].serialize();
        }
      }
    }

    return mem;
  }

  public makePathfindingGrid2(room: Room, opts?: FindPathOpts) {
    let saveMatrix = {} as CostMatrix;
    opts = opts ? Object.create(opts) : {} as FindPathOpts;
    opts.costCallback = function (name: string, matrix: CostMatrix) {
      name = name;
      saveMatrix = matrix;
      return true;
    };
    room.findPath(new RoomPosition(24, 24, room.name), new RoomPosition(25, 25, room.name), opts);
    return saveMatrix;
  }

  public transform(costs: CostMatrix, transform: (n: number) => number) {
    for (let x = 49; x >= 0; x--) {
      for (let y = 49; y >= 0; y--) {
        let value = transform(costs.get(x, y));
        if (value > 0xFF) {
          value = 0xFF;
        } else if (value < 0) {
          value = 0;
        }
        costs.set(x, y, value);
      }
    }
  }

  public init(roomName: string) {
    const costs = this.makePathfindingGrid2(Game.rooms[roomName], {
      ignoreCreeps: true,
      ignoreDestructibleStructures: true,
      ignoreRoads: true,
    });
    this.transform(costs, heatRange);
    return costs;
  }
}