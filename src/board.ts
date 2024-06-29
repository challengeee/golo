import { BLACK, EMPTY, PASS_LOC, WALL, WHITE } from './constants'
import { IllegalMovementError } from './errors'
import { DiffLoc, Loc, Player, PlayerGameStats } from './types'

export class Board {
  player: Player = BLACK
  arraySize: number
  dy: number
  adjs: [DiffLoc, DiffLoc, DiffLoc, DiffLoc]
  diags: [DiffLoc, DiffLoc, DiffLoc, DiffLoc]

  board: Uint8Array
  /**
   * head of the group to which each point belongs.
   */
  groupHeads: Uint16Array
  /**
   * number of stones in each group.
   */
  groupStoneCounts: Uint16Array
  /**
   * number of liberties in each group.
   */
  groupLibertyCounts: Uint16Array
  /**
   * next group in the linked list of groups
   */
  groupNexts: Uint16Array
  /**
   * previous group in the linked list of groups
   */
  groupPrevs: Uint16Array
  /**
   * location of the ko point.
   */
  simpleKoLoc: Loc | null = null
  /**
   * number of captures made by each player.
   */
  captures: PlayerGameStats = { [BLACK]: 0, [WHITE]: 0 }
  /**
   * number of consecutive passes.
   */
  passMoves: PlayerGameStats = { [BLACK]: 0, [WHITE]: 0 }

  _emptiesUint8(size: number) {
    return new Uint8Array([...Array(size)].map(() => EMPTY))
  }

  _emptiesUint16(size: number) {
    return new Uint16Array([...Array(size)].map(() => EMPTY))
  }

  loc(x: number, y: number): Loc {
    return x + 1 + this.dy * (y + 1)
  }

  getOpponent(player: Player): Player {
    return player === BLACK ? WHITE : BLACK
  }

  wouldBeSingleStoneSuicide(player: Player, loc: Loc): boolean {
    const adjs = this.adjs.map((adj) => loc + adj)
    const opponent = this.getOpponent(player)

    // if empty, not suicide
    const hasEmpty = adjs.some((adj) => this.board[adj] === EMPTY)
    if (hasEmpty) {
      return false
    }

    // if capture, not suicide
    const willCapture = adjs.some((adj) => {
      return (
        this.board[adj] === opponent &&
        this.groupLibertyCounts[this.groupHeads[adj]] === 1
      )
    })
    if (willCapture) {
      return false
    }

    // if connects to own stone, then not single stone suicide
    const isConnectedToOwnStone = adjs.some((adj) => this.board[adj] === player)
    if (isConnectedToOwnStone) {
      return false
    }

    return true
  }

  constructor(public size: number) {
    if (size < 2 || size > 39) {
      throw new Error(`invalid board size: ${size}`)
    }
    this.arraySize = (size + 1) * (size + 2) + 1
    this.dy = size + 1
    this.adjs = [-this.dy, -1, 1, this.dy]
    this.diags = [-this.dy - 1, -this.dy + 1, this.dy - 1, this.dy + 1]

    this.board = this._emptiesUint8(this.arraySize)
    this.groupHeads = this._emptiesUint16(this.arraySize)
    this.groupStoneCounts = this._emptiesUint16(this.arraySize)
    this.groupLibertyCounts = this._emptiesUint16(this.arraySize)
    this.groupNexts = this._emptiesUint16(this.arraySize)
    this.groupPrevs = this._emptiesUint16(this.arraySize)

    for (let i = -1; i < size + 1; i++) {
      this.board[this.loc(i, -1)] = WALL
      this.board[this.loc(i, size)] = WALL
      this.board[this.loc(-1, i)] = WALL
      this.board[this.loc(size, i)] = WALL
    }
  }

  isOnBoard(loc: Loc): boolean {
    return loc >= 0 && loc < this.arraySize && this.board[loc] != WALL
  }

  // Play a stone at the given location, with non-superko legality checking and updating the pla and simple ko point
  // Single stone suicide is disallowed but suicide is allowed, to support rule sets and sgfs that have suicide
  play(player: Player, loc: Loc): void {
    if (player != BLACK && player != WHITE) {
      throw new Error(`invalid player: ${player}`)
    }

    if (loc != PASS_LOC) {
      if (!this.isOnBoard(loc)) {
        throw new Error(`invalid location: ${loc}`)
      }
      if (this.board[loc] != EMPTY) {
        throw new IllegalMovementError('non-empty location')
      }
      if (this.wouldBeSingleStoneSuicide(player, loc)) {
        throw new IllegalMovementError(
          'Move would be illegal single stone suicide',
        )
      }
      if (loc === this.simpleKoLoc) {
        throw new IllegalMovementError('Move would be simple ko recapture')
      }
    }

    this.playUnsafe(player, loc)
  }

  playUnsafe(player: Player, loc: Loc) {
    if (loc === PASS_LOC) {
      this.simpleKoLoc = null
      this.player = this.getOpponent(player)
    } else {
      this.addUnsafe(player, loc)
      this.player = this.getOpponent(player)
    }
  }

  addUnsafe(player: Player, loc: Loc) {
    const opponent = this.getOpponent(player)

    // put the stone down
    this.board[loc] = player

    // initialize the group for that stone
    this.groupHeads[loc] = loc
    this.groupStoneCounts[loc] = 1

    const adjs = this.adjs.map((adj) => loc + adj)
    const liberties = adjs.reduce(
      (acc, adj) => acc + (this.board[adj] === EMPTY ? 1 : 0),
      0,
    )
    this.groupLibertyCounts[loc] = liberties
    this.groupNexts[loc] = loc
    this.groupPrevs[loc] = loc

    // Todo: find better implementation
    // fill surrounding liberties of all adjacent groups
    // carefully avoid double count
    if (this.board[adjs[0]] === BLACK || this.board[adjs[0]] === WHITE) {
      this.groupLibertyCounts[this.groupHeads[adjs[0]]] -= 1
    }
    if (this.board[adjs[1]] === BLACK || this.board[adjs[1]] === WHITE) {
      if (this.groupHeads[adjs[1]] !== this.groupHeads[adjs[0]]) {
        this.groupLibertyCounts[this.groupHeads[adjs[1]]] -= 1
      }
    }
    if (this.board[adjs[2]] === BLACK || this.board[adjs[2]] === WHITE) {
      if (
        this.groupHeads[adjs[2]] !== this.groupHeads[adjs[0]] &&
        this.groupHeads[adjs[2]] !== this.groupHeads[adjs[1]]
      ) {
        this.groupLibertyCounts[this.groupHeads[adjs[2]]] -= 1
      }
    }
    if (this.board[adjs[3]] === BLACK || this.board[adjs[3]] === WHITE) {
      if (
        this.groupHeads[adjs[3]] !== this.groupHeads[adjs[0]] &&
        this.groupHeads[adjs[3]] !== this.groupHeads[adjs[1]] &&
        this.groupHeads[adjs[3]] !== this.groupHeads[adjs[2]]
      ) {
        this.groupLibertyCounts[this.groupHeads[adjs[3]]] -= 1
      }
    }

    adjs.forEach((adj) => {
      if (this.board[adj] === player) {
        this.mergeUnsafe(loc, adj)
      }
    })

    // remove captures
    let opponentStonesCaptured = 0
    let caploc = 0
    adjs.forEach((adj) => {
      if (this.board[adj] === opponent) {
        const head = this.groupHeads[adj]
        if (this.groupLibertyCounts[head] === 0) {
          opponentStonesCaptured += this.groupStoneCounts[head]
          caploc = adj
          this.removeUnsafe(adj)
        }
      }
    })

    // Suicide
    let playerStonesCaptured = 0
    if (this.groupLibertyCounts[this.groupHeads[loc]] === 0) {
      playerStonesCaptured += this.groupStoneCounts[this.groupHeads[loc]]
      this.removeUnsafe(loc)
    }

    this.captures[player] += playerStonesCaptured
    this.captures[opponent] += opponentStonesCaptured
    this.passMoves[player] += 1

    // Update ko point for legality checking
    if (
      opponentStonesCaptured === 1 &&
      this.groupStoneCounts[this.groupHeads[loc]] === 1 &&
      this.groupLibertyCounts[this.groupHeads[loc]] === 1
    ) {
      this.simpleKoLoc = caploc
    } else {
      this.simpleKoLoc = null
    }
  }

  isGroupAdjacent(head: Loc, loc: Loc): boolean {
    return this.adjs.some((adj) => {
      return this.groupHeads[loc + adj] === head
    })
  }

  // Helper, merge two groups assuming they're owned by the same player and adjacent
  mergeUnsafe(loc0: Loc, loc1: Loc): void {
    let parent: Loc
    let child: Loc
    if (
      this.groupStoneCounts[this.groupHeads[loc0]] >=
      this.groupStoneCounts[this.groupHeads[loc1]]
    ) {
      parent = loc0
      child = loc1
    } else {
      parent = loc1
      child = loc0
    }

    const phead = this.groupHeads[parent]
    const chead = this.groupHeads[child]
    if (phead === chead) {
      return
    }

    // walk the child group assigning the new head and simultaneously counting liberties
    let newStoneCount =
      this.groupStoneCounts[phead] + this.groupStoneCounts[chead]
    let newLiberty = this.groupLibertyCounts[phead]
    let loc = child
    while (true) {
      const adjs = this.adjs.map((adj) => loc + adj)

      // Any adjacent empty space is a new liberty as long as it isn't adjacent to the parent
      adjs.reduce((acc, adj) => {
        if (this.board[adj] === EMPTY && !this.isGroupAdjacent(phead, adj)) {
          acc += 1
        }
        return acc
      }, newLiberty)

      // Now assign the new parent head to take over the child (this also
      // prevents double-counting liberties)
      this.groupHeads[loc] = phead

      // Advance around the linked list
      loc = this.groupNexts[loc]
      if (loc === child) {
        break
      }
    }

    // Zero out the old head
    this.groupStoneCounts[chead] = 0
    this.groupLibertyCounts[chead] = 0

    // Update the new head
    this.groupStoneCounts[chead] = newStoneCount
    this.groupLibertyCounts[chead] = newLiberty

    const plast = this.groupPrevs[phead]
    const clast = this.groupPrevs[chead]
    this.groupNexts[clast] = phead
    this.groupNexts[plast] = chead
    this.groupPrevs[chead] = plast
    this.groupPrevs[phead] = clast
  }

  removeUnsafe(groupLoc: Loc): void {
    const head = this.groupHeads[groupLoc]
    const player = this.board[groupLoc] as Player
    const opponent = this.getOpponent(player)

    // Walk all the stones in the group and delete them
    let loc = groupLoc
    while (true) {
      // Add a liberty to all surrounding opposing groups, taking care to avoid double counting
      const adjs = this.adjs.map((adj) => loc + adj)
      if (this.board[adjs[0]] === opponent) {
        this.groupLibertyCounts[this.groupHeads[adjs[0]]] += 1
      }
      if (this.board[adjs[1]] === opponent) {
        if (this.groupHeads[adjs[1]] !== this.groupHeads[adjs[0]]) {
          this.groupLibertyCounts[this.groupHeads[adjs[1]]] += 1
        }
      }
      if (this.board[adjs[2]] === opponent) {
        if (
          this.groupHeads[adjs[2]] !== this.groupHeads[adjs[0]] &&
          this.groupHeads[adjs[2]] !== this.groupHeads[adjs[1]]
        ) {
          this.groupLibertyCounts[this.groupHeads[adjs[2]]] += 1
        }
      }
      if (this.board[adjs[3]] === opponent) {
        if (
          this.groupHeads[adjs[3]] !== this.groupHeads[adjs[0]] &&
          this.groupHeads[adjs[3]] !== this.groupHeads[adjs[1]] &&
          this.groupHeads[adjs[3]] !== this.groupHeads[adjs[2]]
        ) {
          this.groupLibertyCounts[this.groupHeads[adjs[3]]] += 1
        }
      }

      let nextLoc = this.groupNexts[loc]

      // zero out all thu stuff
      this.board[loc] = EMPTY
      this.groupHeads[loc] = 0
      this.groupStoneCounts[loc] = 0
      this.groupLibertyCounts[loc] = 0

      // Advance around the linked list
      loc = nextLoc
      if (loc === groupLoc) {
        break
      }
    }

    this.groupStoneCounts[head] = 0
    this.groupLibertyCounts[head] = 0
  }

  // TODO: make it more beautiful
  toString(useBoxDrawingCharacter: boolean = true): string {
    const getPiece = (x: number, y: number) => {
      const loc = this.loc(x, y)
      if (this.board[loc] === BLACK) {
        return '●'
      } else if (this.board[loc] === WHITE) {
        return '○'
      } else if (
        (x === 3 || x === this.size / 2 || x === this.size - 1 - 3) &&
        (y === 3 || y === this.size / 2 || y === this.size - 1 - 3)
      ) {
        if (useBoxDrawingCharacter) {
          return '╋'
        }
        return '* '
      } else {
        if (useBoxDrawingCharacter) {
          if (x === 0 && y === 0) {
            return '┏'
          }
          if (x === this.size - 1 && y === 0) {
            return '┓'
          }
          if (x === 0 && y === this.size - 1) {
            return '┗'
          }
          if (x === this.size - 1 && y === this.size - 1) {
            return '┛'
          }
          if (x === 0) {
            return '┣'
          }
          if (x === this.size - 1) {
            return '┫'
          }
          if (y === 0) {
            return '┳'
          }
          if (y === this.size - 1) {
            return '┻'
          }
          return '╋'
        }
        return '. '
      }
    }
    // return "\n".join("".join(get_piece(x,y) for x in range(self.size)) for y in range(self.size))
    return Array.from({ length: this.size }, (_, y) =>
      Array.from({ length: this.size }, (_, x) => getPiece(x, y)).join(''),
    ).join('\n')
  }
}
