interface Commands {
  /**
   * tell all creeps and structures to rebalance their jobs
   */
  shuffle: boolean;

  /**
   * reload memoized configurations
   */
  commit: boolean;
}

interface Options {
  /**
   * BURN IT DOWN, and fuck that guy who's attackin you
   *
   * build walls and stop banking RCL
   *
   * TODO pathing mazes, cpu harassment
   */
  respawn: boolean;

  /**
   * final stage, stop mining and spend it all then automatically die
   *
   * TODO trade minerals for energy
   */
  suicide: boolean;

  /**
   * cpu exhaustion threshold
   */
  cpuOut: number;

  /**
   * cpu warning threshold
   */
  cpuWarn: number;

  /**
   * number of ticks between gamestate rescoring
   */
  rescoreTicks: number;

  /**
   * number of ticket between remote room thinks
   */
  remoteRoomscanTicks: number;

  /**
   * number of ticks between visible room discovery and think
   */
  roomscanTicks: number;
}