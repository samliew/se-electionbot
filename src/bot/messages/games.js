import JCE from "js-chess-engine";

import ChessJS from "chess.js";
import { formatAsChatCode } from "../../shared/utils/chat.js";

/**
 * @typedef {import("./index.js").MessageBuilder} MessageBuilder
 */

const chess = new ChessJS.Chess();

/**
 * @summary type guard for text being a valid SAN notation square
 * @param {string} text possibly a SAN notation of a square
 * @returns {text is ChessJS.Square}
 */
const isValidSquare = (text) => {
  return /^[a-hA-H][1-8]$/.test(text);
};

/**
 * @summary checks if a given text is an uppercase SAN
 * @param {string} text possibly uppercase SAN notation
 * @returns {boolean}
 */
const isUpperCaseSAN = (text) => {
  return /^[A-H][1-8]$/.test(text);
};

/**
 * @summary gets chessboard as a chat multiline message
 * @param {ChessJS.Chess} chess {@link ChessJS} instance
 * @returns {string}
 */
const getChessboardAsChatMessage = (chess) => {
  return formatAsChatCode(chess.ascii().split(/\r?\n/));
};

/**
 * @summary normalizes SAN notation for {@link ChessJS}
 * @param {string} text possibly uppercase SAN notation
 * @returns {string}
 */
const normalizeSAN = (text) => {
  return isUpperCaseSAN(text) ? text.toLowerCase() : text;
};

/**
 * @summary handles special moves by the bot or the player
 * @param {Map<() => boolean, string>} moveMap special move guard to response map
 * @param {ChessJS.Chess} chess {@link ChessJS} instance
 * @returns {string | undefined}
 */
const getSpecialMoveResponse = (moveMap, chess) => {
  for (const [guard, response] of moveMap) {
    if (guard()) {
      return `    ${response}\n${getChessboardAsChatMessage(chess)}`;
    }
  }
};

/**
 * @summary plays a game of chess with a requestor
 * @type {MessageBuilder}
 */
export const sayGameOfChess = (config, _es, _e, text, user) => {
  if (chess.isGameOver()) {
    config.awaitingConfirmation.set(user.id, (_c, _es, _e, text) => {
      if (!/y(?:es|up)|sure/i.test(text)) {
        return "";
      }

      chess.reset();
      return getChessboardAsChatMessage(chess);
    });

    return "The game is over. Would you like to play another one?";
  }

  const [, piece, from, to] =
    /(rook|pawn|king|bishop|knight|queen)\s+at\s+(\w\d)\s+to\s+(\w\d)/.exec(
      text
    ) || [text, "", "", ""];

  if (!piece || !isValidSquare(from) || !isValidSquare(to)) {
    return "Invalid move, please try again (e.g.: pawn at E2 to E4)";
  }

  const currentPiece = chess.get(from);
  if (!currentPiece) {
    return `There is no chess piece at ${from}, please try again`;
  }

  if (currentPiece.color !== ChessJS.WHITE) {
    return "You can only move pieces of the color you are playing as";
  }

  const playerMove = chess.move({ from, to });
  if (!playerMove) {
    return `Can't move the ${piece} from ${from} to ${to}`;
  }

  /** @type {Map<() => boolean, string>} */
  const playerSpecialMoveMap = new Map();
  playerSpecialMoveMap.set(() => chess.isCheckmate(), "Checkmate, you win!");
  playerSpecialMoveMap.set(() => chess.isDraw(), "Seems like we have a draw!");
  playerSpecialMoveMap.set(
    () => chess.isStalemate(),
    "Looks like we are in a stalemate, pal!"
  );

  const playerSpecialReponse = getSpecialMoveResponse(
    playerSpecialMoveMap,
    chess
  );

  if (playerSpecialReponse) {
    return playerSpecialReponse;
  }

  // TODO: three-fold repetition, insufficient material

  const currentGame = new JCE.Game(chess.fen());
  const calculatedMove = currentGame.aiMove();

  const [[botFrom, botTo]] = Object.entries(calculatedMove);

  const botMove = chess.move({
    from: normalizeSAN(botFrom),
    to: normalizeSAN(botTo),
  });

  if (!botMove) {
    console.log(`[chess] failed to move: ${botFrom}${botTo}`);
    return "Touche, I can't play chess!";
  }

  /** @type {Map<() => boolean, string>} */
  const botSpecialMoveMap = new Map();
  botSpecialMoveMap.set(() => chess.isCheck(), "Check!");
  botSpecialMoveMap.set(() => chess.isCheckmate(), "Checkmate, I win!");
  botSpecialMoveMap.set(() => chess.isDraw(), "We reached a draw!");
  botSpecialMoveMap.set(() => chess.isStalemate(), "We are in a stalemate!");

  const botSpecialResponse = getSpecialMoveResponse(botSpecialMoveMap, chess);

  return botSpecialResponse || getChessboardAsChatMessage(chess);
};
