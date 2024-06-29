import { BLACK, EMPTY, WALL, WHITE } from './constants'

export type BoardElement =
  | typeof EMPTY
  | typeof BLACK
  | typeof WHITE
  | typeof WALL
export type Player = typeof BLACK | typeof WHITE
export type Board = Element[][]

export interface PlayerGameStats {
  [BLACK]: number
  [WHITE]: number
}

/**
 * one dimensional location on the board.
 */
export type Loc = number

/**
 * difference between two locations.
 */
export type DiffLoc = number
