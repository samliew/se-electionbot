/**
 * @typedef {import("../guards").MessageGuard} MessageGuard
 */

/**
 * @summary checks if a query is asking to move a chess piece
 * @type {MessageGuard}
 */
export const isAskingToMoveChessPiece = (text) => {
  return /(rook|pawn|king|bishop|knight|queen)\s+at\s+(\w\d)\s+to\s+(\w\d)/i.test(
    text
  );
};
