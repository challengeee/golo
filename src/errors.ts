export class IllegalMovementError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IllegalMovementError'
  }
}
