import State from "../state/abstractState";
import Plan from "./plan";
import {CandidateFactory, GoalFactory} from "../filters";
import {goals} from "./goals";

/**
 * simplified goal interface, uses closures to spawn dependent goals
 * A actor type
 * R resource type
 * M state type
 */
abstract class Goal<A, R, M extends State<A>> {
  constructor() {
    true === true;
  }

  public abstract getGoalKey(): string;

  public toString(): string {
    return this.getGoalKey();
  }

  /**
   * construct state given actor
   *
   * @param subject
   */
  public abstract state(actor: A): M;

  /**
   * build global goals, examine rooms
   *
   * @returns rich plan with all possible candidates assigned
   */
  public plan(state: M): Plan<R>[] {
    if (state.isPaused() || this.isPaused()) {
      console.log("paused");
      return [];
    }

    return this._identifyResources(state).map((resource) => {
      const plan = new Plan<R>(this, resource);

      for (const name of this._goalPriority()) {
        let candidates: any[] = this._buildCandidateActors(name, state);

        for (const actor of candidates) {
          const goal = this._goalFactory()[name](actor);

          if (goal !== undefined) {
            plan.addAll( goal.plan(goal.state(actor)) );
          }
        }
      }

      return plan;
    });
  }

  /**
   * elect a winning plan
   *
   * @returns pruned plan structure
   */
  public abstract elect(state: M, plan: Plan<R>[]): Plan<R>;

  /**
   * execute plans
   *
   * state and world is modified
   *
   * @returns list of failed plan roots
   */
  public abstract execute(actor: A, state: M, plan: Plan<R>): Plan<R>[];

  /**
   * cleanup dead goals, plan for next cycle
   *
   * @returns resolution plan root
   */
  public abstract resolve(failures: Plan<R>[]): Plan<R>[]|any;

  public isPaused(): boolean {
    return false;
  }

  protected _buildCandidateActors(goalName: string, state: M): any[] {
    let factory = this._candidateActorFactory();
    let goalBuilder = factory[goalName];
    if (goalBuilder === undefined) {
      console.log("no builder goal=", goalName, "parentGoal=", this.getGoalKey());
      return [];
    }

    let candidates: any[] = goalBuilder(state);

    if (candidates === undefined) {
      return [];
    }
    return candidates;
  }

  protected _goalPriority(): string[] {
    // TODO set goal priority
    return [];
  }

  protected _goalFactory(): GoalFactory<any> {
    return goals;
  }

  protected abstract _identifyResources(state: M): R[];

  /**
   * plan phase
   */
  protected abstract _candidateActorFactory(): CandidateFactory<M>;
}
export default Goal;

// /**
//  * this goal can be immediately resolved in the next tick with a single task
//  */
// canFinish(state: S, actor: T): Task|undefined;
// /**
//  * progress is immediately possible
//  */
// canProgress(state: S): boolean;
//
// /**
//  * ticks to reach the next progress increment
//  */
// getProgressTicks(state: State): number;
//
// /**
//  * magnitude of the next progress increment
//  */
//
// getProgressVelocity(state: State): number;
// /**
//  * calculate if a resource should be stolen from another goal
//  */
// stealResource(state: S, actor: T): boolean;
